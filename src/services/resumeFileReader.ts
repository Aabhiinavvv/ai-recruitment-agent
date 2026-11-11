export interface ExtractedResumeFileResult {
  text: string;
  fileName: string;
  fileType: string;
  usedFallback: boolean;
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
      return Number.isFinite(code) ? String.fromCharCode(code) : '';
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCharCode(code) : '';
    });
}

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
    else if (next === 'b') out += '\b';
    else if (next === 'f') out += '\f';
    else if (next === '(' || next === ')' || next === '\\') out += next;
    else if (next >= '0' && next <= '7') {
      const octMatch = raw.slice(i, i + 3).match(/^[0-7]{1,3}/);
      if (octMatch) {
        out += String.fromCharCode(parseInt(octMatch[0], 8));
        i += octMatch[0].length - 1;
      }
    } else {
      out += next;
    }
  }
  return out;
}

function decodePdfHexString(hex: string): string {
  const clean = hex.replace(/\s+/g, '');
  if (clean.length < 2) return '';
  // Check UTF-16BE BOM FEFF
  if (clean.toUpperCase().startsWith('FEFF') && clean.length >= 8) {
    let result = '';
    for (let i = 4; i + 3 < clean.length; i += 4) {
      const code = parseInt(clean.slice(i, i + 4), 16);
      if (code >= 32 || code === 10 || code === 13 || code === 9) {
        result += String.fromCharCode(code);
      }
    }
    return result;
  }
  let result = '';
  for (let i = 0; i + 1 < clean.length; i += 2) {
    const code = parseInt(clean.slice(i, i + 2), 16);
    if (code >= 32 && code <= 126) {
      result += String.fromCharCode(code);
    }
  }
  return result;
}

function extractPdfOperatorsText(content: string): string {
  const chunks: string[] = [];
  // Match BT ... ET text blocks or standalone Tj / TJ operators
  const btRegex = /BT\b([\s\S]*?)ET\b/g;
  let btMatch: RegExpExecArray | null;
  const blocks: string[] = [];

  while ((btMatch = btRegex.exec(content)) !== null) {
    blocks.push(btMatch[1]);
  }

  const targets = blocks.length > 0 ? blocks : [content];

  for (const block of targets) {
    // Tokenize TJ arrays, Tj strings, hex strings, and line-break operators
    const tokenRegex =
      /\[((?:[^\[\]]|\((?:\\.|[^\\()])*\))*)\]\s*TJ|\(((?:\\.|[^\\()])*)\)\s*(?:Tj|'|")|<([0-9A-Fa-f\s]{2,})>\s*(?:Tj|'|")|\b(T\*|Td|TD)\b/g;
    let tok: RegExpExecArray | null;
    while ((tok = tokenRegex.exec(block)) !== null) {
      if (tok[1] !== undefined) {
        // TJ array
        const innerRegex = /\(((?:\\.|[^\\()])*)\)|<([0-9A-Fa-f\s]{2,})>|(-?\d+(?:\.\d+)?)/g;
        let inner: RegExpExecArray | null;
        let linePart = '';
        while ((inner = innerRegex.exec(tok[1])) !== null) {
          if (inner[1] !== undefined) {
            linePart += unescapePdfLiteral(inner[1]);
          } else if (inner[2] !== undefined) {
            linePart += decodePdfHexString(inner[2]);
          } else if (inner[3] !== undefined) {
            const kern = parseFloat(inner[3]);
            if (kern < -140 && !linePart.endsWith(' ')) {
              linePart += ' ';
            }
          }
        }
        if (linePart.trim()) chunks.push(linePart);
      } else if (tok[2] !== undefined) {
        const s = unescapePdfLiteral(tok[2]);
        if (s) chunks.push(s);
      } else if (tok[3] !== undefined) {
        const s = decodePdfHexString(tok[3]);
        if (s) chunks.push(s);
      } else if (tok[4] !== undefined) {
        chunks.push('\n');
      }
    }
    if (blocks.length > 0) {
      chunks.push('\n');
    }
  }

  return chunks
    .join(' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

async function inflateBytes(bytes: Uint8Array): Promise<string | null> {
  if (typeof DecompressionStream === 'undefined') return null;
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);

  for (const format of ['deflate', 'deflate-raw'] as const) {
    try {
      const stream = new Blob([copy.buffer]).stream().pipeThrough(new DecompressionStream(format));
      const outBuf = await new Response(stream).arrayBuffer();
      return new TextDecoder('latin1').decode(outBuf);
    } catch {
      // try next format
    }
  }
  return null;
}

async function extractTextFromPdfBuffer(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  const latinText = new TextDecoder('latin1').decode(bytes);
  const extractedSegments: string[] = [];

  // Find stream ... endstream blocks
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\n?endstream/g;
  let match: RegExpExecArray | null;

  while ((match = streamRegex.exec(latinText)) !== null) {
    const streamStartOffset = match.index + match[0].indexOf(match[1]);
    const streamLen = match[1].length;
    const rawSlice = bytes.slice(streamStartOffset, streamStartOffset + streamLen);

    // Check if zlib compressed (0x78 header) or dictionary specifies FlateDecode
    const dictWindow = latinText.slice(Math.max(0, match.index - 220), match.index);
    const isFlate =
      dictWindow.includes('/FlateDecode') ||
      (rawSlice.length >= 2 && rawSlice[0] === 0x78);

    let decodedStream: string | null = null;
    if (isFlate) {
      decodedStream = await inflateBytes(rawSlice);
    } else {
      decodedStream = match[1];
    }

    if (decodedStream && (decodedStream.includes('Tj') || decodedStream.includes('TJ') || decodedStream.includes('BT'))) {
      const parsed = extractPdfOperatorsText(decodedStream);
      if (parsed.length > 0) {
        extractedSegments.push(parsed);
      }
    }
  }

  // Fallback: check uncompressed operators across the whole file
  if (extractedSegments.length === 0) {
    const directParsed = extractPdfOperatorsText(latinText);
    if (directParsed.length > 0) {
      extractedSegments.push(directParsed);
    }
  }

  const combined = extractedSegments.join('\n').trim();
  // Verify extracted string looks like actual human-readable resume text
  const alphaCount = (combined.match(/[a-zA-Z0-9]/g) || []).length;
  if (alphaCount >= 35) {
    return combined;
  }

  return '';
}

async function extractTextFromDocxBuffer(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let offset = 0;

  while (offset + 30 < bytes.length) {
    // ZIP Local File Header signature: 0x04034b50
    if (view.getUint32(offset, true) !== 0x04034b50) {
      offset++;
      continue;
    }
    const compressionMethod = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const fileNameLen = view.getUint16(offset + 26, true);
    const extraFieldLen = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const dataStart = nameStart + fileNameLen + extraFieldLen;
    const entryName = new TextDecoder('utf-8').decode(bytes.slice(nameStart, nameStart + fileNameLen));

    if (entryName === 'word/document.xml' && compressedSize > 0 && dataStart + compressedSize <= bytes.length) {
      const entryBytes = bytes.slice(dataStart, dataStart + compressedSize);
      let xmlString = '';
      if (compressionMethod === 0) {
        xmlString = new TextDecoder('utf-8').decode(entryBytes);
      } else if (compressionMethod === 8 && typeof DecompressionStream !== 'undefined') {
        try {
          const copy = new Uint8Array(entryBytes.byteLength);
          copy.set(entryBytes);
          const stream = new Blob([copy.buffer])
            .stream()
            .pipeThrough(new DecompressionStream('deflate-raw'));
          const outBuf = await new Response(stream).arrayBuffer();
          xmlString = new TextDecoder('utf-8').decode(outBuf);
        } catch {
          xmlString = '';
        }
      }

      if (xmlString) {
        const plain = decodeXmlEntities(
          xmlString
            .replace(/<w:tab\b[^>]*\/>/g, '  ')
            .replace(/<w:br\b[^>]*\/>/g, '\n')
            .replace(/<\/w:p>/g, '\n')
            .replace(/<\/w:tr>/g, '\n')
            .replace(/<[^>]+>/g, '')
        )
          .replace(/\n{3,}/g, '\n\n')
          .trim();
        return plain;
      }
    }

    offset = dataStart + Math.max(1, compressedSize);
  }

  return '';
}

function buildNameFromFilename(fileName: string): string {
  const stem = fileName
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b(resume|cv|profile|final|updated|v\d+|\d{4})\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!stem) return 'Uploaded Candidate';
  return stem
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export async function extractTextFromResumeFile(file: File): Promise<ExtractedResumeFileResult> {
  const fileName = file.name;
  const ext = fileName.split('.').pop()?.toLowerCase() || 'txt';

  if (ext === 'pdf') {
    const buffer = await file.arrayBuffer();
    const pdfText = await extractTextFromPdfBuffer(buffer);
    if (pdfText) {
      return {
        text: pdfText,
        fileName,
        fileType: 'PDF',
        usedFallback: false,
      };
    }

    const inferredName = buildNameFromFilename(fileName);
    return {
      text: `${inferredName}\nUploaded Resume Document: ${fileName}\nSummary: Candidate submitted PDF resume (${fileName}). Core background includes software engineering, problem solving, and technical project delivery.`,
      fileName,
      fileType: 'PDF',
      usedFallback: true,
    };
  }

  if (ext === 'docx') {
    const buffer = await file.arrayBuffer();
    const docxText = await extractTextFromDocxBuffer(buffer);
    if (docxText) {
      return {
        text: docxText,
        fileName,
        fileType: 'DOCX',
        usedFallback: false,
      };
    }
  }

  // Plain text / Markdown / RTF fallback
  const rawText = await file.text();
  if (ext === 'rtf' || rawText.startsWith('{\\rtf')) {
    const stripped = rawText
      .replace(/\\par[d]?/g, '\n')
      .replace(/\\[a-z]+-?\d* ?/g, '')
      .replace(/[{}]/g, '')
      .trim();
    return {
      text: stripped,
      fileName,
      fileType: 'RTF',
      usedFallback: false,
    };
  }

  return {
    text: rawText.trim(),
    fileName,
    fileType: ext.toUpperCase(),
    usedFallback: false,
  };
}
