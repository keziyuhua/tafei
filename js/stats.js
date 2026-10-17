/* ===== 学习统计 ===== */
(function () {
  "use strict";

  var App = window.App;
  var bodyEl = document.getElementById("stats-body");
  var banks = window.QUESTION_BANKS || [];

  function formatDuration(sec) {
    sec = Math.max(0, Math.floor(sec));
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec % 60;
    if (h > 0) return h + " 小时 " + m + " 分";
    if (m > 0) return m + " 分 " + s + " 秒";
    return s + " 秒";
  }

  function fmtDate(ts) {
    var d = new Date(ts);
    var mm = d.getMonth() + 1;
    var dd = d.getDate();
    return mm + "/" + dd;
  }

  // 成绩趋势折线图（SVG）
  function trendChart(history) {
    if (history.length < 2) return "";
    var rates = history.map(function (e) { return e.rate; });
    var w = 600, h = 160, padL = 28, padR = 10, padT = 10, padB = 20;
    var n = rates.length;
    var innerW = w - padL - padR;
    var innerH = h - padT - padB;
    var x = function (i) { return padL + (n === 1 ? 0 : innerW * i / (n - 1)); };
    var y = function (r) { return padT + innerH * (1 - r / 100); };

    var pts = rates.map(function (r, i) { return x(i).toFixed(1) + "," + y(r).toFixed(1); }).join(" ");

    var svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" role="img">';
    // 网格
    [0, 50, 100].forEach(function (v) {
      var gy = y(v);
      svg += '<line x1="' + padL + '" y1="' + gy + '" x2="' + (w - padR) + '" y2="' + gy + '" stroke="#e5e7eb" stroke-width="0.5"/>';
      svg += '<text x="' + (padL - 4) + '" y="' + (gy + 4) + '" font-size="10" fill="#9ca3af" text-anchor="end">' + v + '%</text>';
    });
    // 折线
    svg += '<polyline points="' + pts + '" fill="none" stroke="#2563eb" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
    // 点
    rates.forEach(function (r, i) {
      svg += '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(r).toFixed(1) + '" r="3" fill="#2563eb"/>';
    });
    svg += '</svg>';
    return svg;
  }

  // 每日刷题数量列表
  function dailyList(history) {
    var map = {};
    history.forEach(function (e) {
      var d = new Date(e.t);
      var key = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
      if (!map[key]) map[key] = { ts: e.t, count: 0, correct: 0 };
      map[key].count += (e.answered != null ? e.answered : e.total);
      map[key].correct += e.correct;
    });
    var keys = Object.keys(map).sort();
    if (keys.length === 0) return "";
    var rows = keys.map(function (k) {
      var it = map[k];
      var r = it.count > 0 ? Math.round(it.correct / it.count * 100) : 0;
      return '<div class="daily-row"><span class="daily-date">' + fmtDate(it.ts) + '</span>' +
        '<span class="daily-count">' + it.count + ' 题</span>' +
        '<span class="daily-rate">正确率 ' + r + '%</span></div>';
    }).join("");
    return '<p class="sub-title">每日刷题</p>' + rows;
  }

  function renderBank(bank) {
    var valid = App.validQuestions(bank);
    var byId = {};
    valid.forEach(function (q) { byId[q.id] = q; });

    var progress = App.getProgress(bank.id);
    var answered = progress.answered || {};
    var history = App.getHistory(bank.id);
    var wrongCount = App.wrongCount(bank.id);
    var total = valid.length;

    var done = Object.keys(answered).length;
    var correct = 0;
    Object.keys(answered).forEach(function (k) { if (answered[k].correct) correct++; });
    var rate = done > 0 ? Math.round(correct / done * 100) : 0;
    var wrongRate = done > 0 ? Math.round((done - correct) / done * 100) : 0;
    var totalTime = 0;
    history.forEach(function (h) { totalTime += (h.totalTime || 0); });

    // 按题型
    var typeNames = { single: "单选题", multiple: "多选题", judge: "判断题" };
    var typeStat = { single: { d: 0, c: 0 }, multiple: { d: 0, c: 0 }, judge: { d: 0, c: 0 } };
    Object.keys(answered).forEach(function (k) {
      var q = byId[Number(k)];
      if (!q) return;
      var s = typeStat[q.type];
      if (!s) return;
      s.d++;
      if (answered[k].correct) s.c++;
    });

    // 按章节
    var chapterStat = {};
    valid.forEach(function (q) {
      var c = q.chapter || "默认";
      if (!chapterStat[c]) chapterStat[c] = { done: 0, total: 0 };
      chapterStat[c].total++;
      if (answered[q.id]) chapterStat[c].done++;
    });

    var html = '<div class="card">';
    html += '<p class="group-title">' + App.escapeHtml(bank.name) + "</p>";

    html += '<div class="result-stats">' +
      '<div class="stat blue"><div class="stat-num">' + rate + '%</div><div class="stat-label">正确率</div></div>' +
      '<div class="stat"><div class="stat-num">' + done + '/' + total + '</div><div class="stat-label">已做/总数</div></div>' +
      '<div class="stat red"><div class="stat-num">' + wrongRate + '%</div><div class="stat-label">错题率</div></div>' +
      '<div class="stat"><div class="stat-num">' + formatDuration(totalTime) + '</div><div class="stat-label">总时长</div></div>' +
      "</div>";

    if (done === 0) {
      html += '<div class="empty-tip">还没有刷题记录，去刷几道题再来看看统计吧。</div>';
      html += "</div>";
      return html;
    }

    // 按题型正确率
    var typeRows = "";
    Object.keys(typeNames).forEach(function (t) {
      var s = typeStat[t];
      if (s.d === 0) return;
      var r = Math.round(s.c / s.d * 100);
      typeRows += '<div class="daily-row"><span class="daily-date">' + typeNames[t] + '</span>' +
        '<span class="daily-count">' + s.c + '/' + s.d + '</span>' +
        '<span class="daily-rate">' + r + '%</span></div>';
    });
    if (typeRows) html += '<p class="sub-title">按题型正确率</p>' + typeRows;

    // 按章节进度
    var chapterRows = "";
    Object.keys(chapterStat).forEach(function (c) {
      var s = chapterStat[c];
      var pct = s.total > 0 ? Math.round(s.done / s.total * 100) : 0;
      chapterRows += '<div class="chapter-row"><div class="chapter-row-head"><span>' + App.escapeHtml(c) + '</span>' +
        '<span class="daily-rate">' + s.done + '/' + s.total + '</span></div>' +
        '<div class="progress-wrap"><div class="progress-bar" style="width:' + pct + '%;"></div></div></div>';
    });
    if (chapterRows) html += '<p class="sub-title">按章节进度</p>' + chapterRows;

    // 成绩趋势
    var chart = trendChart(history);
    if (chart) {
      html += '<p class="sub-title">成绩趋势（最近 ' + history.length + ' 次）</p>' + chart;
    }

    // 每日刷题
    var daily = dailyList(history);
    if (daily) html += daily;

    html += "</div>";
    return html;
  }

  var hasAny = false;
  var html = "";
  banks.forEach(function (bank) {
    var p = App.getProgress(bank.id);
    var h = App.getHistory(bank.id);
    if (Object.keys(p.answered || {}).length > 0 || h.length > 0) {
      hasAny = true;
      html += renderBank(bank);
    }
  });

  if (!hasAny) {
    bodyEl.innerHTML = '<div class="card"><div class="empty-tip">暂无任何刷题记录。<br>先去刷几道题，这里会显示正确率、章节进度、成绩趋势等统计。</div></div>';
  } else {
    bodyEl.innerHTML = html;
  }
})();
