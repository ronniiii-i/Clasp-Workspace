import { sanitizeRichText } from "@/lib/sanitize-html";

/**
 * Lightweight Markdown <-> HTML bridge used by the rich-text document editor.
 *
 * Seeded documents are Markdown while the editor is HTML-based, so the editor
 * converts on load/save. It intentionally covers the formatting exposed in the
 * toolbar (headings, emphasis, lists, quotes, code and links); anything else
 * is preserved as plain text rather than lost.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeHref(href: string): string {
  const trimmed = href.trim();
  if (/^(https?:|mailto:|\/|#)/i.test(trimmed)) return escapeHtml(trimmed);
  return "#";
}

function inlineMarkdownToHtml(value: string): string {
  let out = escapeHtml(value);
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  out = out.replace(/_([^_]+)_/g, "<em>$1</em>");
  out = out.replace(/~~([^~]+)~~/g, "<s>$1</s>");
  out = out.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_match, label: string, href: string) =>
      `<a href="${safeHref(href)}">${label}</a>`,
  );
  return out;
}

/** Convert the Markdown subset used by seeded documents into editor HTML. */
export function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: string[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let quote: string[] = [];
  let code: string[] | null = null;

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push(`<p>${paragraph.map(inlineMarkdownToHtml).join("<br>")}</p>`);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      const tag = list.ordered ? "ol" : "ul";
      blocks.push(
        `<${tag}>${list.items
          .map((item) => `<li>${inlineMarkdownToHtml(item)}</li>`)
          .join("")}</${tag}>`,
      );
      list = null;
    }
  };
  const flushQuote = () => {
    if (quote.length) {
      blocks.push(
        `<blockquote>${quote.map(inlineMarkdownToHtml).join("<br>")}</blockquote>`,
      );
      quote = [];
    }
  };

  for (const line of lines) {
    if (code) {
      if (/^\s*```/.test(line)) {
        blocks.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
        code = null;
      } else {
        code.push(line);
      }
      continue;
    }
    if (/^\s*```/.test(line)) {
      flushParagraph();
      flushList();
      flushQuote();
      code = [];
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      flushList();
      flushQuote();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const quoted = line.match(/^\s*>\s?(.*)$/);

    if (heading) {
      flushParagraph();
      flushList();
      flushQuote();
      const level = heading[1].length;
      blocks.push(`<h${level}>${inlineMarkdownToHtml(heading[2])}</h${level}>`);
    } else if (bullet || ordered) {
      flushParagraph();
      flushQuote();
      const isOrdered = Boolean(ordered);
      if (!list || list.ordered !== isOrdered) {
        flushList();
        list = { ordered: isOrdered, items: [] };
      }
      list.items.push((bullet ?? ordered)![1]);
    } else if (quoted) {
      flushParagraph();
      flushList();
      quote.push(quoted[1]);
    } else {
      flushList();
      flushQuote();
      paragraph.push(line.trim());
    }
  }

  if (code) blocks.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
  flushParagraph();
  flushList();
  flushQuote();

  return sanitizeRichText(blocks.join(""));
}

function inlineHtmlToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent ?? "").replace(/([*_`[\]])/g, "\\$1");
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const element = node as HTMLElement;
  const children = Array.from(element.childNodes)
    .map(inlineHtmlToMarkdown)
    .join("");
  switch (element.tagName) {
    case "STRONG":
    case "B":
      return `**${children}**`;
    case "EM":
    case "I":
      return `*${children}*`;
    case "U":
      return `<u>${children}</u>`;
    case "S":
    case "STRIKE":
    case "DEL":
      return `~~${children}~~`;
    case "CODE":
      return `\`${children}\``;
    case "A":
      return `[${children}](${element.getAttribute("href") ?? "#"})`;
    case "BR":
      return "\n";
    default:
      return children;
  }
}

function blockToMarkdown(element: HTMLElement): string {
  switch (element.tagName) {
    case "H1":
    case "H2":
    case "H3": {
      const level = Number(element.tagName[1]);
      return `${"#".repeat(level)} ${inlineHtmlToMarkdown(element)}\n\n`;
    }
    case "P":
      return `${inlineHtmlToMarkdown(element).trim()}\n\n`;
    case "UL":
      return `${Array.from(element.children)
        .map((item) => `- ${inlineHtmlToMarkdown(item).trim()}`)
        .join("\n")}\n\n`;
    case "OL":
      return `${Array.from(element.children)
        .map((item, index) => `${index + 1}. ${inlineHtmlToMarkdown(item).trim()}`)
        .join("\n")}\n\n`;
    case "BLOCKQUOTE": {
      const text = inlineHtmlToMarkdown(element).trim();
      return `${text
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n")}\n\n`;
    }
    case "PRE": {
      const text = element.textContent ?? "";
      return `\`\`\`\n${text.trim()}\n\`\`\`\n\n`;
    }
    default:
      return `${inlineHtmlToMarkdown(element).trim()}\n\n`;
  }
}

/** Convert sanitized editor HTML back to the Markdown stored in the DB. */
export function htmlToMarkdown(html: string): string {
  if (typeof document === "undefined") return html;
  const parsed = new DOMParser().parseFromString(
    sanitizeRichText(html),
    "text/html",
  );
  return Array.from(parsed.body.childNodes)
    .map((node) =>
      node.nodeType === Node.ELEMENT_NODE
        ? blockToMarkdown(node as HTMLElement)
        : inlineHtmlToMarkdown(node),
    )
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** `<p></p>` is Tiptap's empty document, not meaningful content. */
export function isRichTextEmpty(html: string): boolean {
  return sanitizeRichText(html)
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim().length === 0;
}
