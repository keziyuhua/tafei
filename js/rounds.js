/* ===== 练习记录（每一轮交卷的完整记录，可回看、可刷该轮错题） ===== */
(function () {
  "use strict";

  var App = window.App;
  var bodyEl = document.getElementById("rounds-body");
  var bankParam = App.getParam("bank");

  var banks = App.getAllBanks().filter(function (b) {
    return !bankParam || b.id === bankParam;
  });

  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function fmtDateTime(ts) {
    var d = new Date(ts);
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
      " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  function modeName(m, ch) {
    if (m === "wrong") return "错题";
    if (m === "fav") return "收藏";
    if (m === "chapter") return ch || "章节";
    if (m === "type") return "题型";
    if (m === "round") return "该轮错题";
    return "全部题目";
  }

  // 收集所有轮次（含题库信息），按时间倒序
  function collectRounds() {
    var list = [];
    banks.forEach(function (bank) {
      App.getRounds(bank.id).forEach(function (r) {
        list.push({ bank: bank, round: r });
      });
    });
    list.sort(function (a, b) { return b.round.t - a.round.t; });
    return list;
  }

  // 渲染单道题的作答详情（只读，标出正确答案、答错标红）
  function detailItemHtml(d, idx) {
    var status = "";
    if (d.correct === true) status = '<span class="tag tag-single">答对</span>';
    else if (d.correct === false) status = '<span class="tag" style="color:var(--red);border-color:#fecaca;background:var(--red-weak);">答错</span>';
    else status = '<span class="tag">未答</span>';

    var opts = "";
    (d.options || []).forEach(function (o) {
      var cls = "option locked";
      if (d.answer && d.answer.indexOf(o.key) >= 0) cls += " correct";
      else if (d.selected && d.selected.indexOf(o.key) >= 0) cls += " wrong";
      opts +=
        '<div class="' + cls + '">' +
          '<span class="key">' + App.escapeHtml(o.key) + "</span>" +
          '<span class="opt-text">' + App.markdownToHtml(o.text, false) + "</span>" +
        "</div>";
    });

    var your = (d.selected && d.selected.length) ? d.selected.join("、") : "未答";
    var right = (d.answer && d.answer.length) ? d.answer.join("、") : "—";

    return (
      '<div class="wrong-item">' +
        '<p class="wi-title">第 ' + (idx + 1) + ' 题 · 题号 ' + d.qid + " · " + App.escapeHtml(d.typeName) + " " + status + "</p>" +
        (d.stem ? '<div class="wi-stem">' + App.markdownToHtml(d.stem, true) + "</div>" : "") +
        opts +
        '<p class="wi-line"><span class="your">你的答案：' + App.escapeHtml(your) + "</span></p>" +
        '<p class="wi-line"><span class="right">正确答案：' + App.escapeHtml(right) + "</span></p>" +
        (d.analysis ? '<p class="wi-line">解析：' + App.markdownToHtml(d.analysis, false) + "</p>" : "") +
      "</div>"
    );
  }

  function render() {
    var list = collectRounds();

    if (list.length === 0) {
      bodyEl.innerHTML =
        '<div class="card"><div class="empty-tip">还没有练习记录。<br>进入题库刷题并交卷后，每一轮都会自动保存到这里。</div></div>';
      return;
    }

    var html = "";
    var lastBankId = null;
    list.forEach(function (item, i) {
      var bank = item.bank;
      var r = item.round;
      if (bank.id !== lastBankId) {
        if (lastBankId !== null) html += "</div>";
        html += '<div class="card"><p class="group-title">' + App.escapeHtml(bank.name) + "</p>";
        lastBankId = bank.id;
      }

      var wrongIds = App.roundWrongIds(r);
      html +=
        '<div class="round-item" data-i="' + i + '">' +
          '<div class="round-head">' +
            '<span class="round-time">' + fmtDateTime(r.t) + "</span>" +
            '<span class="round-rate ' + (r.rate >= 60 ? "good" : "bad") + '">' + r.rate + "%</span>" +
          "</div>" +
          '<div class="round-meta">' + App.escapeHtml(modeName(r.mode, r.chapter)) +
            " · 答对 " + r.correct + " / 答错 " + r.wrong + " / 未答 " + r.unanswered +
            " · 用时 " + App.formatTime(r.totalTime || 0) + "</div>" +
          '<div class="round-detail" style="display:none;"></div>' +
        "</div>";
    });
    html += "</div>";

    bodyEl.innerHTML = html;

    // 展开/收起详情
    bodyEl.querySelectorAll(".round-item").forEach(function (itemEl) {
      itemEl.addEventListener("click", function (e) {
        // 点击"刷该轮错题"按钮时不切换展开
        if (e.target.closest("[data-action]")) return;
        var detailEl = itemEl.querySelector(".round-detail");
        if (detailEl.style.display === "none") {
          openDetail(itemEl, detailEl);
        } else {
          detailEl.style.display = "none";
          detailEl.innerHTML = "";
        }
      });
    });
  }

  function openDetail(itemEl, detailEl) {
    var i = parseInt(itemEl.getAttribute("data-i"), 10);
    var item = collectRounds()[i];
    var r = item.round;
    var wrongIds = App.roundWrongIds(r);

    var head =
      '<div class="round-detail-head">' +
        '<p class="wi-line">本轮共 ' + r.total + " 题，答对 " + r.correct + "，答错 " + r.wrong + "，未答 " + r.unanswered + "</p>" +
        (wrongIds.length > 0
          ? '<a class="btn btn-primary" data-action="redo" style="margin-bottom:12px;" ' +
              'href="quiz.html?bank=' + encodeURIComponent(item.bank.id) +
              '&mode=round&round=' + r.id + '">刷本轮的错题（' + wrongIds.length + "）</a>"
          : '<p class="empty-tip">本轮没有错题，全对！</p>') +
      "</div>";

    var items = "";
    r.detail.forEach(function (d, idx) { items += detailItemHtml(d, idx); });

    detailEl.innerHTML = head + items;
    detailEl.style.display = "block";
  }

  render();
})();
