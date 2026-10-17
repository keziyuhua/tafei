/* ===== 收藏列表 ===== */
(function () {
  "use strict";

  var App = window.App;
  var bodyEl = document.getElementById("fav-body");
  var exportBtn = document.getElementById("export-btn");

  var banks = window.QUESTION_BANKS || [];

  function flagLabel(flag) {
    if (flag === "mastered") return "已掌握";
    if (flag === "doubt") return "有疑问";
    return "标记";
  }
  function flagCls(flag) {
    if (flag === "mastered") return "flag-mastered";
    if (flag === "doubt") return "flag-doubt";
    return "";
  }

  // 收集所有收藏 [{bank, q, note, flag}]
  function collectFav() {
    var result = [];
    banks.forEach(function (bank) {
      var favList = App.getFav(bank.id);
      var byId = {};
      App.validQuestions(bank).forEach(function (q) { byId[q.id] = q; });
      favList.forEach(function (qid) {
        var q = byId[qid];
        if (!q) return;
        var mark = App.getMark(bank.id, qid);
        result.push({ bank: bank, q: q, note: mark.note || "", flag: mark.flag || "" });
      });
    });
    result.sort(function (a, b) {
      if (a.bank.id !== b.bank.id) return a.bank.id < b.bank.id ? -1 : 1;
      return a.q.id - b.q.id;
    });
    return result;
  }

  function itemHtml(item) {
    var q = item.q;
    return (
      '<div class="wrong-item" data-bank="' + item.bank.id + '" data-qid="' + q.id + '">' +
        '<p class="wi-title">题号 ' + q.id + ' · ' + App.escapeHtml(q.typeName) +
          (q.chapter ? ' · ' + App.escapeHtml(q.chapter) : "") +
          '<button class="remove-btn" data-action="unfav">取消收藏</button>' +
        "</p>" +
        '<div class="wi-stem">' + App.markdownToHtml(q.stem, true) + "</div>" +
        '<p class="wi-line"><span class="right">正确答案：' + App.escapeHtml(q.answer.join("、")) + "</span></p>" +
        (q.analysis ? '<p class="wi-line">解析：' + App.markdownToHtml(q.analysis, false) + "</p>" : "") +
        '<div class="fav-meta">' +
          '<button class="icon-btn ' + flagCls(item.flag) + '" data-action="flag">' + flagLabel(item.flag) + "</button>" +
          '<label class="note-label">备注 <input class="note-input" type="text" value="' +
            App.escapeHtml(item.note) + '" placeholder="给这道题写点备注"></label>' +
        "</div>" +
      "</div>"
    );
  }

  function render() {
    var list = collectFav();
    if (list.length === 0) {
      bodyEl.innerHTML = '<div class="card"><div class="empty-tip">还没有收藏的题目。答题时点「☆ 收藏」即可加入。</div></div>';
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
      html += itemHtml(item);
    });
    html += "</div>";
    bodyEl.innerHTML = html;
  }

  // 事件委托：取消收藏、标记切换
  bodyEl.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-action]");
    if (!btn) return;
    var box = e.target.closest(".wrong-item");
    var bankId = box.getAttribute("data-bank");
    var qid = Number(box.getAttribute("data-qid"));
    var action = btn.getAttribute("data-action");
    if (action === "unfav") {
      if (confirm("确定取消收藏这道题吗？")) {
        App.toggleFav(bankId, qid);
        render();
      }
    } else if (action === "flag") {
      App.cycleFlag(bankId, qid);
      render();
    }
  });

  // 备注保存（失焦/回车）
  bodyEl.addEventListener("change", function (e) {
    if (e.target.classList.contains("note-input")) {
      var box = e.target.closest(".wrong-item");
      var bankId = box.getAttribute("data-bank");
      var qid = Number(box.getAttribute("data-qid"));
      App.setNote(bankId, qid, e.target.value);
    }
  });

  // 导出
  function plain(s) {
    return String(s || "").replace(/```[a-z]*/gi, "").replace(/`/g, "").replace(/\*\*/g, "").trim();
  }
  exportBtn.addEventListener("click", function () {
    var list = collectFav();
    if (list.length === 0) { alert("没有可导出的收藏。"); return; }
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
      if (item.flag) lines.push("   标记：" + (item.flag === "mastered" ? "已掌握" : "有疑问"));
      if (item.note) lines.push("   备注：" + item.note);
      lines.push("   解析：" + plain(item.q.analysis || "（无）"));
    });
    var text = "收藏导出（共 " + n + " 道）\n" + lines.join("\n");
    var blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "收藏.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  render();
})();
