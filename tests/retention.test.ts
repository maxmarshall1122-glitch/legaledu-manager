import { describe, expect, it } from "vitest";
import { purgeExpiredSubmissions } from "@/lib/services/retention";
import { AppError } from "@/lib/errors";
import { world } from "./helpers";

describe("data retention purge", () => {
  it("dry run reports, real run deletes archived-assignment submissions and their files, and is audited", async () => {
    const w = await world();
    const now = new Date("2026-10-18T12:00:00Z");
    const dry = await purgeExpiredSubmissions(w.lecturer, 30, { now });
    expect(dry.dryRun).toBe(true);
    expect(dry.submissions).toHaveLength(1); // the archived JUDICIAL presentation, submitted ~61 days earlier
    const before = w.storage.files.size;
    expect((await w.repo.list("submissions")).length).toBe(10);

    const real = await purgeExpiredSubmissions(w.lecturer, 30, { now, dryRun: false });
    expect(real.files).toBe(1);
    expect((await w.repo.list("submissions")).length).toBe(9);
    expect(w.storage.files.size).toBe(before - 1);
    expect((await w.repo.list("audit_logs", { eq: { action: "retention.purge" } })).length).toBe(1);
  });

  it("keeps recent data and is staff-only", async () => {
    const w = await world();
    expect((await purgeExpiredSubmissions(w.lecturer, 365, { now: new Date("2026-10-18T12:00:00Z") })).submissions).toHaveLength(0);
    await expect(purgeExpiredSubmissions(w.student1, 1)).rejects.toBeInstanceOf(AppError);
  });
});
