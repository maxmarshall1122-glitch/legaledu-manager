import { audit, requireStaff, type Ctx } from "./core";

/**
 * Data-retention purge. Removes submissions (with their files, reviews,
 * feedback and grade history) whose assignment is ARCHIVED and whose last
 * submission activity is older than `days`. Defaults to a dry run.
 * Student records themselves are kept; delete them individually when the
 * institution's policy requires it.
 */
export async function purgeExpiredSubmissions(ctx: Ctx, days: number, opts: { dryRun?: boolean; now?: Date } = {}) {
  requireStaff(ctx);
  if (!Number.isInteger(days) || days < 1) throw new Error("Retention period must be a positive number of days");
  const dryRun = opts.dryRun ?? true;
  const cutoff = new Date((opts.now ?? new Date()).getTime() - days * 86400_000).toISOString();
  const archived = new Set((await ctx.repo.list("assignments", { eq: { status: "archived" } })).map((a) => a.id));
  const expired = (await ctx.repo.list("submissions")).filter((s) => archived.has(s.assignment_id) && s.submitted_at < cutoff);
  const files = expired.length ? await ctx.repo.list("submission_files", { in: { column: "submission_id", values: expired.map((s) => s.id) } }) : [];
  if (!dryRun) {
    for (const s of expired) await ctx.repo.remove("submissions", s.id);
    await ctx.storage.remove(files.map((f) => f.storage_key));
    await audit(ctx, "retention.purge", "submissions", null, { days, submissions: expired.length, files: files.length });
  }
  return { dryRun, cutoff, submissions: expired.map((s) => s.code), files: files.length };
}
