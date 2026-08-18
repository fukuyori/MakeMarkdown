/*
 * MakeMarkdown - バックグラウンド
 *
 *  - ツールバーボタン / ショートカットからページ変換を実行する
 *  - 結果を storage.session に置き、ビューア (viewer.html) を開く
 *  - 「本文の最長状態を記録する」設定に応じて recorder.js を登録/解除する
 */
"use strict";

// Chrome には browser 名前空間が無いので chrome を割り当てる (Firefox では何もしない)
if (typeof globalThis.browser === "undefined" && typeof globalThis.chrome !== "undefined") {
  globalThis.browser = globalThis.chrome;
}

// _locales のメッセージ (service worker では src/i18n.js を読み込めないので同じものを持つ)
function t(key, ...subs) {
  try {
    const message = browser.i18n.getMessage(key, subs.map((s) => String(s)));
    if (message) return message;
  } catch {
    /* i18n が使えない環境ではキーを返す */
  }
  return key;
}

const EXTRACT_FILES = [
  "src/readability-lite.js",
  "src/html-to-markdown.js",
  "src/extract.js",
];

const RECORDER_ID = "makemarkdown-recorder";
const DOC_PREFIX = "doc:";
const MAX_DOCS = 10;

/* ------------------------------------------------------------------
 * 変換の実行
 * ---------------------------------------------------------------- */

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

async function saveDocument(payload) {
  const id = newId();
  const key = DOC_PREFIX + id;
  await browser.storage.session.set({ [key]: { ...payload, id, savedAt: Date.now() } });
  await pruneDocuments();
  return id;
}

// 古い変換結果を捨てる (セッションストレージの上限対策)
async function pruneDocuments() {
  const all = await browser.storage.session.get(null);
  const docs = Object.entries(all)
    .filter(([key]) => key.startsWith(DOC_PREFIX))
    .sort((a, b) => (b[1].savedAt || 0) - (a[1].savedAt || 0));
  const stale = docs.slice(MAX_DOCS).map(([key]) => key);
  if (stale.length) await browser.storage.session.remove(stale);
}

function describeError(error, tab) {
  const url = (tab && tab.url) || "";
  if (/^(about|moz-extension|chrome-extension|view-source|resource|chrome|edge|devtools):/.test(url)) {
    return t("errInternalPage");
  }
  if (/^https:\/\/(addons\.mozilla\.org|chromewebstore\.google\.com|chrome\.google\.com\/webstore)/.test(url)) {
    return t("errStorePage");
  }
  return t("errReadFailed", (error && error.message) || error);
}

async function convertTab(tab) {
  if (!tab || typeof tab.id !== "number") return;

  let payload;
  try {
    const results = await browser.scripting.executeScript({
      target: { tabId: tab.id },
      files: EXTRACT_FILES,
    });
    payload = results && results[0] ? results[0].result : null;
    if (results && results[0] && results[0].error) throw results[0].error;
  } catch (error) {
    payload = { ok: false, error: describeError(error, tab), url: tab.url || "", title: tab.title || "" };
  }

  if (!payload) {
    payload = { ok: false, error: t("errNoResult"), url: tab.url || "", title: tab.title || "" };
  }
  if (!payload.title) payload.title = tab.title || payload.url || "";

  const id = await saveDocument(payload);
  await browser.tabs.create({
    url: browser.runtime.getURL(`viewer.html?id=${encodeURIComponent(id)}`),
    index: typeof tab.index === "number" ? tab.index + 1 : undefined,
    active: true,
  });
}

browser.action.onClicked.addListener((tab) => {
  convertTab(tab).catch((e) => console.error("MakeMarkdown:", e));
});

// commands は Firefox for Android など一部の環境に無い
if (browser.commands) {
  browser.commands.onCommand.addListener(async (command) => {
    if (command !== "make-markdown") return;
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab) convertTab(tab).catch((e) => console.error("MakeMarkdown:", e));
  });
}

/* ------------------------------------------------------------------
 * 本文スナップショット記録スクリプトの登録
 * ---------------------------------------------------------------- */

async function isRecorderRegistered() {
  try {
    const scripts = await browser.scripting.getRegisteredContentScripts({ ids: [RECORDER_ID] });
    return scripts.length > 0;
  } catch {
    return false;
  }
}

async function syncRecorder() {
  const { monitorLongest } = await browser.storage.local.get({ monitorLongest: false });
  const granted = await browser.permissions.contains({ origins: ["*://*/*"] });
  const want = Boolean(monitorLongest && granted);
  const registered = await isRecorderRegistered();

  if (want && !registered) {
    await browser.scripting.registerContentScripts([
      {
        id: RECORDER_ID,
        js: ["src/recorder.js"],
        matches: ["*://*/*"],
        runAt: "document_start",
        allFrames: false,
        persistAcrossSessions: true,
      },
    ]);
  } else if (!want && registered) {
    await browser.scripting.unregisterContentScripts({ ids: [RECORDER_ID] });
  }
  return want;
}

// sendResponse を使うのは Chrome が Promise の返却に対応していないため
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "syncRecorder") {
    syncRecorder().then(
      (active) => sendResponse({ active }),
      () => sendResponse({ active: false })
    );
    return true;
  }
  return undefined;
});

browser.permissions.onAdded.addListener(() => syncRecorder().catch(() => {}));
browser.permissions.onRemoved.addListener(() => syncRecorder().catch(() => {}));
browser.runtime.onInstalled.addListener(() => syncRecorder().catch(() => {}));
browser.runtime.onStartup.addListener(() => syncRecorder().catch(() => {}));
