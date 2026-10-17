/*
 * 题库审计脚本：检测答案与解析不照应、结构问题等。
 * 用法：node tools/audit.js
 */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");

// 加载 data.js 得到 QUESTION_BANKS
const code = fs.readFileSync(path.join(ROOT, "js", "data.js"), "utf8");
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(code, ctx);
const banks = ctx.window.QUESTION_BANKS;

// 解析中“结论性字母”指向（支持多字母，如“故选 A、B、C”）
const LETTER = "([A-E](?:\\s*[、，,]\\s*[A-E])*)";
const patterns = [
  { name: "故选择", re: new RegExp("故(?:本题)?(?:应|正确)?选(?:择)?\\s*" + LETTER, "g") },
  { name: "因此选", re: new RegExp("因此(?:本题)?(?:应|正确)?选(?:择)?\\s*" + LETTER, "g") },
  { name: "所以选", re: new RegExp("所以(?:本题)?(?:应|正确)?选(?:择)?\\s*" + LETTER, "g") },
  { name: "应选", re: new RegExp("应选(?:择)?\\s*" + LETTER, "g") },
  { name: "本题选", re: new RegExp("本题(?:应|正确)?选(?:择)?\\s*" + LETTER, "g") },
  { name: "正确答案", re: new RegExp("正确答案(?:为|是|应为)?[:：]?\\s*" + LETTER, "g") },
  { name: "答案是", re: new RegExp("答案(?:是|为|应为)\\s*" + LETTER, "g") },
];

function splitLetters(s) {
  return s.split(/[、，,\s]+/).filter((c) => /^[A-E]$/.test(c));
}

function collectPointers(text) {
  const out = [];
  for (const p of patterns) {
    let m;
    while ((m = p.re.exec(text)) !== null) {
      for (const c of splitLetters(m[1])) {
        out.push({ label: p.name, letter: c });
      }
    }
    p.re.lastIndex = 0;
  }
  return out;
}

const issues = [];
const mismatch = [];
const structural = [];

for (const bank of banks) {
  for (const q of bank.questions) {
    const loc = bank.name + " #" + q.id + " (" + q.typeName + ")";
    const answer = q.answer.join(",");

    // 1. 解析指向 vs 答案
    const pointers = collectPointers(q.analysis);
    const seen = {};
    for (const p of pointers) {
      if (seen[p.letter]) continue;
      seen[p.letter] = true;
      if (q.answer.indexOf(p.letter) < 0) {
        mismatch.push({
          loc, answer,
          label: p.label, letter: p.letter,
          analysis: q.analysis.slice(0, 160),
        });
      }
    }

    // 1b. 解析里“X正确/X错误”的表述 vs 答案
    const okRe = /([A-E])(?:正确|是对的|对)/g;
    const badRe = /([A-E])(?:错误|不正确|不对|是错的|错)/g;
    let m;
    const okLetters = {};
    const badLetters = {};
    while ((m = okRe.exec(q.analysis)) !== null) okLetters[m[1]] = true;
    while ((m = badRe.exec(q.analysis)) !== null) badLetters[m[1]] = true;
    for (const c of Object.keys(okLetters)) {
      if (q.answer.indexOf(c) < 0) {
        mismatch.push({ loc, answer, label: "解析称" + c + "正确", letter: c, analysis: q.analysis.slice(0, 160) });
      }
    }
    for (const c of Object.keys(badLetters)) {
      if (q.answer.indexOf(c) >= 0) {
        mismatch.push({ loc, answer, label: "解析称" + c + "错误", letter: c, analysis: q.analysis.slice(0, 160) });
      }
    }

    // 2. 结构检查
    const keys = q.options.map((o) => o.key);
    const uniq = {};
    for (const k of keys) {
      if (uniq[k]) structural.push({ loc, kind: "选项 key 重复", detail: k });
      uniq[k] = true;
    }
    const keySet = keys.join("");
    const expect = q.type === "judge" ? "AB" : "";
    if (q.type !== "judge") {
      // 检查是否连续（常见 A-D 或 A-E）
      const max = Math.max(...keys.map((k) => k.charCodeAt(0)));
      for (let c = 65; c <= max; c++) {
        const ch = String.fromCharCode(c);
        if (keys.indexOf(ch) < 0) {
          structural.push({ loc, kind: "选项缺 " + ch, detail: "现有 " + keySet });
        }
      }
    }

    // 答案重复字母
    if (new Set(q.answer).size !== q.answer.length) {
      structural.push({ loc, kind: "答案有重复字母", detail: answer });
    }

    // 题干为空
    if (!q.stem || !q.stem.trim()) {
      structural.push({ loc, kind: "题干为空", detail: "" });
    }

    // 选项文本为空（且不是代码块，代码块选项文本以 ``` 开头）
    for (const o of q.options) {
      if ((!o.text || !o.text.trim()) && !o.text.startsWith("```")) {
        structural.push({ loc, kind: "选项 " + o.key + " 文本为空", detail: "" });
      }
    }
  }
}

console.log("========== 一、答案与解析不照应（解析明确指向某个字母，但答案里没有） ==========");
if (mismatch.length === 0) console.log("（无）");
for (const m of mismatch) {
  console.log("[" + m.loc + "] 答案=" + m.answer + "，解析[" + m.label + " " + m.letter + "]");
  console.log("  解析：" + m.analysis + " ...");
}

console.log("\n========== 二、结构性问题 ==========");
if (structural.length === 0) console.log("（无）");
for (const s of structural) {
  console.log("[" + s.loc + "] " + s.kind + " " + s.detail);
}

console.log("\n共检测到：不照应 " + mismatch.length + " 处，结构问题 " + structural.length + " 处。");
