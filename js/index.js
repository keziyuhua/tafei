/* ===== 首页：题库列表 + 刷题入口 ===== */
(function () {
  "use strict";

  var App = window.App;
  var listEl = document.getElementById("bank-list");
  var searchEl = document.getElementById("bank-search");
  var switchEl = document.getElementById("bank-switch");
  var versionEl = document.getElementById("version-note");

  var banks = App.getAllBanks();

  if (!banks.length) {
    listEl.innerHTML = '<div class="empty-tip">题库数据加载失败，请确认 js/data.js 文件存在。</div>';
    return;
  }

  function pct(n, d) {
    return d > 0 ? Math.round((n / d) * 100) : 0;
  }

  // 初始化题库范围下拉（用于限定搜索范围，不跳转）
  banks.forEach(function (bank) {
    var opt = document.createElement("option");
    opt.value = bank.id;
    opt.textContent = bank.name;
    switchEl.appendChild(opt);
  });
  switchEl.addEventListener("change", function () {
    render();
  });

  // 版本号
  var ver = App.getVersion();
  versionEl.textContent = ver ? "题库数据版本：" + ver : "";

  function render() {
    var keyword = searchEl.value.trim();
    var bankScope = switchEl.value;
    if (keyword || bankScope) {
      renderSearch(keyword, bankScope);
      return;
    }

    var html = "";

    banks.forEach(function (bank) {
      var questions = App.validQuestions(bank);
      var total = questions.length;
      var skipped = bank.questions.length - total;
      var p = App.getProgress(bank.id);
      var answeredCount = Object.keys(p.answered).length;
      var correctCount = p.correctCount;
      var wrongCount = App.wrongCount(bank.id);
      var favCount = App.getFav(bank.id).length;
      var roundCount = App.roundsCount(bank.id);
      var chapters = App.getChapters(bank);
      var donePct = pct(answeredCount, total);
      var rate = pct(correctCount, answeredCount);
      var hasProgress = answeredCount > 0;

      var skippedNote = skipped > 0
        ? '<span class="tag">跳过 ' + skipped + ' 道异常题</span>'
        : "";
      var customNote = bank.custom ? '<span class="tag" style="color:#9333ea;border-color:#e9d5ff;background:#faf5ff;">导入</span>' : "";

      // 章节下拉
      var chapterHtml = "";
      if (chapters.length > 1) {
        var items = "";
        chapters.forEach(function (c) {
          items +=
            '<a class="chapter-item" href="quiz.html?bank=' + encodeURIComponent(bank.id) +
            '&mode=chapter&chapter=' + encodeURIComponent(c.name) + '">' +
            App.escapeHtml(c.name) + '<span class="count">' + c.count + ' 题</span></a>';
        });
        chapterHtml = '<details class="chapter-panel"><summary class="bank-btn">按章节刷</summary>' + items + '</details>';
      }

      // 题型下拉
      var typeNames = { single: "单选题", multiple: "多选题", judge: "判断题" };
      var typeItems = "";
      Object.keys(typeNames).forEach(function (t) {
        typeItems +=
          '<a class="chapter-item" href="quiz.html?bank=' + encodeURIComponent(bank.id) +
          '&mode=type&type=' + t + '">' + typeNames[t] + "</a>";
      });
      var typeHtml = '<details class="chapter-panel"><summary class="bank-btn">按题型刷</summary>' + typeItems + '</details>';

      var delHtml = bank.custom
        ? '<button class="bank-btn danger" data-action="del" data-bank="' + bank.id + '">删除题库</button>'
        : "";

      html +=
        '<div class="bank-card" style="cursor:default;">' +
          '<a class="bank-name-link" href="bank-info.html?bank=' + encodeURIComponent(bank.id) + '">' +
            App.escapeHtml(bank.name) + '</a>' + customNote +
          '<p class="bank-meta">共 ' + total + ' 题' + skippedNote + '　正确率 ' + rate + '%</p>' +
          '<div class="progress-wrap"><div class="progress-bar" style="width:' + donePct + '%;"></div></div>' +
          '<div class="bank-progress-text">已做 ' + answeredCount + ' / ' + total + '，答对 ' + correctCount + ' 题</div>' +
          '<div class="bank-actions">' +
            '<a class="bank-btn primary" href="quiz.html?bank=' + encodeURIComponent(bank.id) + '">' +
              (hasProgress ? '继续刷题' : '开始刷题') + '</a>' +
            '<a class="bank-btn" href="quiz.html?bank=' + encodeURIComponent(bank.id) + '&mode=wrong&fresh=1">' +
              '刷错题 (' + wrongCount + ')</a>' +
            '<a class="bank-btn" href="quiz.html?bank=' + encodeURIComponent(bank.id) + '&mode=fav">' +
              '刷收藏 (' + favCount + ')</a>' +
            '<a class="bank-btn" href="quiz.html?bank=' + encodeURIComponent(bank.id) + '&mode=all&shuffle=1">随机刷题</a>' +
            '<a class="bank-btn" href="rounds.html?bank=' + encodeURIComponent(bank.id) + '">练习记录 (' + roundCount + ')</a>' +
            '<button class="bank-btn danger" data-action="reset" data-bank="' + bank.id + '">清空进度</button>' +
            delHtml +
          '</div>' +
          chapterHtml + typeHtml +
        '</div>';
    });

    if (html === "") {
      listEl.innerHTML = '<div class="empty-tip">暂无题库。</div>';
    } else {
      listEl.innerHTML = html;
    }
  }

  // 题目搜索：按题干关键词 + 题库范围搜索题目
  function renderSearch(keyword, bankScope) {
    var lower = keyword.toLowerCase();
    var scope = banks.filter(function (b) { return !bankScope || b.id === bankScope; });
    var results = [];
    scope.forEach(function (bank) {
      App.validQuestions(bank).forEach(function (q) {
        if (!lower || q.stem.toLowerCase().indexOf(lower) >= 0) {
          results.push({ bank: bank, q: q });
        }
      });
    });

    if (results.length === 0) {
      listEl.innerHTML = '<div class="empty-tip">' + (lower ? "没有找到相关题目。" : "该题库暂无题目。") + "</div>";
      return;
    }

    var total = results.length;
    if (results.length > 50) results = results.slice(0, 50);

    var html = '<p class="search-count">' +
      (lower ? "找到 " + total + " 道相关题目" : "共 " + total + " 道题目") +
      (total > 50 ? "（仅显示前 50 道）" : "") + "</p>";
    results.forEach(function (r) {
      html +=
        '<a class="bank-card search-result" href="quiz.html?bank=' + encodeURIComponent(r.bank.id) + '&goto=' + r.q.id + '">' +
          '<p class="bank-name">' + App.escapeHtml(r.bank.name) + ' · 题号 ' + r.q.id +
            ' · ' + App.escapeHtml(r.q.typeName) + "</p>" +
          '<div class="wi-stem">' + App.highlight(App.markdownToHtml(r.q.stem, true), keyword) + "</div>" +
        "</a>";
    });
    listEl.innerHTML = html;
  }

  render();

  // 搜索
  searchEl.addEventListener("input", render);

  // 事件委托：清空进度、删除自定义题库
  listEl.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-action]");
    if (!btn) return;
    var id = btn.getAttribute("data-bank");
    var action = btn.getAttribute("data-action");
    if (action === "reset") {
      if (confirm("确定清空该题库的答题进度和错题记录吗？收藏不会被清除。")) {
        App.resetProgress(id);
        App.resetWrong(id);
        location.reload();
      }
    } else if (action === "del") {
      if (confirm("确定删除这个导入的题库吗？相关答题记录也会清除。")) {
        App.deleteCustomBank(id);
        App.resetProgress(id);
        App.resetWrong(id);
        App.resetFav(id);
        App.resetMarks(id);
        App.resetHistory(id);
        localStorage.removeItem(App.resultKey(id));
        location.reload();
      }
    }
  });

  // ===== 设置面板 =====
  var settingsMask = document.getElementById("settings-mask");
  var btnSettings = document.getElementById("btn-settings");
  var segs = {
    theme: document.getElementById("theme-seg"),
    fontSize: document.getElementById("font-seg"),
    bigButton: document.getElementById("bigbtn-seg"),
    sound: document.getElementById("sound-seg"),
  };

  function syncSegActive() {
    var s = App.getSettings();
    segs.theme.querySelectorAll("button").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-theme") === s.theme);
    });
    segs.fontSize.querySelectorAll("button").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-font") === s.fontSize);
    });
    segs.bigButton.querySelectorAll("button").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-bigbtn") === (s.bigButton ? "1" : "0"));
    });
    segs.sound.querySelectorAll("button").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-sound") === (s.sound ? "1" : "0"));
    });
  }

  btnSettings.addEventListener("click", function () {
    syncSegActive();
    settingsMask.style.display = "flex";
  });
  document.getElementById("settings-close").addEventListener("click", function () {
    settingsMask.style.display = "none";
  });
  settingsMask.addEventListener("click", function (e) {
    if (e.target === settingsMask) settingsMask.style.display = "none";
  });

  segs.theme.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    App.updateSetting("theme", b.getAttribute("data-theme"));
    syncSegActive();
  });
  segs.fontSize.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    App.updateSetting("fontSize", b.getAttribute("data-font"));
    syncSegActive();
  });
  segs.bigButton.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    App.updateSetting("bigButton", b.getAttribute("data-bigbtn") === "1");
    syncSegActive();
  });
  segs.sound.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    App.updateSetting("sound", b.getAttribute("data-sound") === "1");
    syncSegActive();
  });
})();
