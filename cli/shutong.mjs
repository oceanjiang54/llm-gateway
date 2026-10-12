#!/usr/bin/env node
// 书童命令行客户端：终端里选模型、流式对话，默认使用平台记忆（服务端保存上下文）
// 零依赖，需要 Node 18+。安装：在本目录执行 npm link（或 npm i -g .）
//
//   shutong                     进入交互对话
//   shutong "问题"               问一次就退出
//   cat a.log | shutong "总结"   把管道内容一起发送
//   shutong -m qwen-plus "问题"  指定模型
//   shutong login               重新设置服务地址与密钥
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";

const DIR = path.join(os.homedir(), ".shutong");
const CFG = path.join(DIR, "config.json");
const color = !process.env.NO_COLOR && process.stdout.isTTY;
const c = (code) => (s) => (color ? `\x1b[${code}m${s}\x1b[0m` : String(s));
const dim = c("2"), bold = c("1"), blue = c("34"), red = c("31"), green = c("32");

const load = () => { try { return JSON.parse(fs.readFileSync(CFG, "utf8")); } catch { return {}; } };
const save = (cfg) => { fs.mkdirSync(DIR, { recursive: true, mode: 0o700 }); fs.writeFileSync(CFG, JSON.stringify(cfg, null, 2), { mode: 0o600 }); };

let cfg = load();
let rl = null;

function ask(q, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const r = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      // 输入密钥时不回显
      r._writeToOutput = (s) => { if (s.includes(q)) r.output.write(s); else if (!s.includes("\n")) r.output.write("*"); };
    }
    r.question(q, (a) => { r.close(); if (hidden) process.stdout.write("\n"); resolve(a.trim()); });
  });
}

async function api(p, opts = {}) {
  const res = await fetch(cfg.baseUrl.replace(/\/$/, "") + p, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}`, ...(opts.headers || {}) },
  });
  return res;
}

async function login() {
  console.log(bold("书童 ShuTong · 首次设置"));
  const base = await ask(`服务地址 ${dim(`(回车默认 ${cfg.baseUrl || "https://shutong.ai"})`)}：`);
  cfg.baseUrl = (base || cfg.baseUrl || "https://shutong.ai").replace(/\/$/, "");
  if (!/^https?:\/\//.test(cfg.baseUrl)) cfg.baseUrl = "https://" + cfg.baseUrl;
  for (;;) {
    const key = (await ask("API Key（sk-gw-…，在控制台 API Keys 页创建）：", { hidden: true })).replace(/\s+/g, "");
    if (!key.startsWith("sk-gw-")) { console.log(red("密钥应以 sk-gw- 开头，请重新输入")); continue; }
    cfg.apiKey = key;
    const r = await api("/api/v1/conversations").catch((e) => ({ ok: false, status: 0, e }));
    if (r.ok) break;
    console.log(red(r.status === 401 ? "密钥无效或已停用，请重新输入" : `连接失败（${r.status || r.e?.message}），请检查服务地址`));
    if (r.status !== 401) return login();
  }
  cfg.model ||= "deepseek-chat";
  cfg.memory ??= true;
  save(cfg);
  console.log(green(`已保存到 ${CFG}`));
}

async function models() {
  const r = await fetch(cfg.baseUrl + "/api/models");
  return r.ok ? (await r.json()).models : [];
}

// 发送一轮并流式打印。返回 false 表示失败
async function send(text, signal) {
  const body = { model: cfg.model, stream: true, messages: [{ role: "user", content: text }] };
  if (cfg.memory) body.conversation_id = cfg.conversationId || "new";
  const t0 = Date.now();
  let res;
  try { res = await api("/api/v1/chat/completions", { method: "POST", body: JSON.stringify(body), signal }); }
  catch (e) { if (e.name !== "AbortError") console.log(red(`网络错误：${e.message}`)); return false; }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err.error?.message || `HTTP ${res.status}`;
    if (res.status === 404 && cfg.memory && cfg.conversationId && msg.includes("Conversation")) {
      cfg.conversationId = null; save(cfg);
      console.log(dim("原会话已不存在，已开启新会话，请重发一次"));
    } else console.log(red(`调用失败（${res.status}）：${msg}`));
    return false;
  }
  const decoder = new TextDecoder();
  let buf = "", usage = null;
  try {
    for await (const chunk of res.body) {
      buf += decoder.decode(chunk, { stream: true });
      const lines = buf.split("\n"); buf = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
        try {
          const j = JSON.parse(line.slice(6));
          const d = j.choices?.[0]?.delta?.content;
          if (d) process.stdout.write(d);
          if (j.usage) usage = j.usage;
          if (j.conversation_id && cfg.memory && cfg.conversationId !== j.conversation_id) { cfg.conversationId = j.conversation_id; save(cfg); }
        } catch {}
      }
    }
  } catch (e) { if (e.name !== "AbortError") throw e; process.stdout.write(dim(" [已中断]")); }
  process.stdout.write("\n");
  if (usage) {
    const m = (await models().catch(() => [])).find((x) => x.id === cfg.model);
    const cost = m ? (usage.prompt_tokens / 1e6) * m.inputPerM + (usage.completion_tokens / 1e6) * m.outputPerM : null;
    console.log(dim(`${cfg.model} · 输入 ${usage.prompt_tokens} / 输出 ${usage.completion_tokens} tokens${cost != null ? ` · ¥${cost.toFixed(cost >= 0.01 ? 4 : 6)}` : ""} · ${((Date.now() - t0) / 1000).toFixed(1)}s`));
  }
  return true;
}

async function pickModel() {
  const list = await models();
  if (!list.length) return console.log(red("获取模型列表失败"));
  list.forEach((m, i) => console.log(`  ${String(i + 1).padStart(2)}. ${m.id === cfg.model ? green(m.id + " ←当前") : m.id}  ${dim(`${m.displayName} · ¥${m.inputPerM}/¥${m.outputPerM} 每百万tokens`)}`));
  const a = await prompt(`选择序号（回车保持 ${cfg.model}）：`);
  const m = list[Number(a) - 1];
  if (m) { cfg.model = m.id; save(cfg); console.log(green(`已切换到 ${m.id}`)); }
}

async function pickHistory() {
  const r = await api("/api/v1/conversations");
  if (!r.ok) return console.log(red("获取会话失败"));
  const list = (await r.json()).data.slice(0, 15);
  if (!list.length) return console.log(dim("还没有会话"));
  list.forEach((s, i) => console.log(`  ${String(i + 1).padStart(2)}. ${s.id === cfg.conversationId ? green(s.title || "(无标题)") : s.title || "(无标题)"}  ${dim(`${s.model} · ${new Date(s.updated_at).toLocaleString("zh-CN")}`)}`));
  const a = await prompt("继续哪一个（序号，回车取消）：");
  const s = list[Number(a) - 1];
  if (s) { cfg.conversationId = s.id; cfg.memory = true; save(cfg); console.log(green(`已切换到会话「${s.title}」`)); }
}

const prompt = (q) => new Promise((resolve) => rl.question(q, (a) => resolve(a.trim())));

const HELP = `${bold("命令")}
  /model     切换模型          /new       开启新会话
  /history   继续以前的会话    /memory    开关平台记忆（当前 ${"{m}"}）
  /login     重新设置密钥      /exit      退出
  行尾输入 \\ 可换行继续；回答过程中按 Ctrl+C 中断回答`;

async function repl() {
  console.log(`${bold("书童 ShuTong")} ${dim(`· ${cfg.baseUrl} · 模型 ${cfg.model} · 记忆${cfg.memory ? "开" : "关"}`)}`);
  console.log(dim("输入 /help 查看命令\n"));
  rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  let ctl = null, pending = "";
  rl.on("SIGINT", () => { if (ctl) { ctl.abort(); ctl = null; } else { rl.close(); } });
  rl.on("close", () => { console.log(dim("\n再见")); process.exit(0); });
  for (;;) {
    const line = await prompt(pending ? dim("… ") : blue("> "));
    if (line.endsWith("\\")) { pending += line.slice(0, -1) + "\n"; continue; }
    const text = (pending + line).trim(); pending = "";
    if (!text) continue;
    if (text === "/exit" || text === "/quit") return rl.close();
    if (text === "/help") { console.log(HELP.replace("{m}", cfg.memory ? "开" : "关")); continue; }
    if (text === "/model") { await pickModel(); continue; }
    if (text === "/new") { cfg.conversationId = null; save(cfg); console.log(green("已开启新会话")); continue; }
    if (text === "/history") { await pickHistory(); continue; }
    if (text === "/memory") { cfg.memory = !cfg.memory; save(cfg); console.log(green(`平台记忆已${cfg.memory ? "开启：网关保存上下文，只发新问题" : "关闭：每次提问互相独立"}`)); continue; }
    if (text === "/login") { console.log(dim("请先 /exit 退出，再运行 shutong login 重新设置")); continue; }
    if (text.startsWith("/")) { console.log(dim("未知命令，输入 /help 查看")); continue; }
    ctl = new AbortController();
    await send(text, ctl.signal);
    ctl = null;
  }
}

async function readStdin(hasQuestion) {
  if (process.stdin.isTTY) return "";
  // 已带问题参数时，若 0.5 秒内没有管道数据（如在脚本、IDE 中运行，stdin 未关闭），直接忽略 stdin，避免卡住
  return new Promise((resolve) => {
    let s = "", got = false;
    const done = () => { process.stdin.pause(); resolve(s); };
    const t = hasQuestion ? setTimeout(() => { if (!got) done(); }, 500) : null;
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (ch) => { got = true; if (t) clearTimeout(t); s += ch; });
    process.stdin.on("end", () => { if (t) clearTimeout(t); resolve(s); });
    process.stdin.on("error", done);
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === "login") { await login(); return; }
  if (args[0] === "-h" || args[0] === "--help") { console.log("用法：shutong [-m 模型] [问题]    shutong login"); return; }
  const mi = args.indexOf("-m");
  let model = null;
  if (mi >= 0) { model = args[mi + 1]; args.splice(mi, 2); }
  const piped = await readStdin(args.length > 0);
  if (!cfg.apiKey || !cfg.baseUrl) {
    if (!process.stdin.isTTY) { console.error(red("请先在终端运行 shutong login 完成设置")); process.exit(1); }
    await login();
  }
  if (model) cfg = { ...cfg, model };
  const question = args.join(" ").trim();
  if (question || piped) {
    // 单次模式：不污染当前交互会话的记忆
    cfg = { ...cfg, memory: false };
    const ok = await send([question, piped && `\n\n${piped}`].filter(Boolean).join(""));
    process.exit(ok ? 0 : 1);
  }
  await repl();
}

main().catch((e) => { console.error(red(e.message)); process.exit(1); });
