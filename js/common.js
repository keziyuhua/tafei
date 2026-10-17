/* ===== 公共工具（无依赖、无 ES module，挂到 window.App） ===== */
(function () {
  "use strict";

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // 渲染代码块（raw 形如 "java\ncode...\n"）
  function renderCodeBlock(raw) {
    let code = raw;
    const nl = raw.indexOf("\n");
    if (nl >= 0) {
      const first = raw.slice(0, nl).trim();
      if (/^[a-zA-Z0-9+#.-]*$/.test(first)) {
        code = raw.slice(nl + 1);
      }
    }
    return "<pre><code>" + escapeHtml(code) + "</code></pre>";
  }

  // 渲染普通文本段（已转义），处理行内代码与加粗
  function renderInline(s) {
    return s
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  }

  function renderText(text, wrapParagraph) {
    text = escapeHtml(text);
    if (wrapParagraph) {
      const paras = text.split(/\n{2,}/);
      return paras
        .map(function (p) {
          p = p.replace(/\n/g, "<br>");
          return "<p>" + renderInline(p) + "</p>";
        })
        .join("");
    }
    return renderInline(text.replace(/\n/g, "<br>"));
  }

  // Markdown -> HTML（处理代码块 + 行内代码 + 加粗）
  function markdownToHtml(text, wrapParagraph) {
    if (text == null) return "";
    const parts = String(text).split(/```/);
    let html = "";
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 1) {
        html += renderCodeBlock(parts[i]);
      } else {
        html += renderText(parts[i], wrapParagraph === true);
      }
    }
    return html;
  }

  // 从 URL 读取参数
  function getParam(name) {
    const m = new RegExp("[?&]" + name + "=([^&]*)").exec(location.search);
    return m ? decodeURIComponent(m[1]) : "";
  }

  // 找题库（含自定义导入的题库）
  function getBank(id) {
    const banks = window.QUESTION_BANKS || [];
    for (let i = 0; i < banks.length; i++) {
      if (banks[i].id === id) return banks[i];
    }
    try {
      const raw = localStorage.getItem("custom_banks");
      if (raw) {
        const custom = JSON.parse(raw);
        if (Array.isArray(custom)) {
          for (let i = 0; i < custom.length; i++) {
            if (custom[i].id === id) return custom[i];
          }
        }
      }
    } catch (e) { /* 忽略 */ }
    return null;
  }

  // 过滤出有效题（跳过异常题）
  function validQuestions(bank) {
    return bank.questions.filter(function (q) {
      return !q.abnormal;
    });
  }

  // 判断答案对错：用户所选字母集合与正确答案集合完全一致
  function isCorrect(answer, selected) {
    const a = (answer || []).slice().sort().join("");
    const b = (selected || []).slice().sort().join("");
    return a === b;
  }

  // 洗牌（返回新数组）
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  // 秒数 -> MM:SS
  function formatTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return (m < 10 ? "0" + m : m) + ":" + (s < 10 ? "0" + s : s);
  }

  // ---- localStorage 读写 ----
  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }
  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* 存储满或隐私模式，忽略 */
    }
  }

  function progressKey(id) { return "progress_" + id; }
  function wrongKey(id) { return "wrong_" + id; }
  function favKey(id) { return "fav_" + id; }
  function marksKey(id) { return "marks_" + id; }
  function historyKey(id) { return "history_" + id; }
  function resultKey(id) { return "result_" + id; }
  function roundsKey(id) { return "rounds_" + id; }
  function settingsKey() { return "quiz_settings"; }

  function defaultProgress() {
    return {
      mode: "all", // all | wrong | fav | chapter | type | round
      chapter: "",
      order: [], // 本次答题的题号顺序（已过滤模式、已随机）
      current: 0, // order 的索引
      answered: {}, // 题号 -> { selected:[], correct:bool, time:秒 }
      selections: {}, // 题号 -> [选项字母]，未提交但已选的选择（翻题保留）
      correctCount: 0,
      timeSpent: 0, // 累计答题秒数
    };
  }

  window.App = {
    escapeHtml: escapeHtml,
    markdownToHtml: markdownToHtml,
    // 在已渲染的 HTML 中高亮关键词（用于搜索结果）
    highlight: function (html, keyword) {
      if (!keyword) return html;
      const esc = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp("(" + esc + ")", "gi");
      return html.replace(re, "<mark>$1</mark>");
    },
    getParam: getParam,
    getBank: getBank,
    validQuestions: validQuestions,
    isCorrect: isCorrect,
    shuffle: shuffle,
    formatTime: formatTime,

    // 是否为手机端（窄屏视为手机，桌面宽屏为电脑）
    isMobile: function () {
      try {
        return window.matchMedia("(max-width: 768px)").matches;
      } catch (e) {
        return window.innerWidth <= 768;
      }
    },

    // 获取题库的章节列表 [{name, count}]
    getChapters: function (bank) {
      const map = {};
      for (const q of bank.questions) {
        const c = q.chapter || "默认";
        map[c] = (map[c] || 0) + 1;
      }
      const list = [];
      for (const name in map) list.push({ name: name, count: map[name] });
      return list;
    },

    progressKey: progressKey,
    wrongKey: wrongKey,
    favKey: favKey,
    resultKey: resultKey,
    roundsKey: roundsKey,

    getProgress: function (id) {
      const p = readJSON(progressKey(id), null);
      if (!p || typeof p !== "object" || typeof p.answered !== "object") {
        return defaultProgress();
      }
      const d = defaultProgress();
      for (const k in d) if (p[k] === undefined) p[k] = d[k];
      if (typeof p.current !== "number") p.current = 0;
      if (typeof p.correctCount !== "number") p.correctCount = 0;
      if (!Array.isArray(p.order)) p.order = [];
      if (!p.selections || typeof p.selections !== "object" || Array.isArray(p.selections)) {
        p.selections = {};
      }
      return p;
    },
    saveProgress: function (id, p) { writeJSON(progressKey(id), p); },
    resetProgress: function (id) { localStorage.removeItem(progressKey(id)); },

    getWrong: function (id) {
      const w = readJSON(wrongKey(id), null);
      if (Array.isArray(w)) {
        // 旧数据迁移：数组 -> 对象
        const map = {};
        w.forEach(function (qid) { map[qid] = { attempts: 0, wrongAt: 0 }; });
        return map;
      }
      if (w && typeof w === "object") return w;
      return {};
    },
    saveWrong: function (id, map) { writeJSON(wrongKey(id), map); },
    resetWrong: function (id) { localStorage.removeItem(wrongKey(id)); },
    wrongCount: function (id) { return Object.keys(this.getWrong(id)).length; },
    hasWrong: function (id, qid) { return !!this.getWrong(id)[qid]; },
    // 记录一次错题（若已存在则不覆盖首次时间，重做次数由调用方维护）
    addWrong: function (id, qid) {
      const map = this.getWrong(id);
      if (!map[qid]) map[qid] = { attempts: 0, wrongAt: Date.now() };
      this.saveWrong(id, map);
      return map;
    },
    removeWrong: function (id, qid) {
      const map = this.getWrong(id);
      delete map[qid];
      this.saveWrong(id, map);
      return map;
    },

    getFav: function (id) {
      const f = readJSON(favKey(id), null);
      return Array.isArray(f) ? f : [];
    },
    saveFav: function (id, arr) { writeJSON(favKey(id), arr); },
    resetFav: function (id) { localStorage.removeItem(favKey(id)); },
    hasFav: function (id, qid) { return this.getFav(id).indexOf(qid) >= 0; },
    // 切换收藏，返回切换后是否已收藏
    toggleFav: function (id, qid) {
      const f = this.getFav(id);
      const i = f.indexOf(qid);
      if (i >= 0) f.splice(i, 1);
      else f.push(qid);
      this.saveFav(id, f);
      return i < 0;
    },

    marksKey: marksKey,
    // 题目标记：{ 题号: { note: 备注, flag: "mastered"|"doubt"|"" } }
    getMarks: function (id) {
      const m = readJSON(marksKey(id), null);
      return m && typeof m === "object" ? m : {};
    },
    saveMarks: function (id, map) { writeJSON(marksKey(id), map); },
    resetMarks: function (id) { localStorage.removeItem(marksKey(id)); },
    getMark: function (id, qid) {
      const m = this.getMarks(id)[qid];
      return m || { note: "", flag: "" };
    },
    setNote: function (id, qid, note) {
      const m = this.getMarks(id);
      const cur = m[qid] || { note: "", flag: "" };
      cur.note = note;
      m[qid] = cur;
      this.saveMarks(id, m);
    },
    // 切换标记状态：mastered -> doubt -> 无 -> mastered（循环）
    cycleFlag: function (id, qid) {
      const m = this.getMarks(id);
      const cur = m[qid] || { note: "", flag: "" };
      if (cur.flag === "") cur.flag = "mastered";
      else if (cur.flag === "mastered") cur.flag = "doubt";
      else cur.flag = "";
      m[qid] = cur;
      this.saveMarks(id, m);
      return cur.flag;
    },

    getResult: function (id) { return readJSON(resultKey(id), null); },
    saveResult: function (id, data) { writeJSON(resultKey(id), data); },

    historyKey: historyKey,
    getHistory: function (id) {
      const h = readJSON(historyKey(id), null);
      return Array.isArray(h) ? h : [];
    },
    saveHistory: function (id, arr) { writeJSON(historyKey(id), arr); },
    resetHistory: function (id) { localStorage.removeItem(historyKey(id)); },
    // 追加一条答题历史（交卷时调用）
    addHistory: function (id, entry) {
      let h = this.getHistory(id);
      h.push(entry);
      if (h.length > 200) h = h.slice(-200);
      this.saveHistory(id, h);
    },

    // ---- 练习轮次记录（每次交卷记一轮，含每题作答快照，可回看/刷该轮错题）----
    getRounds: function (id) {
      const r = readJSON(roundsKey(id), null);
      return Array.isArray(r) ? r : [];
    },
    saveRounds: function (id, arr) { writeJSON(roundsKey(id), arr); },
    resetRounds: function (id) { localStorage.removeItem(roundsKey(id)); },
    roundsCount: function (id) { return this.getRounds(id).length; },
    // 按 id 查找某轮记录
    getRound: function (id, roundId) {
      const rounds = this.getRounds(id);
      for (let i = 0; i < rounds.length; i++) {
        if (String(rounds[i].id) === String(roundId)) return rounds[i];
      }
      return null;
    },
    // 追加一轮（最新的在最前，便于回看；最多保留 50 轮）
    addRound: function (id, round) {
      let r = this.getRounds(id);
      r.unshift(round);
      if (r.length > 50) r = r.slice(0, 50);
      this.saveRounds(id, r);
    },
    // 取某一轮的错题题号列表（答错且已作答的题）
    roundWrongIds: function (round) {
      if (!round || !Array.isArray(round.detail)) return [];
      return round.detail
        .filter(function (d) { return d.correct === false; })
        .map(function (d) { return d.qid; });
    },

    settingsKey: settingsKey,
    getSettings: function () {
      const s = readJSON(settingsKey(), null);
      return Object.assign({ theme: "light", fontSize: "normal", bigButton: false, sound: true }, s || {});
    },
    saveSettings: function (s) { writeJSON(settingsKey(), s); },
    updateSetting: function (key, value) {
      const s = this.getSettings();
      s[key] = value;
      this.saveSettings(s);
      this.applySettings();
    },
    // 应用主题/字号/大按钮到页面根元素
    applySettings: function () {
      const s = this.getSettings();
      const root = document.documentElement;
      root.setAttribute("data-theme", s.theme === "dark" ? "dark" : "light");
      root.setAttribute("data-font", s.fontSize || "normal");
      root.setAttribute("data-bigbtn", s.bigButton ? "1" : "0");
    },

    // 题库版本号
    getVersion: function () { return window.QUESTION_BANKS_VERSION || ""; },

    // 自定义题库（导入的题库，存 localStorage）
    customKey: function () { return "custom_banks"; },
    getCustomBanks: function () {
      const b = readJSON(this.customKey(), null);
      return Array.isArray(b) ? b : [];
    },
    saveCustomBanks: function (arr) { writeJSON(this.customKey(), arr); },
    addCustomBank: function (bank) {
      const list = this.getCustomBanks().filter(function (b) { return b.id !== bank.id; });
      list.push(bank);
      this.saveCustomBanks(list);
    },
    deleteCustomBank: function (id) {
      const list = this.getCustomBanks().filter(function (b) { return b.id !== id; });
      this.saveCustomBanks(list);
    },
    // 合并内置题库 + 自定义题库
    getAllBanks: function () {
      return (window.QUESTION_BANKS || []).concat(this.getCustomBanks());
    },
  };

  // 前端解析 Markdown 题库（供导入使用），返回 bank 对象
  App.parseMarkdownBank = function (text, id, name) {
    var TYPE_MAP = { "单选题": "single", "多选题": "multiple", "判断题": "judge" };
    function parseAnswerLetters(t) {
      if (!t) return [];
      var letters = t.match(/[A-Za-z]/g);
      if (!letters) return [];
      return letters.map(function (c) { return c.toUpperCase(); });
    }
    function check(q) {
      var reasons = [];
      if (q.options.length === 0) reasons.push("无选项");
      if (q.answer.length === 0) reasons.push("无答案");
      if (q.options.length > 0 && q.answer.length > 0) {
        var keys = q.options.map(function (o) { return o.key; });
        for (var i = 0; i < q.answer.length; i++) {
          if (keys.indexOf(q.answer[i]) < 0) { reasons.push("答案字母 " + q.answer[i] + " 超出选项范围"); break; }
        }
        if (q.type === "multiple" && q.answer.length < 2) reasons.push("多选题答案少于 2 个");
        if (q.type === "judge" && (q.answer.length !== 1 || (q.answer[0] !== "A" && q.answer[0] !== "B"))) reasons.push("判断题答案应为单个 A 或 B");
      }
      return reasons;
    }

    var lines = String(text).split(/\r?\n/);
    if (!name) {
      for (var i = 0; i < lines.length; i++) {
        var m = lines[i].match(/^#\s+(.+)$/);
        if (m) { name = m[1].trim(); break; }
      }
      if (!name) name = id || "导入题库";
    }

    var questions = [];
    var cur = null, seg = "none", inCode = false, chapter = "";
    function pushLine(line) {
      if (!cur) return;
      if (seg === "stem") cur.stem += (cur.stem ? "\n" : "") + line;
      else if (seg === "option" && cur.options.length > 0) {
        cur.options[cur.options.length - 1].text += (cur.options[cur.options.length - 1].text ? "\n" : "") + line;
      } else if (seg === "answer") cur.answerRaw += (cur.answerRaw ? "\n" : "") + line;
      else if (seg === "analysis") cur.analysis += (cur.analysis ? "\n" : "") + line;
    }
    function finish() {
      if (!cur) return;
      if (cur.type === "judge" && cur.options.length === 0) {
        cur.options = [{ key: "A", text: "正确" }, { key: "B", text: "错误" }];
      }
      cur.stem = cur.stem.trim();
      cur.analysis = cur.analysis.trim();
      cur.options.forEach(function (o) { o.text = o.text.trim(); });
      cur.answer = parseAnswerLetters(cur.answerRaw);
      delete cur.answerRaw;
      var reasons = check(cur);
      cur.abnormal = reasons.length > 0;
      cur.reason = reasons.join("；");
      questions.push(cur);
      cur = null;
      seg = "none";
    }
    for (var j = 0; j < lines.length; j++) {
      var line = lines[j];
      var trimmed = line.trim();
      var qm = trimmed.match(/^###\s+(\d+)\.\s*(.+?)\s*$/);
      if (qm && !inCode) {
        finish();
        var typeName = qm[2];
        cur = { id: parseInt(qm[1], 10), type: TYPE_MAP[typeName] || "single", typeName: typeName, chapter: chapter, stem: "", options: [], answerRaw: "", analysis: "" };
        seg = "stem";
        continue;
      }
      var hm = trimmed.match(/^##\s+(.+)$/);
      if (hm && !inCode) { chapter = hm[1].trim(); continue; }
      if (!cur) continue;
      if (/^```/.test(trimmed)) { pushLine(line); inCode = !inCode; continue; }
      if (inCode) { pushLine(line); continue; }
      var am = line.match(/^\*\*答案\*\*\s*[:：]\s*(.*)$/);
      if (am) { cur.answerRaw = am[1].trim(); seg = "answer"; continue; }
      var xm = line.match(/^\*\*解析\*\*\s*[:：]\s*(.*)$/);
      if (xm) { cur.analysis = xm[1].trim(); seg = "analysis"; continue; }
      var om = line.match(/^-\s*([A-Za-z])\s*[.．、]\s*(.*)$/);
      if (om && seg !== "answer" && seg !== "analysis") {
        cur.options.push({ key: om[1].toUpperCase(), text: om[2] });
        seg = "option";
        continue;
      }
      if (trimmed === "---") continue;
      pushLine(line);
    }
    finish();
    return { id: id || "custom", name: name, questions: questions, custom: true };
  };

  // 页面加载时应用设置
  App.applySettings();
})();
