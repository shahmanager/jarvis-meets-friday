import { PDFDocument, StandardFonts } from 'pdf-lib';

const MAX_CHARS = 60_000;
const MAX_PDF_BYTES = 200_000;
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 54;
const FONT_SIZE = 10;
const LINE_HEIGHT = 14;

/** Create a paginated text PDF. Supports Helvetica's WinAnsi repertoire; input ≤60k chars, output ≤200k bytes. */
export async function createPdf(content: string): Promise<Uint8Array> {
  if (typeof content !== 'string') throw new TypeError('PDF content must be a string.');
  if (content.length > MAX_CHARS) throw new RangeError(`PDF content exceeds the 60,000-character limit.`);

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const normalized = content.replace(/\r\n?/g, '\n').replace(/\t/g, '    ');
  for (let i = 0; i < normalized.length;) {
    const cp = normalized.codePointAt(i)!;
    const char = String.fromCodePoint(cp);
    if (/[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufeff\u200e-\u200f\u202a-\u202e\u2066-\u2069]/u.test(char)) {
      throw new Error(`Right-to-left text is unsupported (U+${cp.toString(16).toUpperCase()}).`);
    }
    if (cp < 32 && char !== '\n') throw new Error(`Unsupported control character at offset ${i}.`);
    if (char !== '\n') {
      try { font.encodeText(char); }
      catch { throw new Error(`Unsupported PDF character at offset ${i} (U+${cp.toString(16).toUpperCase()}); use Latin/WinAnsi text.`); }
    }
    i += char.length;
  }

  const maxWidth = PAGE_WIDTH - MARGIN * 2;
  const wrap = (paragraph: string): string[] => {
    if (!paragraph) return [''];
    const result: string[] = [];
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      if (!word) continue;
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, FONT_SIZE) <= maxWidth) { line = candidate; continue; }
      if (line) result.push(line);
      line = '';
      for (const char of word) {
        if (line && font.widthOfTextAtSize(line + char, FONT_SIZE) > maxWidth) { result.push(line); line = ''; }
        line += char;
      }
    }
    if (line) result.push(line);
    return result;
  };

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;
  for (const paragraph of normalized.split('\n')) {
    for (const line of wrap(paragraph)) {
      if (y < MARGIN) { page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]); y = PAGE_HEIGHT - MARGIN; }
      if (line) page.drawText(line, { x: MARGIN, y, size: FONT_SIZE, font });
      y -= LINE_HEIGHT;
    }
  }

  const bytes = await pdf.save();
  if (bytes.byteLength > MAX_PDF_BYTES) throw new RangeError(`Generated PDF exceeds the ${MAX_PDF_BYTES}-byte artifact limit.`);
  return bytes;
}
