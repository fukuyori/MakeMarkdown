/*
 * MakeMarkdown - ストア掲載用スクリーンショットの作成
 *
 *   node tools/make-screenshots.mjs
 *
 * ビューアと設定画面にサンプルデータを流し込んだデモページを dist/demo に作り、
 * ヘッドレス Chrome で 1280x800 の PNG を screenshots/ に書き出す。
 * (Chrome ウェブストアのスクリーンショットは 1280x800 または 640x400)
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEMO = path.join(ROOT, "dist", "demo");
const OUT = path.join(ROOT, "screenshots");

const CHROME =
  process.env.CHROME ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

/* ---------------- サンプルデータ ---------------- */

const SAMPLE = {
  ja: {
    ok: true,
    title: "Web ページを Markdown で読む",
    url: "https://example.com/articles/markdown-reading",
    siteName: "Example Journal",
    byline: "山田 太郎",
    published: "2026-08-01T09:00:00Z",
    source: "snapshot",
    candidates: [
      { source: "live", length: 1180 },
      { source: "settled", length: 1180 },
      { source: "snapshot", length: 3620 },
    ],
    markdown: [
      "# Web ページを Markdown で読む",
      "",
      "記事を読むときに邪魔になるのは、本文そのものではなく、その周りにあるものだ。",
      "追従するヘッダー、途中に挟まる関連記事、読み終わる前に出てくる購読の案内。",
      "本文だけを Markdown として取り出してしまえば、そうしたものは最初から存在しない。",
      "",
      "## 取り出したあとにできること",
      "",
      "- そのままノートアプリに貼り付ける",
      "- 見出しやリストの構造を保ったまま検索する",
      "- 差分を取って、あとから書き換えられた箇所を調べる",
      "",
      "> 保存したいのはページではなく、そこに書かれていた文章のほうだ。",
      "",
      "## 途中で消える本文",
      "",
      "本文をいったん表示してから、JavaScript で折りたたんだり削除したりするページがある。",
      "そういうページでは、変換した時点の DOM だけを見ても足りない。",
      "ページを開いた直後からの状態を覚えておき、いちばん内容が多かったものを選ぶ。",
      "",
      "```js",
      'const best = candidates.reduce((a, b) => (b.length > a.length ? b : a));',
      "```",
      "",
      "| 状態 | 文字数 |",
      "| --- | --- |",
      "| 表示中の DOM | 1,180 |",
      "| 記録していた状態 | 3,620 |",
    ].join("\n"),
  },
};

SAMPLE.en = {
  ...SAMPLE.ja,
  title: "Reading web pages as Markdown",
  byline: "Taylor Reed",
  markdown: [
    "# Reading web pages as Markdown",
    "",
    "What gets in the way of an article is rarely the article itself. It is the sticky header,",
    "the related posts wedged into the middle of a paragraph, the subscription prompt that",
    "arrives before the last sentence does. Take the body out as Markdown and none of it exists.",
    "",
    "## What you can do with it afterwards",
    "",
    "- Paste it straight into a notes app",
    "- Search it with the headings and lists still intact",
    "- Diff it later to see what was quietly rewritten",
    "",
    "> What you wanted to keep was never the page. It was the text on it.",
    "",
    "## When the body disappears",
    "",
    "Some pages render the full article and then let JavaScript collapse or remove part of it.",
    "Looking at the DOM at conversion time is not enough there. MakeMarkdown watches the page",
    "from the moment it opens and converts whichever state had the most content.",
    "",
    "```js",
    "const best = candidates.reduce((a, b) => (b.length > a.length ? b : a));",
    "```",
    "",
    "| State | Characters |",
    "| --- | --- |",
    "| Current DOM | 1,180 |",
    "| Recorded state | 3,620 |",
  ].join("\n"),
};

/* ---------------- デモページの作成 ---------------- */

const manifestVersion = () =>
  JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8")).version;

const messages = (locale) =>
  JSON.parse(fs.readFileSync(path.join(ROOT, "_locales", locale, "messages.json"), "utf8"));

function stub(locale, doc, settings) {
  return `
<script>
// スクリーンショット用のスタブ (拡張機能の API をサンプルデータで置き換える)
(() => {
  const MANIFEST_VERSION = ${JSON.stringify(manifestVersion())};
  const MESSAGES = ${JSON.stringify(messages(locale))};
  const DOC = ${JSON.stringify(doc)};
  const SETTINGS = ${JSON.stringify(settings)};
  globalThis.browser = {
    i18n: {
      getUILanguage: () => ${JSON.stringify(locale === "ja" ? "ja-JP" : "en-US")},
      getMessage: (key, subs = []) => {
        const entry = MESSAGES[key];
        if (!entry) return "";
        return String(entry.message).replace(/\\$(\\d)/g, (_, n) => String(subs[n - 1] ?? ""));
      },
    },
    storage: {
      local: {
        get: async (defaults) => ({ ...defaults, ...SETTINGS }),
        set: async () => {},
      },
      session: { get: async (key) => ({ [key]: DOC }) },
    },
    permissions: { contains: async () => false, request: async () => false, remove: async () => {} },
    runtime: { sendMessage: async () => {}, getManifest: () => ({ version: MANIFEST_VERSION }) },
  };
})();
</script>
`;
}

function demoPage(page, locale, doc, settings, openPanel) {
  const html = fs.readFileSync(path.join(ROOT, page), "utf8");
  const marker = '<script src="src/i18n.js"></script>';
  if (!html.includes(marker)) throw new Error(`${page} に ${marker} がありません`);
  // 表示設定パネルを開いた状態も見せたいので、撮影用にボタンを押しておく
  const open = openPanel
    ? '\n<script>addEventListener("load", () => setTimeout(() => document.getElementById("btn-panel").click(), 200));</script>'
    : "";
  return html.replace(marker, stub(locale, doc, settings) + marker) + open;
}

/* ---------------- 実行 ---------------- */

if (!fs.existsSync(CHROME)) {
  console.error(`Chrome が見つかりません: ${CHROME}`);
  console.error("環境変数 CHROME で実行ファイルの場所を指定してください。");
  process.exit(1);
}

fs.rmSync(DEMO, { recursive: true, force: true });
fs.mkdirSync(DEMO, { recursive: true });
for (const item of ["viewer.css", "options.css", "viewer.js", "options.js", "src", "icons", "_locales"]) {
  fs.cpSync(path.join(ROOT, item), path.join(DEMO, item), { recursive: true });
}
fs.mkdirSync(OUT, { recursive: true });

const SHOTS = [
  { name: "1-viewer", page: "viewer.html", query: "?id=demo", settings: { view: "preview", theme: "light" }, openPanel: true },
  { name: "2-markdown", page: "viewer.html", query: "?id=demo", settings: { view: "source", theme: "dark" } },
  { name: "3-options", page: "options.html", query: "", settings: {} },
];

for (const locale of ["ja", "en"]) {
  for (const shot of SHOTS) {
    const file = path.join(DEMO, `${locale}-${shot.name}.html`);
    fs.writeFileSync(file, demoPage(shot.page, locale, SAMPLE[locale], shot.settings, shot.openPanel));

    const out = path.join(OUT, `makemarkdown-${locale}-${shot.name}-1280x800.png`);
    execFileSync(
      CHROME,
      [
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        "--force-device-scale-factor=1",
        "--window-size=1280,800",
        `--screenshot=${out}`,
        `--virtual-time-budget=2000`,
        `file://${file}${shot.query}`,
      ],
      { stdio: "ignore" }
    );
    console.log(path.relative(ROOT, out));
  }
}


/* ---------------- 小さいプロモーションタイル (440x280) ---------------- */

const PROMO_TEXT = {
  ja: { lead: "ページを Markdown に", sub: "読んで、保存して、書き出す" },
  en: { lead: "Any page, as Markdown", sub: "Read it, keep it, export it" },
};

function promoPage(locale) {
  const mark = fs.readFileSync(path.join(ROOT, "icons", "icon.svg"), "utf8");
  const text = PROMO_TEXT[locale];
  return `<!doctype html>
<html lang="${locale}"><head><meta charset="utf-8"><style>
  html, body { margin: 0; padding: 0; width: 440px; height: 280px; }
  body {
    display: flex; flex-direction: column; justify-content: center; gap: 10px;
    padding: 0 34px; box-sizing: border-box; background: #1f6feb; color: #fff;
    font-family: -apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif;
  }
  .mark { width: 76px; height: 76px; padding: 8px; border-radius: 20px; background: #fff; box-sizing: border-box; }
  .mark svg { display: block; width: 100%; height: 100%; }
  h1 { margin: 0; font-size: 30px; line-height: 1.2; letter-spacing: -0.01em; }
  p { margin: 0; font-size: 15px; line-height: 1.5; opacity: 0.88; }
  .lead { font-size: 17px; opacity: 1; font-weight: 600; }
</style></head><body>
  <div class="mark">${mark}</div>
  <h1>MakeMarkdown</h1>
  <p class="lead">${text.lead}</p>
  <p>${text.sub}</p>
</body></html>`;
}

for (const locale of ["ja", "en"]) {
  const file = path.join(DEMO, `${locale}-promo.html`);
  fs.writeFileSync(file, promoPage(locale));
  const out = path.join(OUT, `makemarkdown-${locale}-promo-440x280.png`);
  execFileSync(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      "--window-size=440,280",
      `--screenshot=${out}`,
      "--virtual-time-budget=2000",
      `file://${file}`,
    ],
    { stdio: "ignore" }
  );
  console.log(path.relative(ROOT, out));
}

fs.rmSync(DEMO, { recursive: true, force: true });
