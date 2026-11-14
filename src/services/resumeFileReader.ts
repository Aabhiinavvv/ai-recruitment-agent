import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import JSZip from 'jszip';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface ExtractedResumeFileResult {
  text: string;
  fileName: string;
  fileType: string;
  usedFallback: boolean;
  errorReason?: string;
}

interface PdfTextItemLike {
  str?: string;
  transform?: number[];
  width?: number;
  hasEOL?: boolean;
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    });
}

function normalizeExtractedText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/**
 * Reconstruct clean reading-order lines from PDF text items by grouping into Y bands
 * and sorting left-to-right within each band.
 */
function reconstructPdfPageLines(items: PdfTextItemLike[]): string {
  const positioned = items
    .filter((item) => typeof item.str === 'string' && item.str.trim().length > 0 && Array.isArray(item.transform))
    .map((item) => ({
      str: item.str as string,
      x: Number(item.transform?.[4] ?? 0),
      y: Number(item.transform?.[5] ?? 0),
      width: Number(item.width ?? 0),
      hasEOL: Boolean(item.hasEOL),
    }));

  if (positioned.length === 0) return '';

  // Sort top-to-bottom (higher Y first in PDF coordinates), then left-to-right
  positioned.sort((a, b) => {
    const yDiff = b.y - a.y;
    if (Math.abs(yDiff) > 3.5) return yDiff;
    return a.x - b.x;
  });

  // Group into lines using 3.5pt Y tolerance
  const lines: Array<{ y: number; tokens: typeof positioned }> = [];
  for (const token of positioned) {
    const existingLine = lines.find((line) => Math.abs(line.y - token.y) <= 3.5);
    if (existingLine) {
      existingLine.tokens.push(token);
    } else {
      lines.push({ y: token.y, tokens: [token] });
    }
  }

  // Sort lines top-to-bottom, and sort tokens left-to-right inside each line
  lines.sort((a, b) => b.y - a.y);

  const renderedLines = lines.map((line) => {
    line.tokens.sort((a, b) => a.x - b.x);
    let lineText = '';
    let prevEndX = -Infinity;

    for (const tok of line.tokens) {
      const piece = tok.str.trim();
      if (!piece) continue;

      if (!lineText) {
        lineText = piece;
      } else {
        const gap = tok.x - prevEndX;
        if (gap > 28) {
          lineText += `  |  ${piece}`;
        } else if (gap > 1.5 || (!lineText.endsWith(' ') && !piece.startsWith(' '))) {
          lineText += ` ${piece}`;
        } else {
          lineText += piece;
        }
      }
      prevEndX = tok.x + Math.max(tok.width, piece.length * 4);
    }

    return lineText.trim();
  });

  return renderedLines.filter(Boolean).join('\n');
}

async function extractTextWithPdfJs(buffer: ArrayBuffer): Promise<string> {
  const uint8 = new Uint8Array(buffer);
  const loadingTask = pdfjsLib.getDocument({
    data: uint8,
    useSystemFonts: true,
    disableFontFace: true,
  });

  const pdfDoc = await loadingTask.promise;
  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const content = await page.getTextContent();
    const reconstructed = reconstructPdfPageLines(content.items as PdfTextItemLike[]);
    if (reconstructed) {
      pageTexts.push(reconstructed);
    }
  }

  await loadingTask.destroy();
  return normalizeExtractedText(pageTexts.join('\n\n'));
}

// Secondary low-level fallback in case PDF.js worker fails in a restricted context
function unescapePdfLiteral(raw: string): string {
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch !== '\\') {
      out += ch;
      continue;
    }
    const next = raw[i + 1];
    if (next === undefined) break;
    i++;
    if (next === 'n') out += '\n';
    else if (next === 'r') out += '\r';
    else if (next === 't') out += '\t';
    else if (next === '(' || next === ')' || next === '\\') out += next;
    else out += next;
  }
  return out;
}

async function extractLegacyPdfText(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  const latinText = new TextDecoder('latin1').decode(bytes);
  const chunks: string[] = [];

  const streamRegex = /stream\r?\n([\s\S]*?)\r?\n?endstream/g;
  let match: RegExpExecArray | null;
  while ((match = streamRegex.exec(latinText)) !== null) {
    const start = match.index + match[0].indexOf(match[1]);
    const rawSlice = bytes.slice(start, start + match[1].length);
    let content = match[1];
    if (rawSlice.length >= 2 && rawSlice[0] === 0x78 && typeof DecompressionStream !== 'undefined') {
      for (const fmt of ['deflate', 'deflate-raw'] as const) {
        try {
          const copy = new Uint8Array(rawSlice.byteLength);
          copy.set(rawSlice);
          const stream = new Blob([copy.buffer]).stream().pipeThrough(new DecompressionStream(fmt));
          const out = await new Response(stream).arrayBuffer();
          content = new TextDecoder('latin1').decode(out);
          break;
        } catch {
          // try next format
        }
      }
    }
    const litRegex = /\(((?:\\.|[^\\()])*)\)\s*Tj/g;
    let m: RegExpExecArray | null;
    while ((m = litRegex.exec(content)) !== null) {
      const val = unescapePdfLiteral(m[1]).trim();
      if (val) chunks.push(val);
    }
  }

  return normalizeExtractedText(chunks.join('\n'));
}

function extractWordXmlText(xmlString: string): string {
  return normalizeExtractedText(
    decodeXmlEntities(
      xmlString
        .replace(/<w:tab\b[^>]*\/>/g, '  ')
        .replace(/<w:br\b[^>]*\/>/g, '\n')
        .replace(/<w:cr\b[^>]*\/>/g, '\n')
        .replace(/<\/w:tc>/g, '  |  ')
        .replace(/<\/w:p>/g, '\n')
        .replace(/<\/w:tr>/g, '\n')
        .replace(/<[^>]+>/g, '')
    )
  );
}

async function extractTextFromDocxBuffer(buffer: ArrayBuffer): Promise<string> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const orderedNames: string[] = [];

    // Headers often contain the candidate's name & contact info in Word templates
    const headerFiles = Object.keys(zip.files)
      .filter((name) => /^word\/header\d*\.xml$/i.test(name))
      .sort();
    orderedNames.push(...headerFiles);

    if (zip.files['word/document.xml']) {
      orderedNames.push('word/document.xml');
    }

    const footerFiles = Object.keys(zip.files)
      .filter((name) => /^word\/footer\d*\.xml$/i.test(name))
      .sort();
    orderedNames.push(...footerFiles);

    const sections: string[] = [];
    for (const filePath of orderedNames) {
      const entry = zip.files[filePath];
      if (!entry || entry.dir) continue;
      const xml = await entry.async('string');
      const text = extractWordXmlText(xml);
      if (text) sections.push(text);
    }

    return normalizeExtractedText(sections.join('\n'));
  } catch {
    return '';
  }
}

export async function extractTextFromResumeFile(file: File): Promise<ExtractedResumeFileResult> {
  const fileName = file.name;
  const ext = fileName.split('.').pop()?.toLowerCase() || 'txt';

  if (ext === 'pdf') {
    const buffer = await file.arrayBuffer();
    let pdfText = '';
    try {
      pdfText = await extractTextWithPdfJs(buffer);
    } catch {
      pdfText = await extractLegacyPdfText(buffer);
    }

    const alphaCount = (pdfText.match(/[\p{L}\p{N}]/gu) || []).length;
    if (alphaCount >= 20) {
      return {
        text: pdfText,
        fileName,
        fileType: 'PDF',
        usedFallback: false,
      };
    }

    return {
      text: '',
      fileName,
      fileType: 'PDF',
      usedFallback: true,
      errorReason:
        'Could not find selectable text inside this PDF (it may be a scanned image PDF). Please upload a text-based PDF/DOCX or paste the resume text below.',
    };
  }

  if (ext === 'docx') {
    const buffer = await file.arrayBuffer();
    const docxText = await extractTextFromDocxBuffer(buffer);
    const alphaCount = (docxText.match(/[\p{L}\p{N}]/gu) || []).length;

    if (alphaCount >= 20) {
      return {
        text: docxText,
        fileName,
        fileType: 'DOCX',
        usedFallback: false,
      };
    }

    return {
      text: '',
      fileName,
      fileType: 'DOCX',
      usedFallback: true,
      errorReason:
        'Could not extract readable text from this DOCX file. Please verify the file is not corrupted or paste the resume text below.',
    };
  }

  // Plain text / Markdown / RTF
  const rawText = await file.text();
  if (ext === 'rtf' || rawText.startsWith('{\\rtf')) {
    const stripped = normalizeExtractedText(
      rawText
        .replace(/\\par[d]?/g, '\n')
        .replace(/\\[a-z]+-?\d* ?/g, '')
        .replace(/[{}]/g, '')
    );
    return {
      text: stripped,
      fileName,
      fileType: 'RTF',
      usedFallback: stripped.length < 20,
      errorReason:
        stripped.length < 20 ? 'The uploaded RTF document appears empty or unreadable.' : undefined,
    };
  }

  const normalized = normalizeExtractedText(rawText);
  return {
    text: normalized,
    fileName,
    fileType: ext.toUpperCase(),
    usedFallback: normalized.length < 20,
    errorReason:
      normalized.length < 20 ? 'The uploaded text file contains too little text to parse.' : undefined,
  };
}
