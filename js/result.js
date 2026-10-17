/* ===== 结果页 ===== */
(function () {
  "use strict";

  var App = window.App;
  var bankId = App.getParam("bank");
  var result = App.getResult(bankId);

  var titleEl = document.getElementById("result-title");
  var bodyEl = document.getElementById("result-body");

  if (!result) {
    titleEl.textContent = "答题结果";
    bodyEl.innerHTML =
      '<div class="card"><div class="empty-tip">暂无结果数据，请先进入题库答题并交卷。</div></div>' +
      '<div class="btn-row"><a class="btn btn-primary" href="index.html">返回首页</a></div>';
    return;
  }

  titleEl.textContent = result.bankName + " · 答题结果";

  var skippedNote = result.skipped > 0
    ? '<div class="notice">本次跳过 ' + result.skipped + ' 道异常题（题目存在缺失，未计入答题）。</div>'
    : "";

  var modeName = "全部题目";
  if (result.mode === "wrong") modeName = "错题";
  else if (result.mode === "fav") modeName = "收藏";
  else if (result.mode === "chapter") modeName = result.chapter || "章节";

  var metaHtml =
    '<div class="bank-progress-text" style="margin:0 0 14px;">' +
      '模式：' + App.escapeHtml(modeName) +
      '　｜　用时：' + App.formatTime(result.totalTime || 0) +
    "</div>";

  var statsHtml =
    '<div class="result-stats">' +
      '<div class="stat green"><div class="stat-num">' + result.correct + '</div><div class="stat-label">答对</div></div>' +
      '<div class="stat red"><div class="stat-num">' + result.wrong + '</div><div class="stat-label">答错</div></div>' +
      '<div class="stat blue"><div class="stat-num">' + result.rate + '%</div><div class="stat-label">正确率</div></div>' +
      '<div class="stat"><div class="stat-num">' + result.unanswered + '</div><div class="stat-label">未答</div></div>' +
    "</div>";

  var wrongHtml = "";
  if (result.wrongDetail && result.wrongDetail.length > 0) {
    var items = "";
    result.wrongDetail.forEach(function (w) {
      items +=
        '<div class="wrong-item">' +
          '<p class="wi-title">题号 ' + w.id + " · " + App.escapeHtml(w.typeName) + "</p>" +
          '<div class="wi-stem">' + App.markdownToHtml(w.stem, true) + "</div>" +
          '<p class="wi-line"><span class="your">你的答案：' + App.escapeHtml(w.yourAnswer.join("、") || "未选") + "</span></p>" +
          '<p class="wi-line"><span class="right">正确答案：' + App.escapeHtml(w.answer.join("、")) + "</span></p>" +
          (w.analysis
            ? '<p class="wi-line">解析：' + App.markdownToHtml(w.analysis, false) + "</p>"
            : "") +
        "</div>";
    });
    wrongHtml =
      '<div class="card"><p style="font-weight:600;font-size:17px;margin:0 0 12px;">错题列表（' +
      result.wrongDetail.length + " 道）</p>" + items + "</div>";
  } else {
    wrongHtml = '<div class="card"><div class="empty-tip">没有错题，太棒了！</div></div>';
  }

  bodyEl.innerHTML =
    skippedNote +
    metaHtml +
    statsHtml +
    wrongHtml +
    '<div class="btn-row">' +
      '<a class="btn btn-secondary" href="index.html">返回首页</a>' +
      '<a class="btn btn-secondary" href="rounds.html?bank=' + encodeURIComponent(bankId) + '">练习记录</a>' +
      '<button class="btn btn-primary" id="btn-restart">重新刷题</button>' +
    "</div>";

  // 成绩数字滚动揭晓
  function animateNumber(el, target, suffix, duration) {
    var start = null;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased) + (suffix || "");
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  var nums = bodyEl.querySelectorAll(".result-stats .stat-num");
  var targets = [
    { v: result.correct, s: "" },
    { v: result.wrong, s: "" },
    { v: result.rate, s: "%" },
    { v: result.unanswered, s: "" },
  ];
  nums.forEach(function (el, i) {
    var t = targets[i];
    if (t) animateNumber(el, t.v, t.s, 900);
  });

  document.getElementById("btn-restart").addEventListener("click", function () {
    App.resetProgress(bankId);
    localStorage.removeItem(App.resultKey(bankId));
    var url = "quiz.html?bank=" + encodeURIComponent(bankId);
    if (result.mode && result.mode !== "all") {
      url += "&mode=" + encodeURIComponent(result.mode);
      if (result.mode === "chapter" && result.chapter) {
        url += "&chapter=" + encodeURIComponent(result.chapter);
      }
    }
    location.href = url;
  });
})();
