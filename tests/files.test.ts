import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { makeDocx, makePdf, makePptx, txt } from "@/lib/demo/sample-files";
import { AppError } from "@/lib/errors";
import { extractText } from "@/lib/files/extract";
import { sanitizeFilename, validateUpload } from "@/lib/files/validate";
import { readAuthorizedMaterial } from "@/lib/services/materials";
import { getSubmissionDetail, listSubmissions, previewFileText, readAuthorizedFile, uploadSubmission } from "@/lib/services/submissions";
import { assertSafeKey, LocalFileStorage } from "@/lib/storage/storage";
import { LIMITS, txtFile, world } from "./helpers";

const MB = 1024 * 1024;

describe("upload validation (server-side)", () => {
  it("accepts genuine PDF, DOCX, PPTX and TXT", async () => {
    expect(await validateUpload("a.pdf", "application/pdf", makePdf(["x"]), MB)).toMatchObject({ ok: true, ext: "pdf" });
    expect(await validateUpload("a.docx", "", await makeDocx(["x"]), MB)).toMatchObject({ ok: true, ext: "docx" });
    expect(await validateUpload("a.pptx", "application/octet-stream", await makePptx([["x"]]), MB)).toMatchObject({ ok: true, ext: "pptx" });
    expect(await validateUpload("a.txt", "text/plain", txt("hello oʻzbek"), MB)).toMatchObject({ ok: true, ext: "txt" });
  });

  it("rejects disallowed extensions, spoofed content, wrong MIME, empty and oversized files", async () => {
    const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 1, 2, 3]);
    expect((await validateUpload("virus.exe", "application/x-msdownload", exe, MB)).ok).toBe(false);
    expect(await validateUpload("essay.pdf", "application/pdf", exe, MB)).toMatchObject({ ok: false, error: expect.stringContaining("validation.fileContent") });
    expect((await validateUpload("essay.docx", "", makePdf(["x"]), MB)).ok).toBe(false); // PDF renamed to .docx
    expect((await validateUpload("page.html.txt", "text/html", txt("<script>"), MB)).ok).toBe(false); // MIME mismatch
    expect((await validateUpload("bin.txt", "text/plain", new Uint8Array([104, 0, 105]), MB)).ok).toBe(false); // NUL byte
    expect(await validateUpload("e.txt", "text/plain", new Uint8Array(), MB)).toMatchObject({ ok: false, error: expect.stringContaining("validation.emptyFile") });
    expect(await validateUpload("big.txt", "text/plain", new Uint8Array(MB + 1).fill(65), MB)).toMatchObject({ ok: false, error: expect.stringContaining("validation.fileSize") });
  });

  it("rejects macro-enabled documents disguised as .docx", async () => {
    const zip = await JSZip.loadAsync(await makeDocx(["x"]));
    zip.file("word/vbaProject.bin", "macro");
    const bytes = await zip.generateAsync({ type: "uint8array" });
    expect((await validateUpload("macro.docx", "", bytes, MB)).ok).toBe(false);
  });

  it("sanitizes path traversal and control characters from display names", () => {
    expect(sanitizeFilename("../../etc/passwd.txt")).toBe("passwd.txt");
    expect(sanitizeFilename("..\\..\\win.ini.txt")).toBe("win.ini.txt");
    expect(sanitizeFilename("a\u0000b<>:\"|?*.pdf")).toBe("ab.pdf");
    expect(sanitizeFilename("....hidden.txt")).toBe("hidden.txt");
  });

  it("extracts text for safe previews", async () => {
    expect(await extractText("docx", await makeDocx(["Hello DOCX"]))).toContain("Hello DOCX");
    expect(await extractText("pptx", await makePptx([["Slide text"]]))).toContain("Slide text");
    expect(await extractText("pdf", makePdf(["Hello PDF"]))).toContain("Hello PDF");
  });
});

describe("storage keys", () => {
  it("only server-generated keys are accepted (path traversal impossible)", async () => {
    expect(() => assertSafeKey("submissions/00000000-0000-4000-8000-000000000000/00000000-0000-4000-8000-000000000001.pdf")).not.toThrow();
    for (const bad of ["../secret", "submissions/../../etc/passwd", "/etc/passwd", "submissions/x/y.pdf", "submissions/00000000-0000-4000-8000-000000000000/00000000-0000-4000-8000-000000000001.exe"]) {
      expect(() => assertSafeKey(bad)).toThrow();
    }
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "le-store-"));
    const s = new LocalFileStorage(root);
    await expect(s.get("../../etc/passwd")).rejects.toThrow(/Invalid storage key/);
    fs.rmSync(root, { recursive: true, force: true });
  });
});

describe("submissions", () => {
  it("student uploads to an assignment for their group; resubmission preserves earlier versions", async () => {
    const w = await world();
    const a2 = (await w.repo.list("assignments")).find((a) => a.title.startsWith("Legal terminology"))!;
    const s = await uploadSubmission(w.student1, { assignment_id: a2.id, files: [txtFile("v1.txt", "first")] }, LIMITS);
    expect(s.status).toBe("submitted");
    expect(s.student_id).toBe(w.student1.user.student_id);
    const s2 = await uploadSubmission(w.student1, { assignment_id: a2.id, files: [txtFile("v2.txt", "second"), txtFile("annex.txt")] }, LIMITS);
    expect(s2.id).toBe(s.id);
    expect(s2.current_version).toBe(2);
    const d = await getSubmissionDetail(w.student1, s.id);
    expect(d.filesByVersion.map((v) => [v.version, v.files.length])).toEqual([[2, 2], [1, 1]]);
    for (const f of await w.repo.list("submission_files", { eq: { submission_id: s.id } })) {
      expect(f.storage_key.startsWith(`submissions/${s.id}/`)).toBe(true);
      expect(f.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("revision request → resubmission flips status to resubmitted", async () => {
    const w = await world();
    const revision = (await w.repo.list("submissions")).find((s) => s.status === "revision_required")!;
    const student = await w.repo.get("students", revision.student_id);
    const ctx = w.ctx({ id: w.student2.user.id, role: "student", full_name: "s", email: null, student_id: student!.id });
    const s = await uploadSubmission(ctx, { assignment_id: revision.assignment_id, files: [txtFile("revised.txt")] }, LIMITS);
    expect(s.status).toBe("resubmitted");
    expect(s.current_version).toBe(2);
  });

  it("students cannot upload for others, to other groups' assignments, or after grading", async () => {
    const w = await world();
    const a2 = (await w.repo.list("assignments")).find((a) => a.title.startsWith("Legal terminology"))!;
    const crim = (await w.repo.list("assignments")).find((a) => a.title.startsWith("Ehtiyotsizlik"))!;
    const other = w.byCode("DEMO-24-0002");
    await expect(uploadSubmission(w.student1, { assignment_id: a2.id, student_id: other.id, files: [txtFile("x.txt")] }, LIMITS)).rejects.toBeInstanceOf(AppError);
    await expect(uploadSubmission(w.student1, { assignment_id: crim.id, files: [txtFile("x.txt")] }, LIMITS)).rejects.toSatisfy((e: unknown) => (e as AppError).code === "not_found");
    const graded = (await w.repo.list("submissions")).find((s) => s.student_id === w.student1.user.student_id && s.status === "graded")!;
    await expect(uploadSubmission(w.student1, { assignment_id: graded.assignment_id, files: [txtFile("x.txt")] }, LIMITS)).rejects.toSatisfy(
      (e: unknown) => (e as AppError).messageKey === "submissions.notAccepting",
    );
  });

  it("rejects too many files and invalid files without storing anything", async () => {
    const w = await world();
    const a2 = (await w.repo.list("assignments")).find((a) => a.title.startsWith("Legal terminology"))!;
    const before = w.storage.files.size;
    await expect(uploadSubmission(w.student1, { assignment_id: a2.id, files: [1, 2, 3, 4].map((i) => txtFile(`${i}.txt`)) }, LIMITS)).rejects.toBeInstanceOf(AppError);
    await expect(uploadSubmission(w.student1, { assignment_id: a2.id, files: [{ name: "x.pdf", type: "application/pdf", bytes: txt("not pdf") }] }, LIMITS)).rejects.toBeInstanceOf(AppError);
    await expect(uploadSubmission(w.student1, { assignment_id: a2.id, files: [] }, LIMITS)).rejects.toBeInstanceOf(AppError);
    expect(w.storage.files.size).toBe(before);
  });

  it("staff can upload on behalf of a student; late uploads are flagged", async () => {
    const w = await world();
    const a1 = (await w.repo.list("assignments")).find((a) => a.title.startsWith("Shaxsga"))!; // deadline in the past
    const s = await uploadSubmission(w.lecturer, { assignment_id: a1.id, student_id: w.byCode("DEMO-24-0005").id, files: [txtFile("late.txt")] }, LIMITS);
    expect(s.is_late).toBe(true);
  });
});

describe("file access control", () => {
  it("owner and staff can read; other students get not-found; access is audited", async () => {
    const w = await world();
    const own = (await w.repo.list("submissions")).find((s) => s.student_id === w.student1.user.student_id)!;
    const file = (await w.repo.list("submission_files", { eq: { submission_id: own.id } }))[0];
    expect((await readAuthorizedFile(w.student1, file.id)).bytes.byteLength).toBe(file.size_bytes);
    expect((await readAuthorizedFile(w.lecturer, file.id)).file.id).toBe(file.id);
    await expect(readAuthorizedFile(w.student2, file.id)).rejects.toSatisfy((e: unknown) => (e as AppError).code === "not_found");
    await expect(previewFileText(w.student2, file.id)).rejects.toSatisfy((e: unknown) => (e as AppError).code === "not_found");
    await expect(getSubmissionDetail(w.student2, own.id)).rejects.toSatisfy((e: unknown) => (e as AppError).code === "not_found");
    const audits = await w.repo.list("audit_logs", { eq: { action: "file.access", entity_id: file.id } });
    expect(audits.length).toBe(2);
  });

  it("students see only their own submissions in lists", async () => {
    const w = await world();
    const rows = await listSubmissions(w.student1);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.submission.student_id === w.student1.user.student_id)).toBe(true);
  });

  it("students cannot download staff-only teaching materials", async () => {
    const w = await world();
    const hidden = (await w.repo.list("teaching_materials")).find((m) => !m.visible_to_students && m.storage_key)!;
    const visible = (await w.repo.list("teaching_materials")).find((m) => m.visible_to_students && m.storage_key && m.assignment_id)!;
    await expect(readAuthorizedMaterial(w.student1, hidden.id)).rejects.toSatisfy((e: unknown) => (e as AppError).code === "not_found");
    expect((await readAuthorizedMaterial(w.student1, visible.id)).bytes.byteLength).toBeGreaterThan(0);
    expect((await readAuthorizedMaterial(w.lecturer, hidden.id)).bytes.byteLength).toBeGreaterThan(0);
  });
});
