import JSZip from "jszip";
import { zipUncompressedSize, type AllowedExt } from "./validate";

const MAX_UNCOMPRESSED = 200 * 1024 * 1024;

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, "&");
}

async function pptxText(bytes: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  if (zipUncompressedSize(zip) > MAX_UNCOMPRESSED) throw new Error("archive too large");
  const slides = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  const parts: string[] = [];
  for (const [i, p] of slides.entries()) {
    const xml = await zip.file(p)!.async("string");
    const paragraphs = xml.split(/<\/a:p>/).map((para) =>
      [...para.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => decodeXmlEntities(m[1])).join(""),
    );
    parts.push(`--- Slide ${i + 1} ---\n${paragraphs.filter(Boolean).join("\n")}`);
  }
  return parts.join("\n\n");
}

async function docxText(bytes: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  if (zipUncompressedSize(zip) > MAX_UNCOMPRESSED) throw new Error("archive too large");
  const mammoth = await import("mammoth");
  const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  return value;
}

async function pdfText(bytes: Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(pdf, { mergePages: false });
  return (text as string[]).map((t, i) => `--- Page ${i + 1} ---\n${t}`).join("\n\n");
}

/**
 * Extracts plain text from a validated upload. The text is used for safe
 * previews (no active content is ever rendered) and for AI review.
 */
export async function extractText(ext: AllowedExt, bytes: Uint8Array): Promise<string> {
  switch (ext) {
    case "txt":
      return new TextDecoder("utf-8").decode(bytes);
    case "docx":
      return docxText(bytes);
    case "pptx":
      return pptxText(bytes);
    case "pdf":
      return pdfText(bytes);
  }
}

export function extFromName(name: string): AllowedExt | null {
  const e = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
  return e === "pdf" || e === "docx" || e === "pptx" || e === "txt" ? e : null;
}
