import { NextResponse } from "next/server";
import { getCtx } from "@/lib/auth/server";
import { AppError } from "@/lib/errors";
import { RepoError } from "@/lib/db/repo";
import { readAuthorizedMaterial } from "@/lib/services/materials";

export const dynamic = "force-dynamic";

/** Access-controlled teaching-material download (staff: all; students: visible materials of their subjects/assignments). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getCtx();
  if (!ctx) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  try {
    const { material, bytes } = await readAuthorizedMaterial(ctx, id);
    const signed = await ctx.storage.signedUrl(material.storage_key!, 60, material.original_name ?? "material");
    if (signed) return NextResponse.redirect(signed, { status: 302, headers: { "Cache-Control": "no-store" } });
    const name = material.original_name ?? "material";
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": material.mime_type ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename="${name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (e) {
    if ((e instanceof AppError && (e.code === "not_found" || e.code === "forbidden")) || (e instanceof RepoError && e.code === "not_found")) {
      return new NextResponse("Not found", { status: 404 });
    }
    console.error("[materials] download failed", e instanceof Error ? e.message : e);
    return new NextResponse("Error", { status: 500 });
  }
}
