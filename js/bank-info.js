/* ===== 题库信息页 ===== */
(function () {
  "use strict";

  var App = window.App;
  var bankId = App.getParam("bank");
  var bank = App.getBank(bankId);
  var titleEl = document.getElementById("info-title");
  var bodyEl = document.getElementById("info-body");

  if (!bank) {
    titleEl.textContent = "题库信息";
    bodyEl.innerHTML = '<div class="card"><div class="empty-tip">题库不存在。</div></div>';
    return;
  }

  titleEl.textContent = bank.name;

  var valid = App.validQuestions(bank);
  var abnormalList = bank.questions.filter(function (q) { return q.abnormal; });

  var typeNames = { single: "单选题", multiple: "多选题", judge: "判断题" };
  var typeCount = { single: 0, multiple: 0, judge: 0 };
  bank.questions.forEach(function (q) { typeCount[q.type] = (typeCount[q.type] || 0) + 1; });

  var chapters = App.getChapters(bank);

  var html = '<div class="card">';
  html += '<p class="group-title">' + App.escapeHtml(bank.name) +
    (bank.custom ? '<span class="tag" style="color:#9333ea;border-color:#e9d5ff;background:#faf5ff;margin-left:8px;">导入</span>' : "") +
    "</p>";

  html += '<div class="result-stats">' +
    '<div class="stat"><div class="stat-num">' + bank.questions.length + '</div><div class="stat-label">总题数</div></div>' +
    '<div class="stat green"><div class="stat-num">' + valid.length + '</div><div class="stat-label">有效题</div></div>' +
    '<div class="stat red"><div class="stat-num">' + abnormalList.length + '</div><div class="stat-label">异常题</div></div>' +
    '<div class="stat"><div class="stat-num">' + chapters.length + '</div><div class="stat-label">章节数</div></div>' +
    "</div>";

  // 题型分布
  var typeRows = "";
  Object.keys(typeNames).forEach(function (t) {
    typeRows += '<div class="daily-row"><span class="daily-date">' + typeNames[t] + '</span>' +
      '<span class="daily-count">' + typeCount[t] + ' 题</span></div>';
  });
  html += '<p class="sub-title">题型分布</p>' + typeRows;

  // 章节分布
  var chapterRows = "";
  chapters.forEach(function (c) {
    chapterRows += '<div class="daily-row"><span class="daily-date">' + App.escapeHtml(c.name) + '</span>' +
      '<span class="daily-count">' + c.count + ' 题</span></div>';
  });
  html += '<p class="sub-title">章节分布</p>' + chapterRows;

  // 异常题
  if (abnormalList.length > 0) {
    html += '<p class="sub-title">异常题（答题时跳过）</p>';
    abnormalList.forEach(function (q) {
      html += '<div class="daily-row"><span class="daily-date">题号 ' + q.id + '</span>' +
        '<span class="daily-count">' + App.escapeHtml(q.typeName) + '</span>' +
        '<span class="daily-rate" style="color:var(--red);">' + App.escapeHtml(q.reason) + '</span></div>';
    });
  }

  html += '<div class="btn-row"><a class="btn btn-primary" href="quiz.html?bank=' + encodeURIComponent(bankId) + '">开始刷题</a></div>';
  html += "</div>";

  bodyEl.innerHTML = html;
})();
