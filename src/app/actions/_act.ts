import "server-only";
import { revalidatePath } from "next/cache";
import { requireActionCtx } from "@/lib/auth/server";
import { toActionError, type ActionResult } from "@/lib/errors";
import type { Ctx } from "@/lib/services/core";

/** Common wrapper: authenticate, run, revalidate, map errors to safe messages. */
export async function act<T>(fn: (ctx: Ctx) => Promise<T>, opts: { revalidate?: string[]; message?: string } = {}): Promise<ActionResult<T>> {
  try {
    const ctx = await requireActionCtx();
    const data = await fn(ctx);
    for (const p of opts.revalidate ?? ["/", "layout"]) {
      if (p === "layout") revalidatePath("/", "layout");
      else revalidatePath(p);
    }
    return { ok: true, data, message: opts.message };
  } catch (e) {
    return toActionError(e);
  }
}

export async function filesFromFormData(form: FormData, field: string) {
  const files: { name: string; type: string; bytes: Uint8Array }[] = [];
  for (const entry of form.getAll(field)) {
    if (entry instanceof File && entry.size > 0) files.push({ name: entry.name, type: entry.type, bytes: new Uint8Array(await entry.arrayBuffer()) });
  }
  return files;
}
