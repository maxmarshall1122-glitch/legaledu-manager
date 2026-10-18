"use client";

import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Modal } from "@/components/client-ui";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui";
import { UploadForm } from "@/components/upload-form";

export function UploadDialog(props: {
  assignments: { id: string; label: string }[];
  studentsByAssignment: Record<string, { id: string; label: string }[]>;
  defaultAssignmentId?: string;
  autoOpen: boolean;
  maxMb: number;
  maxFiles: number;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(props.autoOpen);
  const change = (v: boolean) => {
    setOpen(v);
    if (!v && props.autoOpen) router.replace("/submissions");
  };
  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={props.assignments.length === 0}>
        <Upload className="h-4 w-4" aria-hidden="true" />
        {t("submissions.upload")}
      </Button>
      <Modal open={open} onOpenChange={change} title={t("submissions.uploadTitle")}>
        <UploadForm {...props} onDone={() => change(false)} />
      </Modal>
    </>
  );
}
