"use client";

import { Archive, ArchiveRestore, Send, Trash2, Undo2 } from "lucide-react";
import { deleteAssignmentAction, setAssignmentStatusAction } from "@/app/actions/records";
import { ConfirmButton } from "@/components/client-ui";
import { useI18n } from "@/components/i18n-provider";
import type { Assignment } from "@/lib/types";

export function AssignmentStatusActions({ assignment }: { assignment: Pick<Assignment, "id" | "status" | "title"> }) {
  const { t } = useI18n();
  const set = (s: Assignment["status"]) => () => setAssignmentStatusAction(assignment.id, s);
  return (
    <>
      {assignment.status === "draft" && (
        <ConfirmButton
          variant="primary"
          label={t("assignments.publish")}
          icon={<Send className="h-4 w-4" aria-hidden="true" />}
          title={t("assignments.publish")}
          body={`${t("assignments.studentViewHint")} ${t("assignments.noExternalDistribution")}`}
          action={set("published")}
        />
      )}
      {assignment.status === "published" && (
        <>
          <ConfirmButton variant="outline" label={t("assignments.unpublish")} icon={<Undo2 className="h-4 w-4" aria-hidden="true" />} title={t("assignments.unpublish")} body={t("assignments.unpublish")} action={set("draft")} />
          <ConfirmButton variant="outline" label={t("assignments.archive")} icon={<Archive className="h-4 w-4" aria-hidden="true" />} title={t("assignments.archive")} body={t("submissions.notAccepting")} action={set("archived")} />
        </>
      )}
      {assignment.status === "archived" && (
        <ConfirmButton variant="outline" label={t("assignments.restore")} icon={<ArchiveRestore className="h-4 w-4" aria-hidden="true" />} title={t("assignments.restore")} body={t("assignments.restore")} action={set("published")} />
      )}
      <ConfirmButton
        label={t("common.delete")}
        icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
        title={t("assignments.deleteTitle")}
        body={t("assignments.deleteBody", { name: assignment.title })}
        confirmLabel={t("confirm.deleteConfirm")}
        action={() => deleteAssignmentAction(assignment.id)}
        redirectTo="/assignments"
      />
    </>
  );
}
