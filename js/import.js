/* ===== 导入题库 ===== */
(function () {
  "use strict";

  var App = window.App;
  var nameEl = document.getElementById("bank-name");
  var mdEl = document.getElementById("bank-md");
  var btn = document.getElementById("import-btn");
  var msgEl = document.getElementById("import-msg");

  btn.addEventListener("click", function () {
    var name = nameEl.value.trim();
    var md = mdEl.value.trim();

    if (!md) {
      msgEl.textContent = "请先粘贴 Markdown 内容。";
      msgEl.style.color = "var(--red)";
      return;
    }

    var id = "custom_" + Date.now();
    var bank = App.parseMarkdownBank(md, id, name);

    if (bank.questions.length === 0) {
      msgEl.textContent = "没有解析到任何题目，请检查格式（每题以「### 题号. 题型」开头）。";
      msgEl.style.color = "var(--red)";
      return;
    }

    var abnormal = bank.questions.filter(function (q) { return q.abnormal; }).length;
    App.addCustomBank(bank);

    var info = "导入成功：「" + bank.name + "」共 " + bank.questions.length + " 题";
    if (abnormal > 0) info += "，其中 " + abnormal + " 道异常题（已自动跳过）";
    info += "。正在返回首页…";
    msgEl.textContent = info;
    msgEl.style.color = "var(--green)";

    setTimeout(function () {
      location.href = "index.html";
    }, 1200);
  });
})();
