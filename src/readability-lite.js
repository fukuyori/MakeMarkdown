/*
 * MakeMarkdown - 本文抽出 (簡易 Readability)
 *
 * ページの DOM から「本文らしい」要素を選び出し、余計な部分を落とした
 * クローンを返す。外部ライブラリは使わず、Readability の考え方
 * (段落を点数付けして親要素にスコアを集約する) を簡略化して実装している。
 *
 * 公開 API:
 *   MakeMarkdown.extractArticle(doc)  -> {root, score, fallback}
 *   MakeMarkdown.readMetadata(doc)    -> {title, byline, siteName, published, excerpt}
 */
(() => {
  "use strict";

  const NS = (globalThis.MakeMarkdown = globalThis.MakeMarkdown || {});
  if (NS.extractArticle) return;

  // 本文ではなさそうな要素 (class/id で判定)
  const UNLIKELY =
    /(^|[\s\-_])(ad|ads|adsense|advert|banner|breadcrumb|byline|combx|comment|community|cookie|disqus|extra|foot|footer|gdpr|header|hidden|legend|masthead|menu|modal|nav|navbar|newsletter|overlay|pager|pagination|popup|promo|recommend|related|remark|reply|rss|share|sharing|shoutbox|sidebar|skyscraper|social|sponsor|subscribe|supplement|tags?|toc|tool(bar|s)|widget)([\s\-_]|$)/i;
  // 上の条件に当てはまっても本文の可能性が高いもの
  const MAYBE = /(article|body|column|content|entry|main|post|shadow|story|text)/i;
  const POSITIVE =
    /(article|body|content|entry|hentry|h-entry|main|page|post|story|text|blog|column)/i;
  const NEGATIVE =
    /(hid|hidden|banner|combx|comment|com-|contact|foot|footer|footnote|gdpr|masthead|media|meta|outbrain|promo|related|scroll|share|shoutbox|sidebar|skyscraper|sponsor|shopping|tags?|widget|utility|social|subscribe|newsletter)/i;

  // 中身を見る必要すらない要素
  const DROP_TAGS = new Set([
    "SCRIPT",
    "STYLE",
    "NOSCRIPT",
    "TEMPLATE",
    "LINK",
    "META",
    "SVG",
    "CANVAS",
    "OBJECT",
    "EMBED",
    "FORM",
    "INPUT",
    "SELECT",
    "TEXTAREA",
    "BUTTON",
    "DIALOG",
    "NAV",
    "ASIDE",
  ]);

  const idClass = (el) =>
    `${el.className && typeof el.className === "string" ? el.className : ""} ${el.id || ""}`;

  const textOf = (el) => (el.textContent || "").trim();

  // 文字数に対するリンク文字数の比率。高いほどメニュー/関連リンクらしい
  function linkDensity(el) {
    const len = textOf(el).length;
    if (!len) return 0;
    let linkLen = 0;
    for (const a of el.querySelectorAll("a")) linkLen += textOf(a).length;
    return linkLen / len;
  }

  function classWeight(el) {
    let weight = 0;
    const s = idClass(el);
    if (POSITIVE.test(s)) weight += 25;
    if (NEGATIVE.test(s)) weight -= 25;
    if (el.nodeName === "ARTICLE" || el.getAttribute("role") === "main") weight += 30;
    if (el.hasAttribute("itemprop") && /articleBody/i.test(el.getAttribute("itemprop")))
      weight += 40;
    return weight;
  }

  // 段落とみなせる要素か (div でも中身が全部インラインなら段落扱い)
  const BLOCK_INSIDE =
    "div,p,section,article,ul,ol,table,h1,h2,h3,h4,h5,h6,pre,blockquote,figure,aside,nav,header,footer";
  function isParagraphLike(el) {
    const tag = el.nodeName;
    if (tag === "P" || tag === "PRE" || tag === "BLOCKQUOTE" || tag === "TD") return true;
    if (tag === "DIV") return !el.querySelector(BLOCK_INSIDE);
    return false;
  }

  function isHidden(el, win) {
    if (el.hasAttribute("hidden")) return true;
    if (el.getAttribute("aria-hidden") === "true") return true;
    const inline = el.style;
    if (inline && (inline.display === "none" || inline.visibility === "hidden")) return true;
    if (win) {
      const cs = win.getComputedStyle(el);
      if (!cs) return false;
      if (cs.display === "none" || cs.visibility === "hidden") return true;
    }
    return false;
  }

  /* ------------------------------------------------------------------
   * 本文候補の選定
   * ---------------------------------------------------------------- */
  function pickCandidate(doc) {
    const body = doc.body;
    if (!body) return null;

    const scores = new Map();
    const add = (el, value) => {
      if (!el || el.nodeType !== 1 || el === body || el === doc.documentElement) return;
      scores.set(el, (scores.get(el) || 0) + value);
    };

    for (const el of body.querySelectorAll("p,pre,blockquote,td,div")) {
      if (!isParagraphLike(el)) continue;
      const text = textOf(el);
      if (text.length < 25) continue;

      const s = idClass(el);
      if (UNLIKELY.test(s) && !MAYBE.test(s)) continue;

      // 読点・カンマの数と文字量で段落の「濃さ」を測る
      const punctuation = (text.match(/[,、。.]/g) || []).length;
      const score = 1 + punctuation + Math.min(Math.floor(text.length / 100), 3);

      const p = el.parentElement;
      const gp = p && p.parentElement;
      const ggp = gp && gp.parentElement;
      add(p, score);
      add(gp, score / 2);
      add(ggp, score / 3);
    }

    let best = null;
    let bestScore = 0;
    for (const [el, raw] of scores) {
      const s = idClass(el);
      if (UNLIKELY.test(s) && !MAYBE.test(s)) continue;
      const value = (raw + classWeight(el)) * (1 - linkDensity(el));
      if (value > bestScore) {
        bestScore = value;
        best = el;
      }
    }

    // 明示的なマークアップがあり、スコア上位と矛盾しない場合はそちらを優先
    const semantic =
      body.querySelector("[itemprop~='articleBody']") ||
      body.querySelector("article") ||
      body.querySelector("main") ||
      body.querySelector("[role='main']");
    if (semantic && (!best || semantic.contains(best))) {
      if (textOf(semantic).length >= textOf(best || semantic).length * 0.9) {
        best = semantic;
      }
    }

    return best ? { node: best, score: bestScore } : null;
  }

  // 本文候補の兄弟要素にも本文が続いていることがあるので拾う
  function siblingsOf(candidate, score) {
    const parent = candidate.parentElement;
    if (!parent) return [candidate];
    const threshold = Math.max(10, score * 0.2);
    const picked = [];
    for (const sib of parent.children) {
      if (sib === candidate) {
        picked.push(sib);
        continue;
      }
      const s = idClass(sib);
      if (UNLIKELY.test(s) && !MAYBE.test(s)) continue;
      const text = textOf(sib);
      if (!text) continue;
      const bonus = POSITIVE.test(s) ? threshold : 0;
      const density = linkDensity(sib);
      const ok =
        (sib.nodeName === "P" && text.length > 80 && density < 0.25) ||
        (bonus > 0 && text.length > 80 && density < 0.4) ||
        (text.length > 400 && density < 0.2);
      if (ok) picked.push(sib);
    }
    return picked.length ? picked : [candidate];
  }

  /* ------------------------------------------------------------------
   * 不要要素の判定とクローン生成
   * ---------------------------------------------------------------- */
  function collectDropped(root, win) {
    const dropped = new Set();

    const walk = (el) => {
      for (const child of el.children) {
        if (shouldDrop(child, win)) {
          dropped.add(child);
          continue; // 親ごと落とすので中は見ない
        }
        walk(child);
      }
    };

    walk(root);
    return dropped;
  }

  function shouldDrop(el, win) {
    const tag = el.nodeName;

    // iframe は埋め込みリンクとして残したいので落とさない
    if (DROP_TAGS.has(tag)) {
      // 記事内の nav/aside でも本文が長ければ残す
      if ((tag === "NAV" || tag === "ASIDE") && textOf(el).length > 400 && linkDensity(el) < 0.3)
        return false;
      return true;
    }

    if (tag === "FOOTER" || tag === "HEADER") {
      if (textOf(el).length < 200 || linkDensity(el) > 0.4) return true;
    }

    const text = textOf(el);

    if (isHidden(el, win)) {
      // 「続きを読む」等で JS が隠している本文はここで救済する
      const substantial = text.length >= 160 && linkDensity(el) < 0.3;
      if (!substantial) return true;
    }

    const s = idClass(el);
    if (UNLIKELY.test(s) && !MAYBE.test(s) && text.length < 400) return true;

    if (NEGATIVE.test(s) && !POSITIVE.test(s)) {
      if (text.length < 200 || linkDensity(el) > 0.5) return true;
    }

    // リンクだらけで文章が短い塊 (シェアボタン・関連記事など)
    if (
      (tag === "DIV" || tag === "UL" || tag === "OL" || tag === "SECTION") &&
      text.length > 0 &&
      text.length < 300 &&
      linkDensity(el) > 0.7 &&
      el.querySelectorAll("a").length >= 3
    ) {
      return true;
    }

    return false;
  }

  function cloneWithout(node, dropped) {
    if (dropped.has(node)) return null;
    const copy = node.cloneNode(false);
    for (const child of node.childNodes) {
      if (child.nodeType === 1) {
        const c = cloneWithout(child, dropped);
        if (c) copy.appendChild(c);
      } else if (child.nodeType === 3) {
        copy.appendChild(child.cloneNode(false));
      }
    }
    return copy;
  }

  // クローンに対する後処理 (スタイル情報が不要な整理)
  function tidyClone(root) {
    const KEEP_EMPTY = new Set([
      "IMG",
      "BR",
      "HR",
      "TD",
      "TH",
      "IFRAME",
      "VIDEO",
      "AUDIO",
      "SOURCE",
      "PRE",
    ]);

    // 中身が空の要素を落とす (内側から順に)
    const all = Array.from(root.querySelectorAll("*")).reverse();
    for (const el of all) {
      if (KEEP_EMPTY.has(el.nodeName)) continue;
      if (el.querySelector("img,iframe,video,audio,br,hr,pre,table")) continue;
      if (textOf(el)) continue;
      el.remove();
    }

    // 属性を最小限に (変換に使うものだけ残す)
    const KEEP_ATTR = new Set([
      "href",
      "src",
      "srcset",
      "alt",
      "title",
      "colspan",
      "rowspan",
      "start",
      "datetime",
      "type",
      "checked",
      "class", // コードブロックの言語判定に使う
      "data-src",
      "data-original",
      "data-lazy-src",
      "data-srcset",
    ]);
    for (const el of root.querySelectorAll("*")) {
      for (const attr of Array.from(el.attributes)) {
        if (!KEEP_ATTR.has(attr.name)) el.removeAttribute(attr.name);
      }
    }

    return root;
  }

  /**
   * 本文を抽出する。
   * @param {Document} doc 対象ドキュメント (現在のページ or スナップショット)
   * @returns {{root: Element, fallback: boolean, textLength: number}|null}
   */
  function extractArticle(doc) {
    if (!doc || !doc.body) return null;
    const win = doc.defaultView || null;

    const candidate = pickCandidate(doc);
    let container;
    let fallback = false;

    if (candidate) {
      const nodes = siblingsOf(candidate.node, candidate.score);
      container = doc.createElement("div");
      for (const node of nodes) {
        // 選ばれた要素自身は落とさず、その中身だけを掃除する
        const clone = cloneWithout(node, collectDropped(node, win));
        if (clone) container.appendChild(clone);
      }
    }

    // 抽出できなかった / 短すぎる場合は body 全体にフォールバック
    if (!container || textOf(container).length < 200) {
      const dropped = collectDropped(doc.body, win);
      const clone = cloneWithout(doc.body, dropped);
      if (clone) {
        container = doc.createElement("div");
        while (clone.firstChild) container.appendChild(clone.firstChild);
        fallback = true;
      }
    }

    if (!container) return null;
    tidyClone(container);
    return { root: container, fallback, textLength: textOf(container).length };
  }

  /* ------------------------------------------------------------------
   * メタデータ
   * ---------------------------------------------------------------- */
  function meta(doc, selectors) {
    for (const sel of selectors) {
      const el = doc.querySelector(sel);
      if (!el) continue;
      const value = (el.getAttribute("content") || el.getAttribute("datetime") || el.textContent || "").trim();
      if (value) return value;
    }
    return "";
  }

  function readMetadata(doc) {
    const title =
      meta(doc, [
        "meta[property='og:title']",
        "meta[name='twitter:title']",
        "meta[name='title']",
      ]) ||
      (doc.querySelector("h1") ? textOf(doc.querySelector("h1")) : "") ||
      (doc.title || "").trim();

    return {
      title: title.replace(/\s+/g, " ").trim(),
      byline: meta(doc, [
        "meta[name='author']",
        "meta[property='article:author']",
        "[rel='author']",
        "[itemprop='author'] [itemprop='name']",
        "[itemprop='author']",
        ".byline",
        ".author",
      ]).replace(/\s+/g, " ").slice(0, 120),
      siteName: meta(doc, [
        "meta[property='og:site_name']",
        "meta[name='application-name']",
      ]),
      published: meta(doc, [
        "meta[property='article:published_time']",
        "meta[name='pubdate']",
        "meta[name='date']",
        "time[datetime]",
      ]),
      excerpt: meta(doc, [
        "meta[name='description']",
        "meta[property='og:description']",
      ]).replace(/\s+/g, " ").slice(0, 400),
    };
  }

  NS.extractArticle = extractArticle;
  NS.readMetadata = readMetadata;
})();
