/* ===== 答题页 ===== */
(function () {
  "use strict";

  var App = window.App;

  var bankId = App.getParam("bank");
  var mode = App.getParam("mode") || "all";
  var chapter = App.getParam("chapter") || "";
  var typeParam = App.getParam("type") || "";
  var roundParam = App.getParam("round") || "";
  var shuffleOrder = App.getParam("shuffle") === "1";
  var fresh = App.getParam("fresh") === "1";
  var gotoParam = parseInt(App.getParam("goto"), 10);

  var bank = App.getBank(bankId);

  var nameEl = document.getElementById("bank-name");
  var infoPos = document.getElementById("info-pos");
  var infoCorrect = document.getElementById("info-correct");
  var infoRemain = document.getElementById("info-remain");
  var infoTimer = document.getElementById("info-timer");
  var infoMode = document.getElementById("info-mode");
  var headEl = document.getElementById("stem-head");
  var stemEl = document.getElementById("stem");
  var optionsEl = document.getElementById("options");
  var feedbackEl = document.getElementById("feedback");
  var submitBtn = document.getElementById("btn-submit");
  var prevBtn = document.getElementById("btn-prev");
  var nextBtn = document.getElementById("btn-next");
  var sheetBtn = document.getElementById("btn-sheet");
  var sheetMask = document.getElementById("sheet-mask");
  var sheetGrid = document.getElementById("sheet-grid");
  var firstWrongBtn = document.getElementById("btn-first-wrong");
  var sheetCloseBtn = document.getElementById("btn-sheet-close");
  var submitMask = document.getElementById("submit-mask");
  var submitText = document.getElementById("submit-text");
  var submitCancel = document.getElementById("btn-submit-cancel");
  var submitOk = document.getElementById("btn-submit-ok");
  var optShuffleToggle = document.getElementById("opt-shuffle-toggle");

  var quizCard = document.getElementById("quiz-card");

  if (!bank) {
    nameEl.textContent = "题库不存在";
    infoPos.textContent = "";
    quizCard.style.display = "none";
    return;
  }

  nameEl.textContent = bank.name;

  var valid = App.validQuestions(bank);
  var questionById = {};
  valid.forEach(function (q) { questionById[q.id] = q; });

  // 构建题目池（按模式过滤）
  function buildPool() {
    var validIds = valid.map(function (q) { return q.id; });
    if (mode === "wrong") {
      return Object.keys(App.getWrong(bankId)).filter(function (id) { return validIds.indexOf(Number(id)) >= 0; });
    }
    if (mode === "fav") {
      return App.getFav(bankId).filter(function (id) { return validIds.indexOf(id) >= 0; });
    }
    if (mode === "chapter") {
      return valid.filter(function (q) { return q.chapter === chapter; }).map(function (q) { return q.id; });
    }
    if (mode === "type") {
      return valid.filter(function (q) { return q.type === typeParam; }).map(function (q) { return q.id; });
    }
    if (mode === "round") {
      var round = App.getRound(bankId, roundParam);
      if (!round) return [];
      var wrongIds = App.roundWrongIds(round);
      return wrongIds.filter(function (id) { return validIds.indexOf(id) >= 0; });
    }
    return validIds;
  }

  var pool = buildPool();
  var progress = App.getProgress(bankId);

  function modeLabel() {
    if (mode === "wrong") return "错题";
    if (mode === "fav") return "收藏";
    if (mode === "chapter") return chapter || "章节";
    if (mode === "round") return "该轮错题";
    if (mode === "type") {
      if (typeParam === "single") return "单选题";
      if (typeParam === "multiple") return "多选题";
      if (typeParam === "judge") return "判断题";
      return "题型";
    }
    return "全部题目";
  }

  if (pool.length === 0) {
    nameEl.textContent = bank.name;
    infoMode.textContent = "（" + modeLabel() + "：暂无题目）";
    quizCard.innerHTML = '<div class="empty-tip">当前模式下没有可做的题目。<br>请返回首页选择其他方式。</div>';
    return;
  }

  // 构建题目顺序（续上次 / 随机 / 新建）
  var needNew = fresh ||
    progress.mode !== mode ||
    progress.chapter !== (chapter || "") ||
    progress.order.length === 0;
  var order;
  if (!needNew) {
    order = progress.order.filter(function (id) { return pool.indexOf(id) >= 0; });
    if (order.length === 0) needNew = true;
  }
  if (needNew) {
    order = shuffleOrder ? App.shuffle(pool) : pool.slice();
    progress.current = 0;
  }
  progress.mode = mode;
  progress.chapter = chapter || "";
  progress.order = order;
  if (progress.current < 0) progress.current = 0;
  if (progress.current >= order.length) progress.current = order.length - 1;

  // 从题目搜索结果跳转：定位到指定题号
  if (gotoParam) {
    var gi = order.indexOf(gotoParam);
    if (gi >= 0) progress.current = gi;
  }

  // 错题模式 fresh 进入 = 重做错题：清除这些题的作答锁定，允许重新作答
  if (fresh && mode === "wrong") {
    order.forEach(function (id) { delete progress.answered[id]; });
    progress.correctCount = 0;
    Object.keys(progress.answered).forEach(function (k) {
      if (progress.answered[k] && progress.answered[k].correct) progress.correctCount++;
    });
  }

  App.saveProgress(bankId, progress);

  var wrongMap = App.getWrong(bankId);
  var currentSelected = [];
  var optOrderMap = {}; // 题号 -> 打乱后的选项数组（随机选项时缓存，保证翻题顺序一致）
  var sessionStart = Date.now();
  var questionStart = Date.now();

  function currentQuestion() {
    return questionById[order[progress.current]];
  }
  function answeredRecord() {
    return progress.answered[currentQuestion().id] || null;
  }
  function unansweredCount() {
    var n = 0;
    for (var i = 0; i < order.length; i++) {
      if (!progress.answered[order[i]]) n++;
    }
    return n;
  }
  // 已选未提交的题数
  function pendingCount() {
    var n = 0;
    for (var i = 0; i < order.length; i++) {
      var id = order[i];
      if (!progress.answered[id] && progress.selections[id] && progress.selections[id].length > 0) n++;
    }
    return n;
  }
  // 完全没做的题数（既没提交也没选）
  function emptyCount() {
    var n = 0;
    for (var i = 0; i < order.length; i++) {
      var id = order[i];
      if (!progress.answered[id] && !(progress.selections[id] && progress.selections[id].length > 0)) n++;
    }
    return n;
  }

  function typeTag(q) {
    var cls = "";
    if (q.type === "single") cls = "tag-single";
    else if (q.type === "multiple") cls = "tag-multiple";
    else if (q.type === "judge") cls = "tag-judge";
    return '<span class="tag ' + cls + '">' + App.escapeHtml(q.typeName) + "</span>";
  }

  function formatTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return (m < 10 ? "0" + m : m) + ":" + (s < 10 ? "0" + s : s);
  }

  function getDisplayOptions(q) {
    if (!optShuffleToggle.checked) return q.options;
    if (!optOrderMap[q.id]) optOrderMap[q.id] = App.shuffle(q.options);
    return optOrderMap[q.id];
  }

  function updateTimer() {
    var total = (Date.now() - sessionStart) / 1000;
    infoTimer.textContent = formatTime(total);
  }

  // 答题音效（Web Audio 生成，无需音频文件）
  function playTone(freq, dur) {
    if (!App.getSettings().sound) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      var ctx = window.__audioCtx || (window.__audioCtx = new AC());
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.value = 0.06;
      osc.connect(gain);
      gain.connect(ctx.destination);
      var t = ctx.currentTime;
      gain.gain.setValueAtTime(0.06, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.start(t);
      osc.stop(t + dur);
    } catch (e) { /* 忽略音频错误 */ }
  }

  function render() {
    var q = currentQuestion();
    var rec = answeredRecord();

    infoPos.textContent = "第 " + (progress.current + 1) + " 题 / 共 " + order.length + " 题";
    infoCorrect.textContent = "已答对 " + progress.correctCount + " 题";
    var pend = pendingCount();
    infoRemain.textContent = "剩余 " + emptyCount() + " 题" + (pend > 0 ? "（已选 " + pend + "）" : "");
    infoMode.textContent = modeLabel();

    var curTime = rec ? (rec.time || 0) : (Date.now() - questionStart) / 1000;
    var fav = App.hasFav(bankId, q.id);
    var mark = App.getMark(bankId, q.id);
    var flagText = mark.flag === "mastered" ? "已掌握" : mark.flag === "doubt" ? "有疑问" : "标记";
    var flagCls = mark.flag === "mastered" ? "flag-mastered" : mark.flag === "doubt" ? "flag-doubt" : "";
    headEl.innerHTML =
      typeTag(q) +
      '<span style="color:var(--text-2);font-size:14px;">题号 ' + q.id + "</span>" +
      '<span class="timer" style="margin-left:8px;">本题 ' + formatTime(curTime) + "</span>" +
      '<span class="head-actions">' +
        '<button class="icon-btn ' + flagCls + '" data-action="flag">' + flagText + "</button>" +
        '<button class="icon-btn ' + (fav ? "is-fav" : "") + '" data-action="fav">' +
          (fav ? "★ 已收藏" : "☆ 收藏") + "</button>" +
      "</span>";

    stemEl.innerHTML = App.markdownToHtml(q.stem, true);

    var isMulti = q.type === "multiple";
    var correctSet = q.answer.slice();
    var selectedSet = rec ? rec.selected.slice() : currentSelected.slice();
    var optionHtml = "";
    var hint = isMulti ? '<div class="bank-progress-text" style="margin-bottom:8px;">本题为多选题，可选择多个答案</div>' : "";

    getDisplayOptions(q).forEach(function (opt) {
      var cls = "option";
      if (rec) {
        cls += " locked";
        if (correctSet.indexOf(opt.key) >= 0) cls += " correct";
        else if (selectedSet.indexOf(opt.key) >= 0) cls += " wrong";
      } else {
        if (selectedSet.indexOf(opt.key) >= 0) cls += " selected";
      }
      optionHtml +=
        '<div class="' + cls + '" data-key="' + opt.key + '">' +
          '<span class="key">' + opt.key + "</span>" +
          '<span class="opt-text">' + App.markdownToHtml(opt.text, false) + "</span>" +
        "</div>";
    });
    optionsEl.innerHTML = hint + optionHtml;

    if (rec) {
      feedbackEl.style.display = "block";
      feedbackEl.className = "feedback " + (rec.correct ? "correct" : "wrong");
      var answerText = q.answer.join("、");
      var yourText = rec.selected.join("、") || "未选";
      feedbackEl.innerHTML =
        '<p class="fb-title">' + (rec.correct ? "回答正确" : "回答错误") + "</p>" +
        '<p class="fb-answer">正确答案：' + App.escapeHtml(answerText) +
        (rec.correct ? "" : "　你的答案：" + App.escapeHtml(yourText)) + "</p>" +
        '<p class="fb-analysis">' + App.markdownToHtml(q.analysis, false) + "</p>";
    } else {
      feedbackEl.style.display = "none";
      feedbackEl.innerHTML = "";
    }

    if (rec) {
      submitBtn.disabled = true;
      submitBtn.textContent = "已提交";
    } else {
      submitBtn.disabled = currentSelected.length === 0;
      submitBtn.textContent = "提交";
    }
    prevBtn.disabled = progress.current === 0;

    var isLast = progress.current === order.length - 1;
    if (isLast) {
      nextBtn.textContent = "交卷";
      nextBtn.className = "btn btn-danger";
    } else {
      nextBtn.textContent = "下一题";
      nextBtn.className = "btn btn-secondary";
    }

    updateTimer();
  }

  function renderSheet() {
    var html = "";
    for (var i = 0; i < order.length; i++) {
      var id = order[i];
      var rec = progress.answered[id];
      var sel = progress.selections[id];
      var cls = "sheet-cell";
      if (rec) cls += rec.correct ? " correct" : " wrong";
      else if (sel && sel.length > 0) cls += " selected";
      if (i === progress.current) cls += " current";
      html += '<div class="' + cls + '" data-index="' + i + '">' + (i + 1) + "</div>";
    }
    sheetGrid.innerHTML = html;
  }

  function goTo(index) {
    if (index < 0 || index >= order.length) return;
    // 离开当前题前，把未提交的选择保存下来（翻题保留选项）
    var curId = order[progress.current];
    if (!progress.answered[curId]) {
      if (currentSelected.length > 0) {
        progress.selections[curId] = currentSelected.slice();
      } else {
        delete progress.selections[curId];
      }
    }
    progress.current = index;
    var newId = order[index];
    var rec = progress.answered[newId];
    if (rec) {
      currentSelected = rec.selected.slice();
    } else {
      currentSelected = (progress.selections[newId] || []).slice();
    }
    questionStart = Date.now();
    App.saveProgress(bankId, progress);
    render();
  }

  function firstWrongIndex() {
    for (var i = 0; i < order.length; i++) {
      if (wrongMap[order[i]] !== undefined) return i;
    }
    return -1;
  }

  // 收藏 / 标记按钮（headEl 委托）
  headEl.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-action]");
    if (!btn) return;
    var q = currentQuestion();
    var action = btn.getAttribute("data-action");
    if (action === "fav") {
      App.toggleFav(bankId, q.id);
      render();
    } else if (action === "flag") {
      App.cycleFlag(bankId, q.id);
      render();
    }
  });

  // 选中/取消一个选项，并同步保存到 selections（未提交的选择翻题保留）
  function applySelect(q, key) {
    if (q.type === "multiple") {
      var idx = currentSelected.indexOf(key);
      if (idx >= 0) currentSelected.splice(idx, 1);
      else currentSelected.push(key);
    } else {
      currentSelected = [key];
    }
    if (currentSelected.length > 0) {
      progress.selections[q.id] = currentSelected.slice();
    } else {
      delete progress.selections[q.id];
    }
    App.saveProgress(bankId, progress);
  }

  // 选项点击
  optionsEl.addEventListener("click", function (e) {
    var opt = e.target.closest(".option");
    if (!opt) return;
    if (answeredRecord()) return;
    var key = opt.getAttribute("data-key");
    var q = currentQuestion();
    applySelect(q, key);
    render();
  });

  // 提交某道题的作答（判题 + 记录 + 维护错题本），返回是否答对
  function commitAnswer(qid, selected, time) {
    var q = questionById[qid];
    var correct = App.isCorrect(q.answer, selected);
    progress.answered[qid] = { selected: selected.slice(), correct: correct, time: time || 0 };
    delete progress.selections[qid];
    if (correct) {
      progress.correctCount += 1;
      // 错题模式/刷该轮错题答对 → 自动移出错题本
      if ((mode === "wrong" || mode === "round") && wrongMap[qid]) {
        App.removeWrong(bankId, qid);
        wrongMap = App.getWrong(bankId);
      }
    } else {
      // 答错：错题模式重做则次数 +1，其他模式首次答错则加入
      if (wrongMap[qid]) {
        wrongMap[qid].attempts = (wrongMap[qid].attempts || 0) + 1;
        if (!wrongMap[qid].wrongAt) wrongMap[qid].wrongAt = Date.now();
      } else {
        wrongMap[qid] = { attempts: 0, wrongAt: Date.now() };
      }
      App.saveWrong(bankId, wrongMap);
    }
    App.saveProgress(bankId, progress);
    return correct;
  }

  // 提交
  submitBtn.addEventListener("click", function () {
    if (answeredRecord()) return;
    if (currentSelected.length === 0) return;
    var q = currentQuestion();
    var time = Math.round((Date.now() - questionStart) / 1000);
    var correct = commitAnswer(q.id, currentSelected, time);

    // 答对/答错音效
    playTone(correct ? 880 : 220, correct ? 0.15 : 0.3);

    render();
  });

  // 上一题
  prevBtn.addEventListener("click", function () { goTo(progress.current - 1); });
  // 下一题 / 交卷
  nextBtn.addEventListener("click", function () {
    if (progress.current < order.length - 1) goTo(progress.current + 1);
    else openSubmitConfirm();
  });

  // 随机选项开关
  optShuffleToggle.addEventListener("change", function () {
    if (this.checked) optOrderMap = {};
    render();
  });

  // 键盘快捷键：A/B/C/D/E 选选项，回车提交
  document.addEventListener("keydown", function (e) {
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
    var q = currentQuestion();
    var key = e.key.toUpperCase();
    if (["A", "B", "C", "D", "E"].indexOf(key) >= 0) {
      var has = q.options.some(function (o) { return o.key === key; });
      if (!has || answeredRecord()) return;
      applySelect(q, key);
      render();
    } else if (e.key === "Enter") {
      if (currentSelected.length > 0 && !answeredRecord()) submitBtn.click();
    }
  });

  // 左右滑动切题
  var touchX = 0, touchY = 0;
  var cardEl = document.getElementById("quiz-card");
  cardEl.addEventListener("touchstart", function (e) {
    touchX = e.touches[0].clientX;
    touchY = e.touches[0].clientY;
  }, { passive: true });
  cardEl.addEventListener("touchend", function (e) {
    var dx = e.changedTouches[0].clientX - touchX;
    var dy = e.changedTouches[0].clientY - touchY;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) nextBtn.click();
      else prevBtn.click();
    }
  }, { passive: true });

  // 答题卡
  sheetBtn.addEventListener("click", function () {
    renderSheet();
    sheetMask.style.display = "flex";
  });
  sheetCloseBtn.addEventListener("click", function () { sheetMask.style.display = "none"; });
  sheetMask.addEventListener("click", function (e) {
    if (e.target === sheetMask) sheetMask.style.display = "none";
  });
  sheetGrid.addEventListener("click", function (e) {
    var cell = e.target.closest(".sheet-cell");
    if (!cell) return;
    sheetMask.style.display = "none";
    goTo(parseInt(cell.getAttribute("data-index"), 10));
  });
  firstWrongBtn.addEventListener("click", function () {
    var idx = firstWrongIndex();
    sheetMask.style.display = "none";
    if (idx < 0) {
      alert("当前没有错题。");
      return;
    }
    goTo(idx);
  });

  // 交卷确认
  function openSubmitConfirm() {
    var answered = 0;
    order.forEach(function (id) { if (progress.answered[id]) answered++; });
    var pending = pendingCount();
    var empty = emptyCount();
    var parts = "本次共 " + order.length + " 题：已提交 " + answered + " 题";
    if (pending > 0) parts += "，已选未提交 " + pending + " 题（交卷自动判分）";
    if (empty > 0) parts += "，" + empty + " 题没做";
    if (pending === 0 && empty === 0) parts += "，已全部答完";
    submitText.textContent = parts + "。确认交卷吗？";
    submitMask.style.display = "flex";
  }
  submitCancel.addEventListener("click", function () { submitMask.style.display = "none"; });
  submitMask.addEventListener("click", function (e) {
    if (e.target === submitMask) submitMask.style.display = "none";
  });
  submitOk.addEventListener("click", function () {
    // 先把当前题未提交的选择保存（可能选完直接点交卷）
    var curId = order[progress.current];
    if (!progress.answered[curId] && currentSelected.length > 0) {
      progress.selections[curId] = currentSelected.slice();
    }

    // 统一判题：把未提交但已选的题补进 answered（计入成绩与错题本）
    order.forEach(function (id) {
      if (progress.answered[id]) return;
      var sel = progress.selections[id];
      if (sel && sel.length > 0) {
        commitAnswer(id, sel, 0);
      }
    });

    // 统计基于本次 order 内实际作答的题
    var answeredCount = 0;
    var correct = 0;
    var wrong = 0;
    var wrongDetail = [];
    var detail = [];
    order.forEach(function (id) {
      var rec = progress.answered[id];
      var q = questionById[id];
      var selected = rec ? rec.selected : [];
      if (rec) {
        answeredCount++;
        if (rec.correct) correct++;
        else wrong++;
      }
      // 轮次快照（含题干/选项/答案/解析，供回看）
      detail.push({
        qid: id,
        typeName: q ? q.typeName : "",
        stem: q ? q.stem : "",
        options: q ? q.options : [],
        answer: q ? q.answer : [],
        analysis: q ? q.analysis : "",
        selected: selected.slice(),
        correct: rec ? rec.correct : null,
      });
      if (rec && !rec.correct && q) {
        wrongDetail.push({
          id: q.id, typeName: q.typeName, stem: q.stem,
          yourAnswer: rec.selected, answer: q.answer, analysis: q.analysis,
        });
      }
    });
    var unanswered = order.length - answeredCount;
    var rate = answeredCount > 0 ? Math.round((correct / answeredCount) * 100) : 0;
    var totalTime = Math.round((Date.now() - sessionStart) / 1000);

    // 记录这一轮（可回看 / 刷该轮错题）
    App.addRound(bankId, {
      id: Date.now(),
      t: Date.now(),
      bankId: bankId, bankName: bank.name,
      mode: mode, chapter: chapter || "",
      correct: correct, wrong: wrong, unanswered: unanswered,
      total: order.length, rate: rate, totalTime: totalTime,
      detail: detail,
    });

    App.saveResult(bankId, {
      bankId: bankId, bankName: bank.name,
      mode: mode, chapter: chapter || "",
      correct: correct, wrong: wrong, unanswered: unanswered,
      total: order.length, rate: rate, skipped: bank.questions.length - valid.length,
      totalTime: totalTime, wrongDetail: wrongDetail,
    });

    // 记录答题历史（用于统计）
    App.addHistory(bankId, {
      t: Date.now(),
      correct: correct,
      wrong: wrong,
      answered: answeredCount,
      total: order.length,
      rate: rate,
      totalTime: totalTime,
      mode: mode,
      chapter: chapter || "",
    });

    // 交卷后自动清空进度，下一轮全新开始（轮次记录已保存，不影响回看）
    App.resetProgress(bankId);

    location.href = "result.html?bank=" + encodeURIComponent(bankId);
  });

  // 计时器
  setInterval(updateTimer, 1000);

  render();
})();
