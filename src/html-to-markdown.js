/*
 * MakeMarkdown - DOM から Markdown への変換
 *
 * 抽出済みの要素ツリーを再帰的にたどって Markdown (GFM 相当) を組み立てる。
 * 公開 API: MakeMarkdown.htmlToMarkdown(root) -> string
 */
(() => {
  "use strict";

  const NS = (globalThis.MakeMarkdown = globalThis.MakeMarkdown || {});
  if (NS.htmlToMarkdown) return;

  // 埋め込みのラベルだけ _locales を使う (取れなければ既定の文言)
  function msg(key, fallback) {
    try {
      const ext = globalThis.browser || globalThis.chrome;
      return ext.i18n.getMessage(key) || fallback;
    } catch {
      return fallback;
    }
  }

  // 変換対象にしない要素
  const SKIP = new Set([
    "SCRIPT",
    "STYLE",
    "NOSCRIPT",
    "TEMPLATE",
    "HEAD",
    "LINK",
    "META",
    "SVG",
    "CANVAS",
    "OBJECT",
    "EMBED",
    "FORM",
    "INPUT",
    "SELECT",
    "OPTION",
    "TEXTAREA",
    "BUTTON",
    "DIALOG",
    "NAV",
    "ASIDE",
  ]);

  // 前後に空行を入れる (ブロック扱いの) 要素
  const BLOCK = new Set([
    "ADDRESS",
    "ARTICLE",
    "DIV",
    "FIELDSET",
    "FOOTER",
    "HEADER",
    "HGROUP",
    "MAIN",
    "SECTION",
    "TBODY",
    "THEAD",
    "TFOOT",
    "TR",
  ]);

  const MAX_DATA_URI = 4096; // これより長い data URI の画像は落とす

  /* ---------------------------------------------------------------- */

  const block = (s) => {
    const t = String(s).replace(/^[ \t\n]+|[ \t\n]+$/g, "");
    return t ? `\n\n${t}\n\n` : "";
  };

  function escapeText(s, ctx) {
    let out = s
      .replace(/\\/g, "\\\\")
      .replace(/\*/g, "\\*")
      .replace(/`/g, "\\`")
      .replace(/(?<![A-Za-z0-9])_|_(?![A-Za-z0-9])/g, "\\_")
      .replace(/\[/g, "\\[")
      .replace(/\]/g, "\\]")
      .replace(/<(?=[A-Za-z/!?])/g, "\\<")
      .replace(/&(?=[A-Za-z#][A-Za-z0-9]{0,9};)/g, "\\&")
      // 行頭に来ると別の意味になってしまう記号
      .replace(/^(\s*)(#{1,6})(\s)/, "$1\\$2$3")
      .replace(/^(\s*)([-+])(\s)/, "$1\\$2$3")
      .replace(/^(\s*)(\d{1,9})([.)])(\s)/, "$1$2\\$3$4")
      .replace(/^(\s*)>/, "$1\\>");
    if (ctx.inTable) out = out.replace(/\|/g, "\\|");
    return out;
  }

  function absolute(url, node) {
    if (!url) return "";
    const raw = url.trim();
    if (!raw) return "";
    try {
      return new URL(raw, node.ownerDocument.baseURI).href;
    } catch {
      return raw;
    }
  }

  const formatUrl = (url) => (/[\s()<>]/.test(url) ? `<${url}>` : url);

  function codeSpan(text) {
    const body = text.replace(/\r?\n/g, " ");
    const longest = (body.match(/`+/g) || []).reduce((m, r) => Math.max(m, r.length), 0);
    const fence = "`".repeat(longest + 1);
    const pad = /^`|`$|^\s|\s$/.test(body) && body.trim() ? " " : "";
    return `${fence}${pad}${body}${pad}${fence}`;
  }

  function wrap(inner, mark) {
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(inner);
    if (!m || !m[2]) return inner;
    if (/\n\n/.test(m[2])) return inner; // 複数ブロックを含む場合は装飾しない
    return `${m[1]}${mark}${m[2]}${mark}${m[3]}`;
  }

  /* ---------------------------------------------------------------- */

  function children(node, ctx) {
    let out = "";
    for (const child of node.childNodes) out += convert(child, ctx);
    return out;
  }

  function inlineOf(node, ctx) {
    return children(node, ctx).replace(/\s*\n+\s*/g, " ").trim();
  }

  function detectLanguage(pre, code) {
    const source = [
      code && code.getAttribute("class"),
      pre.getAttribute("class"),
      pre.getAttribute("data-lang"),
      code && code.getAttribute("data-lang"),
    ]
      .filter(Boolean)
      .join(" ");
    const m = /(?:language|lang|brush|highlight)[-:_ ]?([a-z0-9+#.-]+)/i.exec(source);
    if (m) return m[1].toLowerCase();
    // class="js" のように言語名だけ書かれている場合
    const known =
      /\b(javascript|typescript|jsx|tsx|js|ts|python|py|ruby|rb|go|rust|java|kotlin|swift|c|cpp|csharp|php|sql|html|xml|css|scss|json|yaml|yml|toml|bash|sh|shell|zsh|diff|markdown|md)\b/i.exec(
        source
      );
    return known ? known[1].toLowerCase() : "";
  }

  function convertPre(node, ctx) {
    const code = node.querySelector("code");
    const lang = detectLanguage(node, code);
    const text = ((code || node).textContent || "").replace(/\n+$/, "");
    const longest = (text.match(/^`{3,}/gm) || []).reduce((m, r) => Math.max(m, r.length), 2);
    const fence = "`".repeat(Math.max(3, longest + 1));
    return block(`${fence}${lang}\n${text}\n${fence}`);
  }

  function convertList(node, ctx) {
    const ordered = node.nodeName === "OL";
    let index = ordered ? parseInt(node.getAttribute("start"), 10) || 1 : 0;
    const items = [];

    for (const li of node.children) {
      if (li.nodeName !== "LI") continue;
      let marker = ordered ? `${index++}. ` : "- ";

      const box = li.querySelector(":scope > input[type='checkbox']");
      if (box) marker += box.hasAttribute("checked") || box.checked ? "[x] " : "[ ] ";

      let body = children(li, ctx).replace(/\n{3,}/g, "\n\n").trim();
      // 段落を持たない項目は行間を詰める (タイトな箇条書き)
      if (!li.querySelector(":scope > p")) body = body.replace(/\n{2,}/g, "\n");
      if (!body) continue;

      const indent = " ".repeat(marker.length);
      const lines = body
        .split("\n")
        .map((line, i) => (i === 0 ? marker + line : line ? indent + line : ""));
      items.push(lines.join("\n"));
    }

    return items.length ? `\n\n${items.join("\n")}\n\n` : "";
  }

  function convertTable(node, ctx) {
    const rows = Array.from(node.querySelectorAll("tr"));
    if (!rows.length) return "";

    const cellCtx = { ...ctx, inTable: true };
    const matrix = rows
      .map((tr) =>
        Array.from(tr.children)
          .filter((c) => c.nodeName === "TD" || c.nodeName === "TH")
          .map((cell) => inlineOf(cell, cellCtx) || " ")
      )
      .filter((cells) => cells.length);

    if (!matrix.length) return "";
    const width = matrix.reduce((m, r) => Math.max(m, r.length), 0);
    if (width < 2 && matrix.length < 2) {
      // 実質レイアウト用の表なので、中身だけ段落として出す
      return block(children(node, ctx));
    }

    const pad = (cells) => {
      const row = cells.slice();
      while (row.length < width) row.push(" ");
      return `| ${row.join(" | ")} |`;
    };

    const head = matrix[0];
    const lines = [pad(head), `| ${Array(width).fill("---").join(" | ")} |`];
    for (const row of matrix.slice(1)) lines.push(pad(row));
    return block(lines.join("\n"));
  }

  function convertImage(node) {
    const alt = (node.getAttribute("alt") || "").replace(/[\r\n]+/g, " ").trim();
    const candidates = [];
    const push = (v) => {
      if (v && v.trim()) candidates.push(v.trim());
    };
    push(node.getAttribute("src"));
    push(node.getAttribute("data-src"));
    push(node.getAttribute("data-original"));
    push(node.getAttribute("data-lazy-src"));
    const srcset = node.getAttribute("srcset") || node.getAttribute("data-srcset");
    if (srcset) {
      // 最後に並んでいる = 最も大きい候補を採用する
      const last = srcset.split(",").pop();
      if (last) push(last.trim().split(/\s+/)[0]);
    }
    if (!candidates.length) return "";

    // 1x1 の placeholder などを避けるため data URI 以外を優先
    const real = candidates.find((v) => !/^data:/i.test(v));
    const chosen = real || candidates[0];
    if (/^data:/i.test(chosen) && chosen.length > MAX_DATA_URI) return alt;

    const url = absolute(chosen, node);
    if (!url || /^javascript:/i.test(url)) return alt;
    const title = (node.getAttribute("title") || "").trim();
    return `![${alt}](${formatUrl(url)}${title ? ` "${title.replace(/"/g, '\\"')}"` : ""})`;
  }

  function convertLink(node, ctx) {
    const inner = children(node, ctx).replace(/\s*\n+\s*/g, " ").trim();
    if (!inner) return "";
    const href = (node.getAttribute("href") || "").trim();
    if (!href || href === "#" || /^javascript:/i.test(href)) return inner;
    const url = absolute(href, node);
    if (!/^(https?|mailto|tel|ftp):/i.test(url)) return inner;
    const title = (node.getAttribute("title") || "").trim();
    return `[${inner}](${formatUrl(url)}${title ? ` "${title.replace(/"/g, '\\"')}"` : ""})`;
  }

  function convertEmbed(node) {
    const src =
      node.getAttribute("src") ||
      (node.querySelector("source") && node.querySelector("source").getAttribute("src")) ||
      "";
    if (!src) return "";
    const url = absolute(src, node);
    if (!/^https?:/i.test(url)) return "";
    const label =
      node.nodeName === "VIDEO"
        ? msg("embedVideo", "動画")
        : node.nodeName === "AUDIO"
          ? msg("embedAudio", "音声")
          : msg("embedGeneric", "埋め込み");
    return block(`[${label}: ${url}](${formatUrl(url)})`);
  }

  /* ---------------------------------------------------------------- */

  function convert(node, ctx) {
    if (node.nodeType === 3) {
      const raw = node.nodeValue || "";
      if (ctx.pre) return raw;
      const t = raw.replace(/[\r\n]+/g, " ").replace(/[ \t\f\v]+/g, " ");
      if (!t.trim()) return t ? " " : "";
      return escapeText(t, ctx);
    }
    if (node.nodeType !== 1) return "";

    const tag = node.nodeName;
    if (SKIP.has(tag)) return "";

    switch (tag) {
      case "H1":
      case "H2":
      case "H3":
      case "H4":
      case "H5":
      case "H6": {
        const text = inlineOf(node, ctx);
        return text ? block(`${"#".repeat(Number(tag[1]))} ${text}`) : "";
      }
      case "P":
        return block(children(node, ctx));
      case "BR":
        return "  \n";
      case "HR":
        return block("---");
      case "STRONG":
      case "B":
        return wrap(children(node, ctx), "**");
      case "EM":
      case "I":
      case "CITE":
      case "DFN":
        return wrap(children(node, ctx), "*");
      case "DEL":
      case "S":
      case "STRIKE":
        return wrap(children(node, ctx), "~~");
      case "CODE":
      case "KBD":
      case "SAMP":
      case "TT":
        return ctx.pre ? children(node, ctx) : codeSpan(node.textContent || "");
      case "A":
        return convertLink(node, ctx);
      case "IMG":
        return convertImage(node);
      case "PICTURE": {
        const img = node.querySelector("img");
        return img ? convertImage(img) : "";
      }
      case "PRE":
        return convertPre(node, { ...ctx, pre: true });
      case "BLOCKQUOTE": {
        const inner = children(node, ctx).replace(/\n{3,}/g, "\n\n").trim();
        if (!inner) return "";
        return block(
          inner
            .split("\n")
            .map((line) => (line ? `> ${line}` : ">"))
            .join("\n")
        );
      }
      case "UL":
      case "OL":
        return convertList(node, ctx);
      case "LI":
        // ul/ol の外にある li (壊れた HTML) 用の保険
        return block(`- ${children(node, ctx).trim()}`);
      case "DL":
        return block(children(node, ctx));
      case "DT":
        return block(`**${inlineOf(node, ctx)}**`);
      case "DD":
        return block(children(node, ctx));
      case "TABLE":
        return convertTable(node, ctx);
      case "TD":
      case "TH":
        // 表の外で単独に出てきた場合
        return `${children(node, ctx)} `;
      case "FIGURE":
        return block(children(node, ctx));
      case "FIGCAPTION": {
        const text = inlineOf(node, ctx);
        return text ? block(`*${text}*`) : "";
      }
      case "DETAILS":
        return block(children(node, ctx));
      case "SUMMARY": {
        const text = inlineOf(node, ctx);
        return text ? block(`**${text}**`) : "";
      }
      case "IFRAME":
      case "VIDEO":
      case "AUDIO":
        return convertEmbed(node);
      case "SUP":
        return `^${inlineOf(node, ctx)}^`;
      case "SUB":
        return `~${inlineOf(node, ctx)}~`;
      default:
        return BLOCK.has(tag) ? block(children(node, ctx)) : children(node, ctx);
    }
  }

  function tidy(md) {
    return md
      .replace(/[\u00a0\u200b\ufeff]/g, " ")
      // 空白だけの行は空行にする (要素を落とした跡が残らないように)
      .replace(/^[ \t]+$/gm, "")
      // 行末の空白2つ以上は改行指定なので残す
      .replace(/[ \t]+\n/g, (m) => (/[ \t]{2,}\n$/.test(m) ? "  \n" : "\n"))
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function htmlToMarkdown(root) {
    if (!root) return "";
    return tidy(children(root, { pre: false, inTable: false }));
  }

  NS.htmlToMarkdown = htmlToMarkdown;
})();
