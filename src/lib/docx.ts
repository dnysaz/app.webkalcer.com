import { Document, ExternalHyperlink, HeadingLevel, Packer, Paragraph, ShadingType, TextRun } from "docx";

const HEADING_LEVELS: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
  5: HeadingLevel.HEADING_5,
  6: HeadingLevel.HEADING_6,
};

type InlinePiece = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  href?: string;
};

function parseInline(src: string): InlinePiece[] {
  const pieces: InlinePiece[] = [];
  const re = /(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)|\*([^*\n]+)\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    if (m.index > last) pieces.push({ text: src.slice(last, m.index) });
    if (m[2] !== undefined) pieces.push({ text: m[2], bold: true });
    else if (m[3] !== undefined) pieces.push({ text: m[3], code: true });
    else if (m[4] !== undefined && m[5] !== undefined) pieces.push({ text: m[4], href: m[5] });
    else if (m[6] !== undefined) pieces.push({ text: m[6], italic: true });
    last = m.index + m[0].length;
  }
  if (last < src.length) pieces.push({ text: src.slice(last) });
  return pieces;
}

function childrenFor(src: string): (TextRun | ExternalHyperlink)[] {
  const out: (TextRun | ExternalHyperlink)[] = [];
  for (const p of parseInline(src)) {
    if (p.href) {
      out.push(new ExternalHyperlink({ children: [new TextRun({ text: p.text, style: "Hyperlink" })], link: p.href }));
    } else {
      const opts: ConstructorParameters<typeof TextRun>[0] = {
        text: p.text,
        ...(p.bold ? { bold: true } : {}),
        ...(p.italic ? { italics: true } : {}),
        ...(p.code ? { font: "Consolas", size: 19 } : {}),
      };
      out.push(new TextRun(opts));
    }
  }
  return out;
}

function codeParagraphs(lines: string[]): Paragraph[] {
  return lines.map(
    (text) =>
      new Paragraph({
        children: [new TextRun({ text, font: "Consolas", size: 18, color: "334E45" })],
        shading: { type: ShadingType.CLEAR, color: "auto", fill: "F1F4F1" },
        spacing: { after: 20 },
      }),
  );
}

/** Converts the article's Markdown into Word paragraphs. H1–H6 become real heading styles. */
function blocksFromMarkdown(markdown: string): Paragraph[] {
  const lines = markdown.split("\n");
  const blocks: Paragraph[] = [];
  let para: string[] = [];
  let inCode = false;
  let codeBuffer: string[] = [];

  const flushPara = () => {
    if (para.length) {
      blocks.push(new Paragraph({ children: childrenFor(para.join(" ")), spacing: { after: 160 } }));
      para = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Fenced code block.
    if (/^```/.test(trimmed)) {
      if (inCode) {
        for (const p of codeParagraphs(codeBuffer)) blocks.push(p);
        codeBuffer = [];
        inCode = false;
      } else {
        flushPara();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeBuffer.push(line);
      continue;
    }

    if (!trimmed) {
      flushPara();
      continue;
    }

    // ATX headings → real Word heading styles (H1–H6).
    const h = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flushPara();
      const level = h[1].length;
      blocks.push(
        new Paragraph({
          children: childrenFor(h[2]),
          heading: HEADING_LEVELS[level],
          spacing: { before: 220, after: 140 },
        }),
      );
      continue;
    }

    // Horizontal rule — keep as a small gap.
    if (/^(\s*[-*_]\s*){3,}$/.test(trimmed)) {
      flushPara();
      blocks.push(new Paragraph({ children: [] }));
      continue;
    }

    // Unordered list.
    const bullet = trimmed.match(/^\s*[-*•]\s+(.*)$/);
    if (bullet) {
      flushPara();
      blocks.push(new Paragraph({ children: childrenFor(bullet[1]), bullet: { level: 0 }, spacing: { after: 60 } }));
      continue;
    }

    // Ordered list — kept as text so items still read as numbered.
    const numbered = trimmed.match(/^\s*(\d+)[.)]\s+(.*)$/);
    if (numbered) {
      flushPara();
      blocks.push(
        new Paragraph({
          children: childrenFor(`${numbered[1]}. ${numbered[2]}`),
          indent: { left: 480 },
          spacing: { after: 60 },
        }),
      );
      continue;
    }

    if (trimmed.startsWith(">")) {
      flushPara();
      blocks.push(
        new Paragraph({
          children: childrenFor(trimmed.replace(/^>\s?/, "")),
          indent: { left: 500 },
          spacing: { after: 120 },
        }),
      );
      continue;
    }

    para.push(trimmed);
  }
  flushPara();
  if (inCode) for (const p of codeParagraphs(codeBuffer)) blocks.push(p);
  return blocks;
}

/** Builds a Word (.docx) document from the article's Markdown and returns it as a Blob. */
export async function buildArticleDocxBlob(info: { title: string; content: string }): Promise<Blob> {
  const doc = new Document({
    creator: "webkalcerCRM",
    title: info.title,
    description: "Article generated by webkalcer.com",
    styles: {
      default: {
        document: { run: { font: "Calibri", size: 22 } },
        heading1: { run: { bold: true, color: "234B42", size: 34 }, paragraph: { spacing: { before: 340, after: 180 } } },
        heading2: { run: { bold: true, color: "234B42", size: 28 }, paragraph: { spacing: { before: 300, after: 160 } } },
        heading3: { run: { bold: true, color: "3A665A", size: 25 }, paragraph: { spacing: { before: 260, after: 140 } } },
        heading4: { run: { bold: true, color: "3A665A", size: 22 }, paragraph: { spacing: { before: 220, after: 120 } } },
        heading5: { run: { bold: true, color: "475569", size: 22 }, paragraph: { spacing: { before: 220, after: 120 } } },
        heading6: { run: { bold: true, color: "475569", size: 20 }, paragraph: { spacing: { before: 220, after: 120 } } },
      },
    },
    sections: [{ children: blocksFromMarkdown(info.content) }],
  });
  return Packer.toBlob(doc);
}

// ---- Note Word (clean white page, HTML-based, no header/footer) ----

/** Collect inline text runs from an HTML element, preserving B/I/U. */
function collectRunsFromHtml(node: ChildNode): { text: string; bold: boolean; italic: boolean; underline: boolean }[] {
  if (node.nodeType === 3) {
    const t = node.textContent || "";
    return t ? [{ text: t, bold: false, italic: false, underline: false }] : [];
  }
  if (node.nodeType !== 1) return [];
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  const isBold = tag === "b" || tag === "strong";
  const isItalic = tag === "i" || tag === "em";
  const isUnderline = tag === "u";
  const runs: { text: string; bold: boolean; italic: boolean; underline: boolean }[] = [];
  for (const child of el.childNodes) {
    for (const r of collectRunsFromHtml(child)) {
      runs.push({
        text: r.text,
        bold: r.bold || isBold,
        italic: r.italic || isItalic,
        underline: r.underline || isUnderline,
      });
    }
  }
  return runs;
}

/** Convert collected runs into docx TextRun children. */
function runsToTextRuns(runs: { text: string; bold: boolean; italic: boolean; underline: boolean }[]): TextRun[] {
  return runs.map((r) =>
    new TextRun({
      text: r.text,
      ...(r.bold ? { bold: true } : {}),
      ...(r.italic ? { italics: true } : {}),
      ...(r.underline ? { underline: {} } : {}),
    }),
  );
}

/**
 * Builds a clean note Word document — white page with just the title and
 * formatted content. No header, no footer. Preserves bold, italic, underline
 * and lists from the HTML content.
 */
export async function buildNoteDocxBlob(info: { title: string; content: string }): Promise<Blob> {
  const parsed = new DOMParser().parseFromString(info.content || "<div></div>", "text/html");
  const body = parsed.body;
  const children: Paragraph[] = [];

  // Title paragraph
  children.push(
    new Paragraph({
      children: [new TextRun({ text: info.title || "Untitled note", bold: true, size: 40, font: "Calibri" })],
      spacing: { after: 200 },
    }),
  );

  // Content blocks
  for (const child of Array.from(body.childNodes)) {
    if (child.nodeType === 3) {
      const text = (child.textContent || "").trim();
      if (!text) continue;
      children.push(
        new Paragraph({
          children: [new TextRun({ text, size: 22, font: "Calibri" })],
          spacing: { after: 120 },
        }),
      );
    } else if (child.nodeType === 1) {
      const el = child as HTMLElement;
      const tag = el.tagName.toLowerCase();

      if (tag === "ul") {
        const items = el.querySelectorAll(":scope > li");
        items.forEach((li) => {
          children.push(
            new Paragraph({
              children: runsToTextRuns(collectRunsFromHtml(li)),
              bullet: { level: 0 },
              spacing: { after: 60 },
            }),
          );
        });
      } else if (tag === "ol") {
        const items = el.querySelectorAll(":scope > li");
        items.forEach((li, idx) => {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: `${idx + 1}. `, size: 22, font: "Calibri" }),
                ...runsToTextRuns(collectRunsFromHtml(li)),
              ],
              spacing: { after: 60 },
            }),
          );
        });
      } else {
        // div / p / other block
        const runs = collectRunsFromHtml(el);
        if (runs.length) {
          children.push(
            new Paragraph({
              children: runsToTextRuns(runs),
              spacing: { after: 120 },
            }),
          );
        }
      }
    }
  }

  const doc = new Document({
    creator: "webkalcerCRM",
    title: info.title,
    description: "Note from webkalcerCRM",
    styles: {
      default: {
        document: { run: { font: "Calibri", size: 22 } },
      },
    },
    sections: [{ children }],
  });
  return Packer.toBlob(doc);
}