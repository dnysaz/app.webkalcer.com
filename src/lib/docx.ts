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