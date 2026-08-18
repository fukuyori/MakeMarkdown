/*
 * MakeMarkdown - ページ内で実行される変換エントリポイント
 *
 * 「JavaScript によって本文が切り取られる」ページに備えて、複数の状態から
 * Markdown を作り、最も内容が多いものを採用する。
 *
 *   1. selection … 選択範囲があるときは、それだけを変換する (最優先)
 *   2. live      … 呼び出し時点の DOM
 *   3. settled   … DOM の変更が落ち着くまで待ってから見た DOM
 *   4. snapshot  … recorder.js が記録していた「最も本文が多かった時点」
 *   5. original  … サーバーから返ってきた元の HTML (設定で有効化)
 *
 * scripting.executeScript の戻り値として結果オブジェクトを返す。
 */
(async () => {
  "use strict";

  // Chrome には browser 名前空間が無いので chrome で代用する
  const ext = globalThis.browser || globalThis.chrome;
  const t = (key) => {
    try {
      return ext.i18n.getMessage(key) || key;
    } catch {
      return key;
    }
  };

  const NS = globalThis.MakeMarkdown;
  if (!NS || !NS.extractArticle || !NS.htmlToMarkdown) {
    return { ok: false, error: t("errScriptLoad") };
  }

  const DEFAULTS = { waitMs: 1200, fetchOriginal: false };

  async function getSettings() {
    try {
      const stored = await ext.storage.local.get(DEFAULTS);
      return { ...DEFAULTS, ...stored };
    } catch {
      return { ...DEFAULTS };
    }
  }

  /* ---------------- 各ソースから Markdown を作る ---------------- */

  function build(doc, source) {
    try {
      const article = NS.extractArticle(doc);
      if (!article) return null;
      const markdown = NS.htmlToMarkdown(article.root);
      if (!markdown) return null;
      return { source, markdown, length: markdown.length, fallback: article.fallback };
    } catch (e) {
      return null;
    }
  }

  // 解析専用のドキュメント (スクリプトも読み込みも走らない) を作る
  function inertDocument(html, { fullPage }) {
    const baseHref = location.href.replace(/["<>]/g, encodeURIComponent);
    const source = fullPage
      ? html
      : `<!doctype html><html><head><base href="${baseHref}"></head><body>${html}</body></html>`;
    const doc = new DOMParser().parseFromString(source, "text/html");
    if (!doc || !doc.body) return null;
    // 相対 URL を元ページ基準で解決できるようにする
    if (!doc.querySelector("base")) {
      const base = doc.createElement("base");
      base.setAttribute("href", location.href);
      doc.head.insertBefore(base, doc.head.firstChild);
    }
    return doc;
  }

  // DOM の変更が止まるまで待つ (最大 waitMs)
  function settle(waitMs) {
    return new Promise((resolve) => {
      if (waitMs <= 0) return resolve();
      let timer = null;
      const observer = new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(done, 400);
      });
      const done = () => {
        clearTimeout(timer);
        clearTimeout(hard);
        observer.disconnect();
        resolve();
      };
      const hard = setTimeout(done, waitMs);
      timer = setTimeout(done, 400);
      observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    });
  }

  // 応答が返らないサイトで変換が終わらなくならないよう、必ず打ち切る
  const FETCH_TIMEOUT_MS = 5000;

  async function fetchOriginal() {
    if (!/^https?:/.test(location.href)) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(location.href, {
        credentials: "include",
        cache: "force-cache",
        redirect: "follow",
        signal: controller.signal,
      });
      if (!res.ok) return null;
      const type = res.headers.get("content-type") || "";
      if (!/text\/html|application\/xhtml/i.test(type)) return null;
      return await res.text();
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  function selectionRoot() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
    const div = document.createElement("div");
    for (let i = 0; i < sel.rangeCount; i += 1) div.appendChild(sel.getRangeAt(i).cloneContents());
    return (div.textContent || "").trim().length >= 10 ? div : null;
  }

  /* ---------------- 実行 ---------------- */

  const settings = await getSettings();
  const metadata = NS.readMetadata(document);
  const base = {
    ok: true,
    url: location.href,
    capturedAt: new Date().toISOString(),
    ...metadata,
  };

  // 1. 選択範囲があればそれを優先する
  const selected = selectionRoot();
  if (selected) {
    const markdown = NS.htmlToMarkdown(selected);
    if (markdown) {
      return {
        ...base,
        markdown,
        source: "selection",
        fallback: false,
        candidates: [{ source: "selection", length: markdown.length }],
      };
    }
  }

  const results = [];
  const push = (r) => {
    if (r && r.markdown) results.push(r);
  };

  push(build(document, "live"));

  if (settings.waitMs > 0) {
    await settle(settings.waitMs);
    push(build(document, "settled"));
  }

  const recorder = globalThis.__makeMarkdownRecorder;
  if (recorder && recorder.html) {
    const doc = inertDocument(recorder.html, { fullPage: false });
    if (doc) push(build(doc, "snapshot"));
  }

  if (settings.fetchOriginal) {
    const html = await fetchOriginal();
    if (html) {
      const doc = inertDocument(html, { fullPage: true });
      if (doc) push(build(doc, "original"));
    }
  }

  if (!results.length) {
    return { ok: false, error: t("errNoArticle") };
  }

  // 現在の DOM から作ったものを基準に、明らかに内容が多いものがあれば乗り換える
  const current =
    results.find((r) => r.source === "settled") || results.find((r) => r.source === "live") || results[0];
  let best = current;
  for (const r of results) {
    if (r === current) continue;
    if (r.length > best.length * 1.05 + 200) best = r;
  }

  return {
    ...base,
    markdown: best.markdown,
    source: best.source,
    fallback: best.fallback,
    candidates: results.map((r) => ({ source: r.source, length: r.length })),
  };
})();
