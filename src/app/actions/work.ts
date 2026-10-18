"use server";

import { aiConfig, uploadLimits } from "@/lib/config";
import { getProvider } from "@/lib/ai/providers";
import { requestAiReview, rejectAiSuggestion } from "@/lib/services/ai-review";
import * as grading from "@/lib/services/grading";
import * as materials from "@/lib/services/materials";
import * as submissions from "@/lib/services/submissions";
import type { AiProviderId, SubmissionStatus } from "@/lib/types";
import type { ReviewInput } from "@/lib/validation";
import { act, filesFromFormData } from "./_act";

// Submissions (multipart FormData so files stream to the server; validated server-side)
export async function uploadSubmissionAction(form: FormData) {
  return act(
    async (ctx) => {
      const files = await filesFromFormData(form, "files");
      const s = await submissions.uploadSubmission(
        ctx,
        {
          assignment_id: String(form.get("assignment_id") ?? ""),
          student_id: (form.get("student_id") as string | null) || null,
          comment: (form.get("comment") as string | null) || null,
          files,
        },
        uploadLimits(),
      );
      return { id: s.id, version: s.current_version };
    },
    { message: "submissions.uploaded" },
  );
}
export async function setFollowUpAction(input: { submission_id: string; follow_up_note: string; follow_up_due: string }) {
  return act((ctx) => submissions.setFollowUp(ctx, input), { message: "submissions.followUpSaved" });
}
export async function setSubmissionStatusAction(id: string, status: SubmissionStatus) {
  return act((ctx) => submissions.setSubmissionStatus(ctx, id, status), { message: "common.saved" });
}
export async function deleteSubmissionAction(id: string) {
  return act((ctx) => submissions.deleteSubmission(ctx, id), { message: "common.deleted" });
}

// Grading
export async function saveReviewDraftAction(input: ReviewInput) {
  return act(async (ctx) => (await grading.saveReviewDraft(ctx, input)).id, { message: "grading.saved" });
}
export async function approveGradeAction(input: ReviewInput) {
  return act(async (ctx) => (await grading.approveGrade(ctx, input)).id, { message: "grading.approved" });
}
export async function requestRevisionAction(input: ReviewInput) {
  return act(async (ctx) => (await grading.requestRevision(ctx, input)).id, { message: "grading.revisionRequested" });
}
export async function changeFinalGradeAction(input: { submission_id: string; new_score: number | string; reason: string }) {
  return act(async (ctx) => (await grading.changeFinalGrade(ctx, input)).id, { message: "grading.finalChanged" });
}
export async function markCompletedAction(submissionId: string) {
  return act((ctx) => grading.markCompleted(ctx, submissionId), { message: "grading.completed" });
}

// AI review
export async function requestAiReviewAction(submissionId: string, provider: AiProviderId) {
  return act(async (ctx) => {
    const c = aiConfig();
    const s = await requestAiReview(ctx, submissionId, provider, { getProvider, dailyLimit: c.dailyLimitPerUser, maxDocumentChars: c.maxDocumentChars });
    return { id: s.id };
  });
}
export async function rejectAiSuggestionAction(id: string) {
  return act((ctx) => rejectAiSuggestion(ctx, id), { message: "ai.rejected" });
}

// Teaching materials
export async function createMaterialAction(form: FormData) {
  return act(
    async (ctx) => {
      const [file] = await filesFromFormData(form, "file");
      const m = await materials.createMaterial(
        ctx,
        {
          title: form.get("title") ?? "",
          subject_id: form.get("subject_id") ?? "",
          assignment_id: form.get("assignment_id") ?? "",
          description: form.get("description") ?? "",
          external_url: form.get("external_url") ?? "",
          visible_to_students: form.get("visible_to_students") === "on",
        },
        file ?? null,
        uploadLimits().maxFileBytes,
      );
      return m.id;
    },
    { message: "materials.created" },
  );
}
export async function setMaterialVisibilityAction(id: string, visible: boolean) {
  return act((ctx) => materials.setMaterialVisibility(ctx, id, visible), { message: "common.saved" });
}
export async function deleteMaterialAction(id: string) {
  return act((ctx) => materials.deleteMaterial(ctx, id), { message: "common.deleted" });
}
