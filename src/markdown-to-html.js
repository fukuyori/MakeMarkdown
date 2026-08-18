/*
 * MakeMarkdown - Markdown から HTML への変換 (ビューアのプレビュー用)
 *
 * 入力は任意のページ由来なので、生の HTML は一切通さない。
 * テキストはすべてエスケープし、この変換器が生成したタグだけを出力する。
 *
 * 公開 API: MakeMarkdown.markdownToHtml(md) -> string
 */
(() => {
  "use strict";

  const NS = (globalThis.MakeMarkdown = globalThis.MakeMarkdown || {});
  if (NS.markdownToHtml) return;

  const escapeHtml = (s) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const SAFE_URL = /^(https?:|mailto:|tel:|ftp:|#)/i;
  const SAFE_IMAGE = /^(https?:|data:image\/(png|jpe?g|gif|webp|avif);)/i;

  function safeUrl(url, forImage) {
    const raw = String(url || "").trim().replace(/^<|>$/g, "");
    if (!raw) return "";
    const pattern = forImage ? SAFE_IMAGE : SAFE_URL;
    return pattern.test(raw) ? escapeHtml(raw) : "";
  }

  /* ---------------- インライン ---------------- */

  function inline(src) {
    const escaped = [];
    const codes = [];

    let text = String(src).replace(/\u0000/g, "");

    // 1. バックスラッシュエスケープを退避
    text = text.replace(/\\([\\`*_{}[\]()#+\-.!|~<>&"'])/g, (_, ch) => {
      escaped.push(ch);
      return `\u0000E${escaped.length - 1}\u0000`;
    });

    // 2. コードスパンを退避
    text = text.replace(/(`+)([\s\S]*?)\1/g, (_, fence, body) => {
      codes.push(body.replace(/^ ([\s\S]*) $/, "$1"));
      return `\u0000C${codes.length - 1}\u0000`;
    });

    // 3. 残りをエスケープ
    text = escapeHtml(text);

    // 4. 画像・リンク
    text = text.replace(
      /!\[([^\]]*)\]\(\s*(&lt;[^)]*?&gt;|(?:[^\s()]|\([^\s()]*\))+)(?:\s+&quot;([^&]*)&quot;)?\s*\)/g,
      (m, alt, url, title) => {
        const src2 = safeUrl(url.replace(/^&lt;|&gt;$/g, ""), true);
        if (!src2) return escapeHtml(alt);
        const t = title ? ` title="${title}"` : "";
        return `<img src="${src2}" alt="${alt}"${t} loading="lazy">`;
      }
    );
    text = text.replace(
      /\[([^\]]*)\]\(\s*(&lt;[^)]*?&gt;|(?:[^\s()]|\([^\s()]*\))+)(?:\s+&quot;([^&]*)&quot;)?\s*\)/g,
      (m, label, url, title) => {
        const href = safeUrl(url.replace(/^&lt;|&gt;$/g, ""), false);
        if (!href) return label;
        const t = title ? ` title="${title}"` : "";
        return `<a href="${href}"${t} target="_blank" rel="noreferrer noopener">${label}</a>`;
      }
    );
    // 自動リンク
    text = text.replace(/&lt;(https?:\/\/[^\s&<>]+)&gt;/g, (m, url) => {
      const href = safeUrl(url, false);
      return href ? `<a href="${href}" target="_blank" rel="noreferrer noopener">${href}</a>` : m;
    });

    // 5. 強調
    text = text
      .replace(/~~([\s\S]+?)~~/g, "<del>$1</del>")
      .replace(/\*\*([^\s*][\s\S]*?)\*\*/g, "<strong>$1</strong>")
      .replace(/(?<![A-Za-z0-9])__([^\s_][\s\S]*?)__(?![A-Za-z0-9])/g, "<strong>$1</strong>")
      .replace(/\*([^\s*][\s\S]*?)\*/g, "<em>$1</em>")
      .replace(/(?<![A-Za-z0-9])_([^\s_][\s\S]*?)_(?![A-Za-z0-9])/g, "<em>$1</em>");

    // 6. 行末2スペースは改行
    text = text.replace(/ {2,}\n/g, "<br>\n");

    // 7. 退避したものを戻す
    text = text.replace(/\u0000C(\d+)\u0000/g, (_, i) => `<code>${escapeHtml(codes[Number(i)])}</code>`);
    text = text.replace(/\u0000E(\d+)\u0000/g, (_, i) => escapeHtml(escaped[Number(i)]));

    return text;
  }

  /* ---------------- ブロック ---------------- */

  const RE_FENCE = /^ {0,3}(`{3,}|~{3,})\s*([^\s`]*)/;
  const RE_HEADING = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
  const RE_HR = /^ {0,3}([-*_])[ \t]*(?:\1[ \t]*){2,}$/;
  const RE_ITEM = /^(\s*)([-*+]|(\d{1,9})[.)])[ \t]+(.*)$/;
  const RE_DELIM = /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/;

  const isBlockStart = (line) =>
    RE_FENCE.test(line) ||
    RE_HEADING.test(line) ||
    RE_HR.test(line) ||
    RE_ITEM.test(line) ||
    /^ {0,3}>/.test(line);

  function splitRow(line) {
    const s = line.trim().replace(/^\|/, "").replace(/\|$/, "");
    const cells = [];
    let cur = "";
    for (let i = 0; i < s.length; i += 1) {
      if (s[i] === "\\" && s[i + 1] === "|") {
        cur += "|";
        i += 1;
      } else if (s[i] === "|") {
        cells.push(cur);
        cur = "";
      } else {
        cur += s[i];
      }
    }
    cells.push(cur);
    return cells.map((c) => c.trim());
  }

  function parseTable(lines, start) {
    const head = splitRow(lines[start]);
    const aligns = splitRow(lines[start + 1]).map((c) => {
      if (/^:-+:$/.test(c)) return "center";
      if (/^-+:$/.test(c)) return "right";
      if (/^:-+$/.test(c)) return "left";
      return "";
    });
    let i = start + 2;
    const rows = [];
    while (i < lines.length && lines[i].trim() && lines[i].includes("|")) {
      rows.push(splitRow(lines[i]));
      i += 1;
    }
    const cell = (tag, value, index) => {
      const style = aligns[index] ? ` style="text-align:${aligns[index]}"` : "";
      return `<${tag}${style}>${inline(value)}</${tag}>`;
    };
    let html = "<table><thead><tr>";
    head.forEach((c, n) => (html += cell("th", c, n)));
    html += "</tr></thead><tbody>";
    for (const row of rows) {
      html += "<tr>";
      row.forEach((c, n) => (html += cell("td", c, n)));
      html += "</tr>";
    }
    html += "</tbody></table>";
    return { html, next: i };
  }

  function parseList(lines, start) {
    const first = RE_ITEM.exec(lines[start]);
    const baseIndent = first[1].length;
    const ordered = Boolean(first[3]);
    const startNum = ordered ? parseInt(first[3], 10) : 1;

    const items = [];
    let current = null;
    let markerWidth = 2;
    let loose = false;
    let i = start;

    while (i < lines.length) {
      const line = lines[i];

      if (!line.trim()) {
        let j = i + 1;
        while (j < lines.length && !lines[j].trim()) j += 1;
        if (j >= lines.length) break;
        const nextIndent = lines[j].match(/^\s*/)[0].length;
        const nextItem = RE_ITEM.exec(lines[j]);
        const sameKind =
          nextItem && nextItem[1].length === baseIndent && Boolean(nextItem[3]) === ordered;
        const belongs = nextIndent > baseIndent || sameKind;
        if (!belongs) break;
        if (current) current.push("");
        loose = true;
        i = j;
        continue;
      }

      const m = RE_ITEM.exec(line);
      if (m && m[1].length === baseIndent) {
        if (Boolean(m[3]) !== ordered) break;
        markerWidth = m[2].length + 1;
        current = [m[4]];
        items.push(current);
        i += 1;
        continue;
      }

      const indent = line.match(/^\s*/)[0].length;
      if (current && indent > baseIndent) {
        current.push(line.slice(Math.min(indent, baseIndent + markerWidth)));
        i += 1;
        continue;
      }
      if (current && !isBlockStart(line)) {
        // 折り返された行 (lazy continuation)
        current.push(line.trim());
        i += 1;
        continue;
      }
      break;
    }

    let html = ordered ? `<ol${startNum !== 1 ? ` start="${startNum}"` : ""}>` : "<ul>";
    let hasTask = false;
    for (const itemLines of items) {
      let body = itemLines.join("\n");
      let prefix = "";
      const task = /^\[([ xX])\]\s+/.exec(body);
      if (task) {
        hasTask = true;
        body = body.slice(task[0].length);
        prefix = `<input type="checkbox" disabled${/[xX]/.test(task[1]) ? " checked" : ""}> `;
      }
      let inner = blocks(body.split("\n"));
      if (!loose) inner = inner.replace(/^<p>([\s\S]*?)<\/p>/, "$1");
      html += `<li${task ? ' class="task"' : ""}>${prefix}${inner}</li>`;
    }
    html += ordered ? "</ol>" : "</ul>";
    if (hasTask) html = html.replace(/^<(ul|ol)/, '<$1 class="contains-task-list"');
    return { html, next: i };
  }

  function blocks(lines) {
    let out = "";
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      if (!line.trim()) {
        i += 1;
        continue;
      }

      const fence = RE_FENCE.exec(line);
      if (fence) {
        const marker = fence[1][0];
        const len = fence[1].length;
        const lang = fence[2];
        const buf = [];
        i += 1;
        const closing = new RegExp(`^ {0,3}\\${marker}{${len},}\\s*$`);
        while (i < lines.length && !closing.test(lines[i])) {
          buf.push(lines[i]);
          i += 1;
        }
        i += 1;
        const cls = /^[A-Za-z0-9+#._-]+$/.test(lang) ? ` class="language-${lang}"` : "";
        out += `<pre><code${cls}>${escapeHtml(buf.join("\n"))}</code></pre>`;
        continue;
      }

      const heading = RE_HEADING.exec(line);
      if (heading) {
        const level = heading[1].length;
        out += `<h${level}>${inline(heading[2])}</h${level}>`;
        i += 1;
        continue;
      }

      if (RE_HR.test(line)) {
        out += "<hr>";
        i += 1;
        continue;
      }

      if (/^ {0,3}>/.test(line)) {
        const buf = [];
        while (i < lines.length && lines[i].trim()) {
          if (/^ {0,3}>/.test(lines[i])) {
            buf.push(lines[i].replace(/^ {0,3}>[ \t]?/, ""));
          } else if (isBlockStart(lines[i])) {
            break;
          } else {
            buf.push(lines[i]); // 折り返された行 (lazy continuation)
          }
          i += 1;
        }
        out += `<blockquote>${blocks(buf)}</blockquote>`;
        continue;
      }

      if (line.includes("|") && i + 1 < lines.length && RE_DELIM.test(lines[i + 1])) {
        const table = parseTable(lines, i);
        out += table.html;
        i = table.next;
        continue;
      }

      if (RE_ITEM.test(line)) {
        const list = parseList(lines, i);
        out += list.html;
        i = list.next;
        continue;
      }

      const buf = [];
      while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) {
        buf.push(lines[i]);
        i += 1;
      }
      if (buf.length) out += `<p>${inline(buf.join("\n"))}</p>`;
      else i += 1;
    }

    return out;
  }

  function markdownToHtml(md) {
    const normalized = String(md || "")
      .replace(/\r\n?/g, "\n")
      .replace(/\t/g, "    ");
    return blocks(normalized.split("\n"));
  }

  NS.markdownToHtml = markdownToHtml;
})();
