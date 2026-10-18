import JSZip from "jszip";

export const ALLOWED_EXTENSIONS = ["pdf", "docx", "pptx", "txt"] as const;
export type AllowedExt = (typeof ALLOWED_EXTENSIONS)[number];

export const MIME_BY_EXT: Record<AllowedExt, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
};

/** MIME types browsers may legitimately report for each extension. */
const ACCEPTED_DECLARED: Record<AllowedExt, string[]> = {
  pdf: ["application/pdf", "application/x-pdf"],
  docx: [MIME_BY_EXT.docx, "application/zip"],
  pptx: [MIME_BY_EXT.pptx, "application/zip"],
  txt: ["text/plain"],
};
const GENERIC_DECLARED = ["", "application/octet-stream"];

const MAX_UNCOMPRESSED_BYTES = 200 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 5000;

export type UploadCheck =
  | { ok: true; ext: AllowedExt; mime: string; safeName: string }
  | { ok: false; error: string };

/** Strips any path, control and reserved characters; keeps a readable display name. */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 180);
  return cleaned || "file";
}

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

function err(key: string, name: string): UploadCheck {
  return { ok: false, error: `${key}|${JSON.stringify({ name })}` };
}

/** Sum of uncompressed sizes, used to reject zip bombs before any parsing. */
export function zipUncompressedSize(zip: JSZip): number {
  let total = 0;
  zip.forEach((_p, file) => {
    const data = (file as unknown as { _data?: { uncompressedSize?: number } })._data;
    total += data?.uncompressedSize ?? 0;
  });
  return total;
}

/**
 * Server-side upload validation. Never trusts the client: checks extension,
 * declared MIME, size, and the actual file signature / container structure.
 */
export async function validateUpload(
  originalName: string,
  declaredMime: string,
  bytes: Uint8Array,
  maxBytes: number,
): Promise<UploadCheck> {
  const safeName = sanitizeFilename(originalName);
  const ext = extOf(safeName);
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) return err("validation.fileType", safeName);
  const e = ext as AllowedExt;
  const declared = (declaredMime || "").toLowerCase().split(";")[0].trim();
  if (!GENERIC_DECLARED.includes(declared) && !ACCEPTED_DECLARED[e].includes(declared)) {
    return err("validation.fileType", safeName);
  }
  if (bytes.byteLength === 0) return err("validation.emptyFile", safeName);
  if (bytes.byteLength > maxBytes) return err("validation.fileSize", safeName);

  const contentOk = await checkSignature(e, bytes);
  if (!contentOk) return err("validation.fileContent", safeName);
  return { ok: true, ext: e, mime: MIME_BY_EXT[e], safeName };
}

async function checkSignature(ext: AllowedExt, bytes: Uint8Array): Promise<boolean> {
  switch (ext) {
    case "pdf":
      return bytes.length > 5 && new TextDecoder().decode(bytes.subarray(0, 5)) === "%PDF-";
    case "txt": {
      if (bytes.includes(0)) return false;
      try {
        new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        return true;
      } catch {
        return false;
      }
    }
    case "docx":
    case "pptx": {
      if (!(bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04)) return false;
      try {
        const zip = await JSZip.loadAsync(bytes);
        if (Object.keys(zip.files).length > MAX_ZIP_ENTRIES) return false;
        if (zipUncompressedSize(zip) > MAX_UNCOMPRESSED_BYTES) return false;
        if (!zip.file("[Content_Types].xml")) return false;
        // Reject macro-enabled content disguised as .docx/.pptx
        if (Object.keys(zip.files).some((p) => /vbaProject\.bin$/i.test(p))) return false;
        return ext === "docx" ? Boolean(zip.file("word/document.xml")) : Boolean(zip.file("ppt/presentation.xml"));
      } catch {
        return false;
      }
    }
  }
}
