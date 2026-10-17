/* ===== 异常题清单页 ===== */
(function () {
  "use strict";

  var App = window.App;
  var bodyEl = document.getElementById("abnormal-body");
  var banks = App.getAllBanks();

  var html = "";
  var total = 0;

  banks.forEach(function (bank) {
    var abnormalList = bank.questions.filter(function (q) { return q.abnormal; });
    if (abnormalList.length === 0) return;

    total += abnormalList.length;
    var items = "";
    abnormalList.forEach(function (q) {
      items +=
        '<div class="wrong-item">' +
          '<p class="wi-title">题号 ' + q.id + ' · ' + App.escapeHtml(q.typeName) + "</p>" +
          '<div class="wi-stem">' + App.markdownToHtml(q.stem, true) + "</div>" +
          '<p class="wi-line" style="color:var(--red);">问题：' + App.escapeHtml(q.reason) + "</p>" +
        "</div>";
    });

    html += '<div class="card"><p class="group-title">' + App.escapeHtml(bank.name) + "</p>" + items + "</div>";
  });

  if (total === 0) {
    bodyEl.innerHTML = '<div class="card"><div class="empty-tip">没有异常题，题库很干净！</div></div>';
    return;
  }

  bodyEl.innerHTML =
    '<div class="notice">共 ' + total + ' 道异常题，答题时已自动跳过。题目内容保持不变，仅在此列出供核对。</div>' + html;
})();
