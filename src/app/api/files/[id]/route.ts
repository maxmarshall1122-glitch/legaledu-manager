import { NextResponse } from "next/server";
import { getCtx } from "@/lib/auth/server";
import { AppError } from "@/lib/errors";
import { RepoError } from "@/lib/db/repo";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/services/core";
import { getAuthorizedFile, readAuthorizedFile } from "@/lib/services/submissions";

export const dynamic = "force-dynamic";

function contentDisposition(kind: "inline" | "attachment", name: string) {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

/**
 * Access-controlled download. Authorization: staff → any submission file;
 * student → only files of their own submissions. Unauthorized and missing
 * files both return 404 so IDs cannot be probed. In production (Supabase) the
 * response is a redirect to a 60-second signed URL of the private bucket.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getCtx();
  if (!ctx) return new NextResponse("Unauthorized", { status: 401 });
  if (!rateLimit(`download:${ctx.user.id}`, 120, 60_000).ok) return new NextResponse("Too many requests", { status: 429 });
  const { id } = await params;
  const inline = new URL(req.url).searchParams.get("inline") === "1";
  try {
    const { file } = await getAuthorizedFile(ctx, id);
    // Only validated PDFs may render inline (browser PDF viewer); everything else is forced to download.
    const showInline = inline && file.mime_type === "application/pdf";
    const signed = await ctx.storage.signedUrl(file.storage_key, 60, showInline ? null : file.original_name);
    if (signed) {
      await audit(ctx, "file.access", "submission_files", file.id, { name: file.original_name, via: "signed_url" });
      return NextResponse.redirect(signed, { status: 302, headers: { "Cache-Control": "no-store" } });
    }
    const { bytes } = await readAuthorizedFile(ctx, id);
    const headers: Record<string, string> = {
      "Content-Type": file.mime_type,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": contentDisposition(showInline ? "inline" : "attachment", file.original_name),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    };
    // Browsers refuse to run their PDF viewer in a sandboxed document, so the sandbox CSP is for downloads only.
    if (!showInline) headers["Content-Security-Policy"] = "default-src 'none'; sandbox";
    return new NextResponse(Buffer.from(bytes), { headers });
  } catch (e) {
    if ((e instanceof AppError && (e.code === "not_found" || e.code === "forbidden")) || (e instanceof RepoError && e.code === "not_found")) {
      return new NextResponse("Not found", { status: 404 });
    }
    console.error("[files] download failed", e instanceof Error ? e.message : e);
    return new NextResponse("Error", { status: 500 });
  }
}
