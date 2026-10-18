import { MemoryRepo, type Snapshot } from "@/lib/db/memory-repo";
import { defaultRubric } from "@/lib/rubric";
import { resetRateLimits } from "@/lib/rate-limit";
import { createAssignment, setAssignmentStatus } from "@/lib/services/assignments";
import type { Ctx } from "@/lib/services/core";
import { approveGrade, markCompleted, requestRevision, saveReviewDraft } from "@/lib/services/grading";
import { createGroup } from "@/lib/services/groups";
import { createMaterial } from "@/lib/services/materials";
import { createStudent } from "@/lib/services/students";
import { uploadSubmission, type UploadFile } from "@/lib/services/submissions";
import { MemoryFileStorage } from "@/lib/storage/storage";
import type { AssignmentType, Locale, SessionUser } from "@/lib/types";
import { makeDocx, makePdf, makePptx, txt } from "./sample-files";
import { DEFAULT_SUBJECTS } from "./subjects";

/**
 * FICTIONAL demo data. Every person, record, text and grade below is invented
 * for demonstration. Do not load into a production database.
 */
export const DEMO_IDS = {
  admin: "00000000-0000-4000-8000-000000000001",
  lecturer: "00000000-0000-4000-8000-000000000002",
  student1: "00000000-0000-4000-8000-000000000101",
  student2: "00000000-0000-4000-8000-000000000102",
};

export const DEMO_ACCOUNTS = [
  { id: DEMO_IDS.lecturer, email: "lecturer@demo.legaledu.local", role: "lecturer" as const, full_name: "Demo Lecturer (fictional)" },
  { id: DEMO_IDS.admin, email: "admin@demo.legaledu.local", role: "admin" as const, full_name: "Demo Administrator (fictional)" },
  { id: DEMO_IDS.student1, email: "student1@demo.legaledu.local", role: "student" as const, full_name: "Aziza Tursunova (fictional)" },
  { id: DEMO_IDS.student2, email: "student2@demo.legaledu.local", role: "student" as const, full_name: "Kamola Ergasheva (fictional)" },
];

const STUDENTS: { code: string; name: string; group: string; profile?: string }[] = [
  { code: "DEMO-24-0001", name: "Aziza Tursunova", group: "LAW-101", profile: DEMO_IDS.student1 },
  { code: "DEMO-24-0002", name: "Bekzod Aliyev", group: "LAW-101" },
  { code: "DEMO-24-0003", name: "Dilshod Rahimov", group: "LAW-101" },
  { code: "DEMO-24-0004", name: "Gulnora Saidova", group: "LAW-101" },
  { code: "DEMO-24-0005", name: "Javohir Qodirov", group: "LAW-101" },
  { code: "DEMO-24-0006", name: "Kamola Ergasheva", group: "LAW-102", profile: DEMO_IDS.student2 },
  { code: "DEMO-24-0007", name: "Laziz Murodov", group: "LAW-102" },
  { code: "DEMO-24-0008", name: "Madina Yusupova", group: "LAW-102" },
  { code: "DEMO-24-0009", name: "Nodir Xolmatov", group: "LAW-102" },
  { code: "DEMO-23-0010", name: "Otabek Sobirov", group: "LAW-201" },
  { code: "DEMO-23-0011", name: "Sevara Nazarova", group: "LAW-201" },
  { code: "DEMO-23-0012", name: "Umid Karimov", group: "LAW-201" },
];

const day = 86400_000;

export async function buildDemoSeed(now = new Date()): Promise<{ snapshot: Snapshot; files: Map<string, Uint8Array> }> {
  resetRateLimits();
  const repo = new MemoryRepo();
  const storage = new MemoryFileStorage();
  // Times are UTC; 18:59 UTC = 23:59 in Tashkent (UTC+5), the app's default display time zone.
  const iso = (offsetDays: number, hour = 18, minute = 59) => {
    const d = new Date(now.getTime() + offsetDays * day);
    d.setUTCHours(hour, minute, 0, 0);
    return d.toISOString();
  };

  for (const a of DEMO_ACCOUNTS) {
    await repo.insert("profiles", { id: a.id, full_name: a.full_name, role: a.role, locale: "uz", email: a.email });
  }
  const lecturer: SessionUser = { id: DEMO_IDS.lecturer, role: "lecturer", full_name: "Demo Lecturer", email: null, student_id: null };
  const ctx: Ctx = { repo, storage, user: lecturer, locale: "uz" };

  const subjects: Record<string, string> = {};
  for (const s of DEFAULT_SUBJECTS) subjects[s.code] = (await repo.insert("subjects", { ...s, is_default: true })).id;

  const groups: Record<string, string> = {};
  for (const [name, year, desc] of [
    ["LAW-101", "2025-2026", "1-kurs, yurisprudensiya (fictional)"],
    ["LAW-102", "2025-2026", "1-kurs, xalqaro huquq (fictional)"],
    ["LAW-201", "2025-2026", "2-kurs, yurisprudensiya (fictional)"],
  ] as const) {
    groups[name] = (await createGroup(ctx, { name, academic_year: year, description: desc })).id;
  }
  const subjectGroups: [string, string[]][] = [
    ["CYBER", ["LAW-101", "LAW-201"]],
    ["LEGAL-ENG", ["LAW-101", "LAW-102"]],
    ["JUDICIAL", ["LAW-201"]],
    ["ADMIN", ["LAW-102"]],
    ["FIN", ["LAW-201"]],
    ["CRIM", ["LAW-201"]],
  ];
  for (const [code, gs] of subjectGroups) {
    for (const g of gs) await repo.insert("subject_groups", { subject_id: subjects[code], group_id: groups[g] });
  }

  const students: Record<string, string> = {};
  for (const s of STUDENTS) {
    const st = await createStudent(ctx, {
      student_code: s.code,
      full_name: s.name,
      email: `${s.code.toLowerCase()}@students.demo.legaledu.local`,
      academic_year: s.code.includes("-23-") ? "2024-2025" : "2025-2026",
      enrollment_status: "active",
      notes: "Fictional demo record.",
      group_ids: [groups[s.group]],
    });
    if (s.profile) await repo.update("students", st.id, { profile_id: s.profile });
    students[s.code] = st.id;
  }
  await repo.update("students", students["DEMO-24-0009"], { enrollment_status: "on_leave" });

  const mkAssignment = async (o: {
    title: string;
    subject: string;
    groups: string[];
    type: AssignmentType;
    language: Locale;
    deadline: number;
    issue: number;
    status: "draft" | "published";
    instructions: string;
    description: string;
  }) => {
    const a = await createAssignment(
      ctx,
      {
        title: o.title,
        subject_id: subjects[o.subject],
        group_ids: o.groups.map((g) => groups[g]),
        description: o.description,
        instructions: o.instructions,
        language: o.language,
        assignment_type: o.type,
        issue_date: iso(o.issue, 9, 0),
        deadline: iso(o.deadline),
        max_score: 100,
        criteria: defaultRubric(o.language),
        material_ids: [],
      },
      o.status,
    );
    const criteria = await repo.list("rubric_criteria", { eq: { assignment_id: a.id }, order: { column: "position" } });
    return { a, criteria };
  };

  const a1 = await mkAssignment({
    title: "Shaxsga doir maʼlumotlarni himoya qilish: qiyosiy tahlil",
    subject: "CYBER",
    groups: ["LAW-101"],
    type: "essay",
    language: "uz",
    issue: -25,
    deadline: -5,
    status: "published",
    description: "Oʻzbekiston va Yevropa Ittifoqi yondashuvlarini qiyoslang (toʻqima topshiriq).",
    instructions: "1. Hajmi: 2000–2500 soʻz.\n2. Kamida uchta normativ-huquqiy hujjatga tayaning.\n3. PDF yoki DOCX formatida yuklang.",
  });
  const a2 = await mkAssignment({
    title: "Legal terminology: contract formation",
    subject: "LEGAL-ENG",
    groups: ["LAW-101", "LAW-102"],
    type: "language_exercise",
    language: "en",
    issue: -8,
    deadline: 6,
    status: "published",
    description: "Terminology and drafting exercise (fictional assignment).",
    instructions: "1. Explain the 20 highlighted terms.\n2. Write a 300-word advice letter to a fictional client.\n3. Use a formal register.",
  });
  const a3 = await mkAssignment({
    title: "Ehtiyotsizlik orqasidan sodir etilgan jinoyat: keys tahlili",
    subject: "CRIM",
    groups: ["LAW-201"],
    type: "case_study",
    language: "uz",
    issue: -30,
    deadline: -10,
    status: "published",
    description: "Toʻqima ish holatini IRAC usulida tahlil qiling.",
    instructions: "Masala, qoida, qoʻllash va xulosa tuzilmasidan foydalaning. Hajmi: 1500 soʻzgacha.",
  });
  await mkAssignment({
    title: "Administrative procedure reform: a critical analysis",
    subject: "ADMIN",
    groups: ["LAW-102"],
    type: "legal_analysis",
    language: "en",
    issue: -2,
    deadline: 12,
    status: "published",
    description: "Analyse a recent (fictional) reform of administrative procedure.",
    instructions: "Describe the purpose of the reform, compare with one foreign jurisdiction and propose improvements.",
  });
  await mkAssignment({
    title: "Soliq maʼmuriyatchiligi: ilmiy maqola (qoralama)",
    subject: "FIN",
    groups: ["LAW-201"],
    type: "research_paper",
    language: "uz",
    issue: 3,
    deadline: 40,
    status: "draft",
    description: "Hali eʼlon qilinmagan toʻqima topshiriq.",
    instructions: "Tuzilma: annotatsiya, kirish, tahlil, xulosa.",
  });
  const a6 = await mkAssignment({
    title: "Sudyalar mustaqilligi kafolatlari: taqdimot",
    subject: "JUDICIAL",
    groups: ["LAW-201"],
    type: "presentation",
    language: "uz",
    issue: -80,
    deadline: -60,
    status: "published",
    description: "Oʻtgan semestr toʻqima topshirigʻi.",
    instructions: "10–12 slayd, PPTX formatida.",
  });

  const essay = (title: string, who: string) =>
    `${title}\n\nFICTIONAL DEMO SUBMISSION — ${who}\n\nKirish. Ushbu toʻqima esse shaxsga doir maʼlumotlarni himoya qilishning ikki yondashuvini qiyoslaydi.\n\nAsosiy qism. Birinchidan, rozilik tamoyili... Ikkinchidan, maʼlumotlarni transchegaraviy uzatish...\n\nXulosa. Har ikki tizim ham shaxs huquqlarini himoya qilishga qaratilgan, biroq ijro mexanizmlari farq qiladi.\n`;

  const up = async (assignmentId: string, code: string, files: UploadFile[], comment: string | null, submittedOffsetDays: number) => {
    const s = await uploadSubmission(ctx, { assignment_id: assignmentId, student_id: students[code], comment, files }, { maxFileBytes: 20 * 1024 * 1024, maxFilesPerSubmission: 5 });
    const assignment = await repo.get("assignments", assignmentId);
    const submittedAt = iso(submittedOffsetDays, 18, 30);
    await repo.update("submissions", s.id, { submitted_at: submittedAt, is_late: Boolean(assignment?.deadline && submittedAt > assignment.deadline) });
    return s;
  };
  const scores = (criteria: { id: string }[], values: number[], comments: string[] = []) =>
    criteria.map((c, i) => ({ criterion_id: c.id, score: values[i] ?? null, comment: comments[i] ?? null }));

  // A1 — CYBER essay
  const s1 = await up(a1.a.id, "DEMO-24-0001", [{ name: "esse_maʼlumotlar_himoyasi.txt", type: "text/plain", bytes: txt(essay("Shaxsga doir maʼlumotlar", "Aziza T.")) }], "Ilovada manbalar roʻyxati bor.", -6);
  await approveGrade(ctx, {
    submission_id: s1.id,
    scores: scores(a1.criteria, [22, 17, 16, 12, 9, 9], ["Normalar toʻgʻri talqin qilingan.", "Qiyosiy tahlil yaxshi."]),
    strengths: "Ish mantiqiy tuzilgan va fikrlar izchil bayon qilingan.",
    improvements: "Iqtiboslarni yagona uslubda rasmiylashtiring.",
    student_feedback: "Yaxshi ish! Keyingi ishda manbalar bilan ishlashga koʻproq eʼtibor bering.",
  });
  const s2 = await up(a1.a.id, "DEMO-24-0002", [{ name: "data_protection_essay.docx", type: "", bytes: await makeDocx(["Data protection: a comparative essay", "FICTIONAL DEMO SUBMISSION — Bekzod A.", "This fictional essay compares consent-based and interest-based models."]) }], null, -5);
  await saveReviewDraft(ctx, { submission_id: s2.id, scores: scores(a1.criteria, [18, 14]), strengths: "Mavzu yaxshi tanlangan." });
  const s3 = await up(a1.a.id, "DEMO-24-0003", [{ name: "esse.txt", type: "text/plain", bytes: txt(essay("Maʼlumotlar himoyasi", "Dilshod R.")) }], null, -7);
  await requestRevision(ctx, {
    submission_id: s3.id,
    scores: scores(a1.criteria, [12, 9, 8, 5, 6, 7]),
    improvements: "Normalarni faktlarga chuqurroq qoʻllang va qarama-qarshi dalillarni koʻrib chiqing.",
    student_feedback: "Ishingizni izohlar asosida qayta koʻrib chiqing va yangi versiyani yuklang.",
    revision_deadline: iso(4),
  });
  const s4 = await up(a1.a.id, "DEMO-24-0004", [{ name: "esse_saidova.pdf", type: "application/pdf", bytes: makePdf(["FICTIONAL DEMO SUBMISSION", "Data protection: comparative analysis", "Introduction ... Analysis ... Conclusion"]) }], "Kechikkanim uchun uzr.", -3);
  await repo.update("submissions", s4.id, { follow_up_note: "Kechikish sababini aniqlashtirish (toʻqima).", follow_up_due: iso(2, 12, 0) });

  // A2 — Legal English (upcoming)
  await up(a2.a.id, "DEMO-24-0006", [{ name: "terminology_exercise.docx", type: "", bytes: await makeDocx(["FICTIONAL DEMO SUBMISSION — Kamola E.", "1. Offer: a definite proposal...", "2. Acceptance: unqualified assent..."]) }], null, -1);
  await up(a2.a.id, "DEMO-24-0007", [{ name: "advice_letter.txt", type: "text/plain", bytes: txt("FICTIONAL DEMO SUBMISSION — Laziz M.\n\nDear Client,\nRegarding the formation of your contract...\n") }], null, -1);

  // A3 — Criminal law case study
  const s7 = await up(a3.a.id, "DEMO-23-0010", [{ name: "keys_tahlili.txt", type: "text/plain", bytes: txt("FICTIONAL DEMO SUBMISSION — Otabek S.\n\nMasala: ...\nQoida: ...\nQoʻllash: ...\nXulosa: ...\n") }], null, -11);
  await approveGrade(ctx, { submission_id: s7.id, scores: scores(a3.criteria, [24, 18, 18, 14, 9, 9]), student_feedback: "Ajoyib IRAC tahlili." });
  await markCompleted(ctx, s7.id);
  const s8 = await up(a3.a.id, "DEMO-23-0011", [{ name: "case_study.txt", type: "text/plain", bytes: txt("FICTIONAL DEMO SUBMISSION — Sevara N.\n\nIssue... Rule... Application... Conclusion...\n") }], null, -9);
  await approveGrade(ctx, { submission_id: s8.id, scores: scores(a3.criteria, [19, 15, 14, 10, 8, 8]), student_feedback: "Yaxshi, lekin dalillar yetarli emas." });
  await up(a3.a.id, "DEMO-23-0012", [{ name: "keys_taqdimot.pptx", type: "", bytes: await makePptx([["FICTIONAL DEMO SUBMISSION", "Umid K."], ["Masala", "Qoida"], ["Xulosa"]]) }], null, -10);

  // A6 — archived presentation
  const s10 = await up(a6.a.id, "DEMO-23-0010", [{ name: "mustaqillik.pptx", type: "", bytes: await makePptx([["FICTIONAL DEMO SUBMISSION"], ["Sudyalar mustaqilligi"]]) }], null, -61);
  await approveGrade(ctx, { submission_id: s10.id, scores: scores(a6.criteria, [20, 16, 15, 12, 8, 9]) });
  await markCompleted(ctx, s10.id);
  await setAssignmentStatus(ctx, a6.a.id, "archived");

  // Teaching materials
  await createMaterial(ctx, { title: "Kiberhuquq: 1-maʼruza matni (toʻqima)", subject_id: subjects.CYBER, description: "Kirish maʼruzasi.", visible_to_students: true }, { name: "maruza_1.txt", type: "text/plain", bytes: txt("FICTIONAL DEMO MATERIAL\n\n1-maʼruza: Kiberhuquq predmeti va tizimi.\n") }, 20 * 1024 * 1024);
  await createMaterial(ctx, { title: "Esse uchun adabiyotlar roʻyxati", subject_id: subjects.CYBER, assignment_id: a1.a.id, visible_to_students: true }, { name: "adabiyotlar.txt", type: "text/plain", bytes: txt("FICTIONAL DEMO MATERIAL\n\n1. Toʻqima darslik...\n2. Toʻqima maqola...\n") }, 20 * 1024 * 1024);
  await createMaterial(ctx, { title: "Case file (staff only)", subject_id: subjects.CRIM, assignment_id: a3.a.id, visible_to_students: false }, { name: "case_file.pdf", type: "application/pdf", bytes: makePdf(["FICTIONAL DEMO MATERIAL", "Case facts for instructors only."]) }, 20 * 1024 * 1024);
  await createMaterial(ctx, { title: "Legal English glossary (external)", subject_id: subjects["LEGAL-ENG"], external_url: "https://example.org/legal-english-glossary", visible_to_students: true }, null, 20 * 1024 * 1024);

  // Seeding is not user activity: start with an empty audit log.
  const snapshot = repo.snapshot();
  snapshot.audit_logs = [];
  resetRateLimits();
  return { snapshot, files: storage.files };
}
