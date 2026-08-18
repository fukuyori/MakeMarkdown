/*
 * MakeMarkdown - 拡張機能ページ用の i18n ヘルパー
 *
 * viewer.html / options.html が他のスクリプトより先に読み込む。
 *   t(key, ...subs)     _locales のメッセージを取り出す
 *   localizeDocument()  data-i18n 属性の付いた要素を置き換える
 */
"use strict";

// Chrome には browser 名前空間が無いので chrome を割り当てる (Firefox では何もしない)
if (typeof globalThis.browser === "undefined" && typeof globalThis.chrome !== "undefined") {
  globalThis.browser = globalThis.chrome;
}

// メッセージが取れないときは HTML に書いてある既定の文言をそのまま使いたいので、
// 呼び出し側が fallback を渡せるようにしている
function t(key, ...subs) {
  try {
    const message = browser.i18n.getMessage(key, subs.map((s) => String(s)));
    if (message) return message;
  } catch {
    /* i18n が使えない環境ではキーを返す */
  }
  return key;
}

function localizeDocument() {
  try {
    const ui = (browser.i18n.getUILanguage() || "").toLowerCase();
    document.documentElement.lang = ui.startsWith("ja") ? "ja" : "en";
  } catch {
    /* 判定できなければ HTML の lang をそのままにする */
  }

  for (const el of document.querySelectorAll("[data-i18n]")) {
    const message = t(el.dataset.i18n);
    if (message !== el.dataset.i18n) el.textContent = message;
  }
  for (const el of document.querySelectorAll("[data-i18n-title]")) {
    const message = t(el.dataset.i18nTitle);
    if (message !== el.dataset.i18nTitle) el.title = message;
  }
  for (const el of document.querySelectorAll("[data-i18n-label]")) {
    const message = t(el.dataset.i18nLabel);
    if (message !== el.dataset.i18nLabel) el.setAttribute("aria-label", message);
  }
}
