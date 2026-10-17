/* ===== 错题本 ===== */
(function () {
  "use strict";

  var App = window.App;
  var bodyEl = document.getElementById("wrong-body");
  var searchEl = document.getElementById("search");
  var chapterEl = document.getElementById("chapter-filter");
  var exportBtn = document.getElementById("export-btn");

  var banks = window.QUESTION_BANKS || [];

  // 收集所有错题 [{bank, q, attempts, wrongAt, yourAnswer}]
  function collectWrong() {
    var result = [];
    banks.forEach(function (bank) {
      var map = App.getWrong(bank.id);
      var progress = App.getProgress(bank.id);
      var byId = {};
      App.validQuestions(bank).forEach(function (q) { byId[q.id] = q; });
      Object.keys(map).forEach(function (qid) {
        var q = byId[Number(qid)];
        if (!q) return;
        var rec = progress.answered[Number(qid)];
        result.push({
          bank: bank,
          q: q,
          attempts: map[qid].attempts || 0,
          wrongAt: map[qid].wrongAt || 0,
          yourAnswer: rec ? rec.selected : null,
        });
      });
    });
    result.sort(function (a, b) {
      if (a.bank.id !== b.bank.id) return a.bank.id < b.bank.id ? -1 : 1;
      return a.q.id - b.q.id;
    });
    return result;
  }

  // 章节下拉
  var chapterSet = {};
  banks.forEach(function (bank) {
    App.getChapters(bank).forEach(function (c) { chapterSet[c.name] = true; });
  });
  Object.keys(chapterSet).forEach(function (name) {
    var opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    chapterEl.appendChild(opt);
  });

  function filterList() {
    var keyword = searchEl.value.trim().toLowerCase();
    var ch = chapterEl.value;
    return collectWrong().filter(function (item) {
      if (ch && item.q.chapter !== ch) return false;
      if (keyword && item.q.stem.toLowerCase().indexOf(keyword) < 0) return false;
      return true;
    });
  }

  function wrongItemHtml(item, keyword) {
    var q = item.q;
    var your = item.yourAnswer ? item.yourAnswer.join("、") : "未记录";
    return (
      '<div class="wrong-item">' +
        '<p class="wi-title">题号 ' + q.id + ' · ' + App.escapeHtml(q.typeName) +
          (q.chapter ? ' · ' + App.escapeHtml(q.chapter) : "") +
          ' · 重做 ' + item.attempts + ' 次' +
          '<button class="remove-btn" data-bank="' + item.bank.id + '" data-qid="' + q.id + '">移出</button>' +
        "</p>" +
        '<div class="wi-stem">' + App.highlight(App.markdownToHtml(q.stem, true), keyword) + "</div>" +
        '<p class="wi-line"><span class="your">你的答案：' + App.escapeHtml(your) + "</span></p>" +
        '<p class="wi-line"><span class="right">正确答案：' + App.escapeHtml(q.answer.join("、")) + "</span></p>" +
        (q.analysis ? '<p class="wi-line">解析：' + App.highlight(App.markdownToHtml(q.analysis, false), keyword) + "</p>" : "") +
      "</div>"
    );
  }

  function render() {
    var list = filterList();
    var keyword = searchEl.value.trim();
    var ch = chapterEl.value;

    if (list.length === 0) {
      bodyEl.innerHTML =
        '<div class="card"><div class="empty-tip">' +
        (keyword || ch ? "没有符合条件的错题。" : "错题本是空的，太棒了！") +
        "</div></div>";
      return;
    }

    var html = "";
    var curBank = "";
    list.forEach(function (item) {
      if (item.bank.name !== curBank) {
        if (curBank) html += "</div>";
        curBank = item.bank.name;
        html += '<div class="card"><p class="group-title">' + App.escapeHtml(curBank) + "</p>";
      }
      html += wrongItemHtml(item, keyword);
    });
    html += "</div>";
    bodyEl.innerHTML = html;
  }

  // 移出
  bodyEl.addEventListener("click", function (e) {
    var btn = e.target.closest(".remove-btn");
    if (!btn) return;
    var bankId = btn.getAttribute("data-bank");
    var qid = Number(btn.getAttribute("data-qid"));
    if (confirm("确定把这道题移出错题本吗？")) {
      App.removeWrong(bankId, qid);
      render();
    }
  });

  searchEl.addEventListener("input", render);
  chapterEl.addEventListener("change", render);

  // 导出
  function plain(s) {
    return String(s || "")
      .replace(/```[a-z]*/gi, "")
      .replace(/`/g, "")
      .replace(/\*\*/g, "")
      .trim();
  }

  function exportText(list) {
    var lines = [];
    var curBank = "";
    var n = 0;
    list.forEach(function (item) {
      if (item.bank.name !== curBank) {
        curBank = item.bank.name;
        lines.push("");
        lines.push("【" + curBank + "】");
      }
      n++;
      lines.push(n + ". [" + item.q.typeName + "] " + plain(item.q.stem));
      lines.push("   正确答案：" + item.q.answer.join("、"));
      if (item.yourAnswer) lines.push("   你的答案：" + item.yourAnswer.join("、"));
      lines.push("   解析：" + plain(item.q.analysis || "（无）"));
    });
    return "错题本导出（共 " + n + " 道）\n" + lines.join("\n");
  }

  exportBtn.addEventListener("click", function () {
    var list = filterList();
    if (list.length === 0) {
      alert("没有可导出的错题。");
      return;
    }
    var text = exportText(list);
    var blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "错题本.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  render();
})();
