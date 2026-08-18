/*
 * MakeMarkdown - 本文スナップショット記録スクリプト
 *
 * ページによっては、いったん描画した本文を JavaScript が後から
 * 削除・折りたたみ・差し替えしてしまう(続きを読む、無限スクロールの
 * 巻き取り、計測スクリプトによる置換など)。
 * このスクリプトは document_start から動き、「これまでで最も本文量が
 * 多かった時点」の body の HTML を保持しておく。
 * 変換時 (src/extract.js) は現在の DOM とこのスナップショットを比べて、
 * 長いほうを採用する。
 *
 * 全サイトへのアクセス権が必要なため、オプションで許可されたときだけ
 * background.js から動的に登録される。
 */
(() => {
  "use strict";

  if (globalThis.__makeMarkdownRecorder) return;

  const WINDOW_MS = 15000; // 記録を続ける時間 (ページ表示開始から)
  const INTERVAL_MS = 500; // 定期サンプリング間隔
  const DEBOUNCE_MS = 300; // DOM 変更後にサンプリングするまでの待ち
  const MIN_TEXT = 200; // これ未満の本文量は記録しない
  const MIN_GAIN = 300; // 直前の最長記録からこれ以上増えたら保存し直す
  const MAX_SNAPSHOTS = 20; // 保存回数の上限 (重いページでの負荷対策)

  const rec = {
    url: location.href,
    html: "", // 最長時点の body.innerHTML
    length: 0, // そのときの本文文字数
    saves: 0,
    active: true,
  };
  globalThis.__makeMarkdownRecorder = rec;

  let timer = null;
  let debounce = null;
  let observer = null;
  let deadline = null;

  const textLength = () => {
    const body = document.body;
    if (!body) return 0;
    // textContent は script/style の中身も数えてしまうので、その分を差し引く
    let len = body.textContent ? body.textContent.length : 0;
    for (const el of body.querySelectorAll("script,style,template")) {
      len -= el.textContent ? el.textContent.length : 0;
    }
    return len;
  };

  const sample = () => {
    if (!rec.active || !document.body) return;

    // SPA でページが切り替わったら記録をやり直す
    if (location.href !== rec.url) {
      rec.url = location.href;
      rec.html = "";
      rec.length = 0;
      rec.saves = 0;
      deadline = Date.now() + WINDOW_MS;
    }

    const len = textLength();
    if (len < MIN_TEXT) return;
    if (rec.length && len < rec.length + MIN_GAIN) return;

    try {
      rec.html = document.body.innerHTML;
      rec.length = len;
      rec.saves += 1;
    } catch {
      /* 巨大ページなどで失敗しても記録は諦めるだけ */
    }
    if (rec.saves >= MAX_SNAPSHOTS) stop();
  };

  const stop = () => {
    rec.active = false;
    if (timer) clearInterval(timer);
    if (debounce) clearTimeout(debounce);
    if (observer) observer.disconnect();
    timer = debounce = observer = null;
    document.removeEventListener("DOMContentLoaded", onEvent);
    window.removeEventListener("load", onEvent);
  };

  const onEvent = () => sample();

  const start = () => {
    deadline = Date.now() + WINDOW_MS;
    sample();

    timer = setInterval(() => {
      sample();
      if (Date.now() > deadline) stop();
    }, INTERVAL_MS);

    observer = new MutationObserver(() => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(sample, DEBOUNCE_MS);
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    document.addEventListener("DOMContentLoaded", onEvent);
    window.addEventListener("load", onEvent);
  };

  if (document.documentElement) {
    start();
  } else {
    // document_start では documentElement すら無いことがある
    const wait = setInterval(() => {
      if (document.documentElement) {
        clearInterval(wait);
        start();
      }
    }, 10);
  }
})();
