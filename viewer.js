/*
 * MakeMarkdown - ビューア
 *
 * background.js が storage.session に置いた変換結果を読み込んで表示する。
 * プレビュー (Markdown を描画したもの) と Markdown ソースを切り替えられ、
 * .md ファイルとしてダウンロードできる。
 */
"use strict";

const DEFAULTS = {
  theme: "auto",
  font: "sans",
  fontSize: 18,
  contentWidth: 720,
  view: "preview",
  optTitle: true,
  optSource: true,
  optFront: false,
};

const SOURCE_KEY = {
  selection: "sourceSelection",
  live: "sourceLive",
  settled: "sourceSettled",
  snapshot: "sourceSnapshot",
  original: "sourceOriginal",
};

const sourceLabel = (source) => (SOURCE_KEY[source] ? t(SOURCE_KEY[source]) : source);

const $ = (id) => document.getElementById(id);
const body = document.body;

const params = new URLSearchParams(location.search);

let doc = null;
let settings = { ...DEFAULTS };

/* ------------------------------------------------------------------
 * Markdown の組み立て
 * ---------------------------------------------------------------- */

const yaml = (value) => `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

const compact = (s) => String(s).replace(/[\s　]+/g, "").toLowerCase();

// 本文がすでにページタイトルと同じ見出しで始まっているか (見出しの重複を避ける)
function hasOwnTitle() {
  const first = (doc.markdown.split("\n").find((line) => line.trim()) || "").trim();
  const m = /^#\s+(.+?)\s*#*$/.exec(first);
  if (!m) return false;
  const heading = compact(m[1].replace(/\\([\\`*_[\]#])/g, "$1"));
  const title = compact(doc.title || "");
  if (!heading || !title) return false;
  return heading === title || title.includes(heading) || heading.includes(title);
}

function buildMarkdown() {
  if (!doc || !doc.markdown) return "";
  const parts = [];

  if (settings.optFront) {
    const lines = ["---", `title: ${yaml(doc.title || "")}`, `source: ${yaml(doc.url || "")}`];
    if (doc.siteName) lines.push(`site: ${yaml(doc.siteName)}`);
    if (doc.byline) lines.push(`author: ${yaml(doc.byline)}`);
    if (doc.published) lines.push(`published: ${yaml(doc.published)}`);
    if (doc.capturedAt) lines.push(`captured: ${yaml(doc.capturedAt)}`);
    lines.push("---");
    parts.push(lines.join("\n"));
  }

  // 出典リンクは見出しの直後に置きたいので、本文から先頭の見出しを切り出す
  let body = doc.markdown.replace(/^\n+/, "");
  if (hasOwnTitle()) {
    const end = body.indexOf("\n");
    parts.push(end === -1 ? body : body.slice(0, end));
    body = end === -1 ? "" : body.slice(end + 1).replace(/^\n+/, "");
  } else if (settings.optTitle && doc.title) {
    parts.push(`# ${doc.title}`);
  }

  if (settings.optSource && doc.url) {
    parts.push(`> ${t("mdSourcePrefix")}: [${doc.title || doc.url}](${doc.url})`);
  }
  if (body) parts.push(body);

  return `${parts.join("\n\n").trimEnd()}\n`;
}

const stripFrontMatter = (md) =>
  md.startsWith("---\n") ? md.replace(/^---\n[\s\S]*?\n---\n+/, "") : md;

/* ------------------------------------------------------------------
 * 描画
 * ---------------------------------------------------------------- */

function renderMeta() {
  const box = $("doc-meta");
  box.textContent = "";
  if (!doc || !doc.ok) {
    box.hidden = true;
    return;
  }

  // タイトルを Markdown 側に入れていないときだけ、ここで見出しとして出す
  if (!settings.optTitle && doc.title) {
    const title = document.createElement("span");
    title.className = "doc-title";
    title.textContent = doc.title;
    box.appendChild(title);
  }

  const bits = [];
  if (doc.siteName) bits.push(doc.siteName);
  if (doc.byline) bits.push(doc.byline);
  if (doc.published) bits.push(doc.published.slice(0, 10));
  if (bits.length) {
    const line = document.createElement("div");
    line.textContent = bits.join(" ・ ");
    box.appendChild(line);
  }

  if (doc.url) {
    const link = document.createElement("a");
    link.href = doc.url;
    link.textContent = doc.url;
    link.target = "_blank";
    link.rel = "noreferrer noopener";
    const line = document.createElement("div");
    line.appendChild(link);
    box.appendChild(line);
  }

  box.hidden = !box.childNodes.length;
}

// markdownToHtml が生成するタグは限定されているが、念のため
// 解析専用ドキュメント経由でノードとして取り込む
function renderPreview(html) {
  const parsed = new DOMParser().parseFromString(
    `<!doctype html><html><body>${html}</body></html>`,
    "text/html"
  );
  const imported = document.importNode(parsed.body, true);
  $("preview").replaceChildren(...imported.childNodes);
}

function render() {
  const source = buildMarkdown();
  renderPreview(MakeMarkdown.markdownToHtml(stripFrontMatter(source)));
  $("source-code").textContent = source;
  renderMeta();
}

function applySettings() {
  body.dataset.theme = settings.theme;
  body.dataset.font = settings.font;
  body.dataset.view = settings.view;
  body.style.setProperty("--content-size", `${settings.fontSize}px`);
  body.style.setProperty("--content-width", `${settings.contentWidth}px`);

  for (const btn of document.querySelectorAll("[data-theme]")) {
    btn.classList.toggle("is-active", btn.dataset.theme === settings.theme);
  }
  for (const btn of document.querySelectorAll(".seg-btn[data-font]")) {
    btn.classList.toggle("is-active", btn.dataset.font === settings.font);
  }
  for (const btn of document.querySelectorAll(".seg-btn[data-view]")) {
    btn.classList.toggle("is-active", btn.dataset.view === settings.view);
  }

  $("font-size").value = settings.fontSize;
  $("font-size-out").textContent = `${settings.fontSize}px`;
  $("content-width").value = settings.contentWidth;
  $("content-width-out").textContent = `${settings.contentWidth}px`;
  $("opt-title").checked = settings.optTitle;
  $("opt-source").checked = settings.optSource;
  $("opt-front").checked = settings.optFront;
}

async function save(patch) {
  settings = { ...settings, ...patch };
  applySettings();
  await browser.storage.local.set(patch);
}

let toastTimer = null;
function toast(message, duration = 2000) {
  const el = $("toast");
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.hidden = true;
  }, duration);
}

function showNotice(message) {
  const el = $("notice");
  el.textContent = message;
  el.hidden = false;
  $("preview").hidden = true;
  $("source").hidden = true;
}

/* ------------------------------------------------------------------
 * 操作
 * ---------------------------------------------------------------- */

function fileName() {
  const raw = (doc && (doc.title || doc.url)) || "page";
  const cleaned = raw
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return `${cleaned || "page"}.md`;
}

function download() {
  const blob = new Blob([buildMarkdown()], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName();
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

async function copy() {
  try {
    await navigator.clipboard.writeText(buildMarkdown());
    toast(t("toastCopied"));
  } catch {
    toast(t("toastCopyFailed"));
  }
}

function bindEvents() {
  for (const btn of document.querySelectorAll(".seg-btn[data-view]")) {
    btn.addEventListener("click", () => save({ view: btn.dataset.view }));
  }
  for (const btn of document.querySelectorAll(".seg-btn[data-theme]")) {
    btn.addEventListener("click", () => save({ theme: btn.dataset.theme }));
  }
  for (const btn of document.querySelectorAll(".seg-btn[data-font]")) {
    btn.addEventListener("click", () => save({ font: btn.dataset.font }));
  }

  $("btn-panel").addEventListener("click", () => {
    const panel = $("panel");
    panel.hidden = !panel.hidden;
    $("btn-panel").setAttribute("aria-expanded", String(!panel.hidden));
  });

  $("font-size").addEventListener("input", (e) => save({ fontSize: Number(e.target.value) }));
  $("content-width").addEventListener("input", (e) =>
    save({ contentWidth: Number(e.target.value) })
  );

  for (const [id, key] of [
    ["opt-title", "optTitle"],
    ["opt-source", "optSource"],
    ["opt-front", "optFront"],
  ]) {
    $(id).addEventListener("change", async (e) => {
      await save({ [key]: e.target.checked });
      render();
    });
  }

  $("btn-copy").addEventListener("click", copy);
  $("btn-download").addEventListener("click", download);

  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      download();
    }
  });
}

/* ------------------------------------------------------------------
 * 起動
 * ---------------------------------------------------------------- */

async function init() {
  localizeDocument();
  settings = { ...DEFAULTS, ...(await browser.storage.local.get(DEFAULTS)) };
  applySettings();
  bindEvents();

  const id = params.get("id");
  const key = `doc:${id}`;
  const stored = id ? await browser.storage.session.get(key) : {};
  doc = stored[key] || null;

  if (!doc) {
    showNotice(t("noticeNotFound"));
    return;
  }

  if (!doc.ok) {
    $("bar-title").textContent = doc.title || "MakeMarkdown";
    showNotice(doc.error || t("noticeConvertFailed"));
    return;
  }

  document.title = t("viewerDocumentTitle", doc.title || "MakeMarkdown");
  $("bar-title").textContent = doc.title || doc.url || "MakeMarkdown";

  const badge = $("source-badge");
  const bits = [sourceLabel(doc.source)];
  if (Array.isArray(doc.candidates) && doc.candidates.length > 1) {
    bits.push(t("badgeLongest", doc.candidates.length));
  }
  if (doc.fallback) bits.push(t("badgeFallback"));
  badge.textContent = bits.join(" / ");
  badge.title = Array.isArray(doc.candidates)
    ? doc.candidates.map((c) => `${sourceLabel(c.source)}: ${t("badgeChars", c.length)}`).join("\n")
    : "";
  badge.hidden = false;

  render();
}

init().catch((e) => showNotice(t("noticeRenderFailed", (e && e.message) || e)));
