/*
 * Markdown 题库 -> JS 数据文件 转换脚本
 * 用法：node tools/convert.js
 * 生成：js/data.js （window.QUESTION_BANKS）
 *
 * 题库格式约定：
 *   # 题库名
 *   ## 章节（可选）
 *   ### 题号. 题型    （题型：单选题 / 多选题 / 判断题）
 *   题干（可含代码块）
 *   - A. 选项
 *   - B. 选项
 *   ...
 *   **答案**：字母（多选用顿号/逗号/空格分隔）
 *   **解析**：解析内容
 *   ---
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const BANKS = [
  { file: "题库/Java题库.md", id: "java" },
  { file: "题库/Web题库.md", id: "web" },
];

// 题型映射
const TYPE_MAP = {
  "单选题": "single",
  "多选题": "multiple",
  "判断题": "judge",
};

function stripBom(s) {
  if (s.charCodeAt(0) === 0xfeff) return s.slice(1);
  return s;
}

// 提取答案里的字母数组
function parseAnswerLetters(text) {
  if (!text) return [];
  const letters = text.match(/[A-Za-z]/g);
  if (!letters) return [];
  return letters.map((c) => c.toUpperCase());
}

// 检查一道题的脏数据，返回异常原因数组（空表示正常）
function checkQuestion(q) {
  const reasons = [];

  if (q.options.length === 0) {
    reasons.push("无选项");
  }
  if (q.answer.length === 0) {
    reasons.push("无答案");
  }

  // 有选项且有答案时，才做范围/数量校验
  if (q.options.length > 0 && q.answer.length > 0) {
    const optionKeys = q.options.map((o) => o.key);
    for (const a of q.answer) {
      if (!optionKeys.includes(a)) {
        reasons.push("答案字母 " + a + " 超出选项范围");
        break;
      }
    }
    if (q.type === "multiple" && q.answer.length < 2) {
      reasons.push("多选题答案少于 2 个");
    }
    if (q.type === "judge") {
      if (q.answer.length !== 1 || !["A", "B"].includes(q.answer[0])) {
        reasons.push("判断题答案应为单个 A 或 B");
      }
    }
  }

  return reasons;
}

// 答案与解析明显矛盾检测：解析里明确给出结论（“故选X / 正确答案X / 答案是X”等），
// 但该字母不在答案字段里，判定为矛盾，以答案为准、解析原样保留、标记异常。
function checkConflict(q) {
  if (!q.analysis) return [];
  const seq = "([A-E](?:\\s*[、，,]\\s*[A-E])*)";
  const patterns = [
    new RegExp("故(?:本题)?(?:应|正确)?选(?:择)?\\s*" + seq, "g"),
    new RegExp("因此(?:本题)?(?:应|正确)?选(?:择)?\\s*" + seq, "g"),
    new RegExp("所以(?:本题)?(?:应|正确)?选(?:择)?\\s*" + seq, "g"),
    new RegExp("应选(?:择)?\\s*" + seq, "g"),
    new RegExp("本题(?:应|正确)?选(?:择)?\\s*" + seq, "g"),
    new RegExp("正确答案(?:为|是|应为)?[:：]?\\s*" + seq, "g"),
    new RegExp("答案(?:是|为|应为)\\s*" + seq, "g"),
  ];
  const conflict = [];
  for (const p of patterns) {
    let m;
    while ((m = p.exec(q.analysis)) !== null) {
      const letters = m[1].split(/[、，,\s]+/).filter((c) => /^[A-E]$/.test(c));
      for (const c of letters) {
        if (q.answer.indexOf(c) < 0 && conflict.indexOf(c) < 0) conflict.push(c);
      }
    }
  }
  if (conflict.length > 0) {
    return ["答案与解析矛盾（解析指向 " + conflict.join("、") + "）"];
  }
  return [];
}

// 解析单个 Markdown 题库文件
function parseBank(file, id) {
  const raw = fs.readFileSync(path.join(ROOT, file), "utf8");
  const text = stripBom(raw);
  const lines = text.split(/\r?\n/);

  // 题库名从一级标题提取，兜底用文件名
  let name = path.basename(file, ".md");
  for (const line of lines) {
    const m = line.match(/^#\s+(.+)$/);
    if (m) {
      name = m[1].trim();
      break;
    }
  }

  const questions = [];
  let cur = null; // 当前题
  let seg = "none"; // none | stem | option | answer | analysis
  let inCode = false;
  let chapter = ""; // 当前章节名（## 二级标题）

  function pushLine(line) {
    if (!cur) return;
    if (seg === "stem") cur.stem += (cur.stem ? "\n" : "") + line;
    else if (seg === "option" && cur.options.length > 0) {
      cur.options[cur.options.length - 1].text +=
        (cur.options[cur.options.length - 1].text ? "\n" : "") + line;
    } else if (seg === "answer") cur.answerRaw += (cur.answerRaw ? "\n" : "") + line;
    else if (seg === "analysis") cur.analysis += (cur.analysis ? "\n" : "") + line;
  }

  function finishCurrent() {
    if (!cur) return;
    // 判断题无选项则补 A正确 / B错误
    if (cur.type === "judge" && cur.options.length === 0) {
      cur.options = [
        { key: "A", text: "正确" },
        { key: "B", text: "错误" },
      ];
    }
    cur.stem = cur.stem.trim();
    cur.analysis = cur.analysis.trim();
    cur.options.forEach((o) => (o.text = o.text.trim()));
    cur.answer = parseAnswerLetters(cur.answerRaw);
    delete cur.answerRaw;

    const reasons = checkQuestion(cur).concat(checkConflict(cur));
    cur.abnormal = reasons.length > 0;
    cur.reason = reasons.join("；");
    questions.push(cur);
    cur = null;
    seg = "none";
  }

  for (const line of lines) {
    const trimmed = line.trim();

    // 题目起始
    const qm = trimmed.match(/^###\s+(\d+)\.\s*(.+?)\s*$/);
    if (qm && !inCode) {
      finishCurrent();
      const typeName = qm[2];
      cur = {
        id: parseInt(qm[1], 10),
        type: TYPE_MAP[typeName] || "single",
        typeName: typeName,
        chapter: chapter,
        stem: "",
        options: [],
        answerRaw: "",
        analysis: "",
      };
      seg = "stem";
      continue;
    }

    // 章节标题（## 二级标题）
    const hm = trimmed.match(/^##\s+(.+)$/);
    if (hm && !inCode) {
      chapter = hm[1].trim();
      continue;
    }

    if (!cur) continue; // 忽略文件头（标题、引用、--- 等）

    // 代码块切换
    if (/^```/.test(trimmed)) {
      pushLine(line); // 保留 ``` 及语言标记
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      pushLine(line);
      continue;
    }

    // 字段标记
    const am = line.match(/^\*\*答案\*\*\s*[:：]\s*(.*)$/);
    if (am) {
      cur.answerRaw = am[1].trim();
      seg = "answer";
      continue;
    }
    const xm = line.match(/^\*\*解析\*\*\s*[:：]\s*(.*)$/);
    if (xm) {
      cur.analysis = xm[1].trim();
      seg = "analysis";
      continue;
    }

    // 选项
    const om = line.match(/^-\s*([A-Za-z])\s*[.．、]\s*(.*)$/);
    if (om && seg !== "answer" && seg !== "analysis") {
      cur.options.push({ key: om[1].toUpperCase(), text: om[2] });
      seg = "option";
      continue;
    }

    // 题间分隔符，忽略
    if (trimmed === "---") {
      continue;
    }

    // 普通内容行（含空行），追加到当前段落
    pushLine(line);
  }
  finishCurrent();

  return { id, name, questions };
}

// 统计
function summarize(bank) {
  const cnt = { single: 0, multiple: 0, judge: 0 };
  let abnormal = 0;
  for (const q of bank.questions) {
    cnt[q.type] = (cnt[q.type] || 0) + 1;
    if (q.abnormal) abnormal++;
  }
  return { ...cnt, total: bank.questions.length, abnormal };
}

function main() {
  const banks = [];
  const report = [];

  for (const b of BANKS) {
    const bank = parseBank(b.file, b.id);
    banks.push(bank);
    const s = summarize(bank);
    report.push({
      id: bank.id,
      name: bank.name,
      ...s,
      abnormalList: bank.questions.filter((q) => q.abnormal),
    });
  }

  // 生成 data.js
  const json = JSON.stringify(banks);
  const version = new Date().toISOString().slice(0, 16).replace("T", " ");
  const content =
    "// 本文件由 tools/convert.js 自动生成，请勿手动编辑。\n" +
    "// 重新生成：node tools/convert.js\n" +
    "window.QUESTION_BANKS_VERSION = " + JSON.stringify(version) + ";\n" +
    "window.QUESTION_BANKS = " + json + ";\n";
  fs.writeFileSync(path.join(ROOT, "js", "data.js"), content, "utf8");

  // 输出报告
  for (const r of report) {
    console.log("==== " + r.name + " (" + r.id + ") ====");
    console.log(
      "总题数 " + r.total +
      " | 单选 " + r.single +
      " | 多选 " + r.multiple +
      " | 判断 " + r.judge +
      " | 异常 " + r.abnormal
    );
    for (const q of r.abnormalList) {
      console.log("  异常题 #" + q.id + " [" + q.typeName + "]：" + q.reason);
    }
  }
  console.log("已生成 js/data.js，共 " + banks.length + " 个题库。");
}

main();
