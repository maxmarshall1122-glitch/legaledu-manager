import type { AssignmentType, Locale } from "@/lib/types";

/**
 * Content templates. These are inserted into assignment / feedback text, whose
 * language is chosen per assignment and is independent of the interface language.
 */
export interface AssignmentTemplate {
  id: string;
  type: AssignmentType;
  label: Record<Locale, string>;
  description: Record<Locale, string>;
  instructions: Record<Locale, string>;
}

export const ASSIGNMENT_TEMPLATES: AssignmentTemplate[] = [
  {
    id: "essay",
    type: "essay",
    label: { uz: "Akademik esse", en: "Academic essay" },
    description: {
      uz: "Berilgan huquqiy masala boʻyicha asoslangan akademik esse.",
      en: "A reasoned academic essay on the given legal question.",
    },
    instructions: {
      uz: "1. Hajmi: 2000–2500 soʻz.\n2. Kirish qismida tadqiqot savolini aniq bayon qiling.\n3. Asosiy qismda kamida uchta normativ-huquqiy hujjat va ikkita ilmiy manbaga tayaning.\n4. Xulosada asosiy dalillaringizni umumlashtiring.\n5. Iqtiboslarni yagona uslubda rasmiylashtiring.\n6. Faylni PDF yoki DOCX formatida yuklang.",
      en: "1. Length: 2,000–2,500 words.\n2. State your research question clearly in the introduction.\n3. Rely on at least three legislative sources and two scholarly sources in the main body.\n4. Summarise your key arguments in the conclusion.\n5. Use one consistent citation style.\n6. Upload your file as PDF or DOCX.",
    },
  },
  {
    id: "case_study",
    type: "case_study",
    label: { uz: "Keys tahlili (IRAC)", en: "Case study (IRAC)" },
    description: {
      uz: "Berilgan ish holatini IRAC usulida tahlil qiling.",
      en: "Analyse the given fact pattern using the IRAC method.",
    },
    instructions: {
      uz: "Ish holatini quyidagi tuzilmada tahlil qiling:\n• Masala (Issue): hal qilinishi kerak boʻlgan huquqiy savollar.\n• Qoida (Rule): qoʻllaniladigan normalar va sud amaliyoti.\n• Qoʻllash (Application): qoidalarni faktlarga qoʻllash, qarama-qarshi dalillarni ham koʻrib chiqing.\n• Xulosa (Conclusion): asoslangan javob.\nHajmi: 1500 soʻzgacha.",
      en: "Analyse the fact pattern using this structure:\n• Issue: the legal questions to be resolved.\n• Rule: the applicable provisions and case law.\n• Application: apply the rules to the facts, addressing counter-arguments.\n• Conclusion: a reasoned answer.\nLength: up to 1,500 words.",
    },
  },
  {
    id: "legal_analysis",
    type: "legal_analysis",
    label: { uz: "Normativ hujjat tahlili", en: "Legislative analysis" },
    description: {
      uz: "Belgilangan qonun yoki normaning tanqidiy tahlili.",
      en: "A critical analysis of a specified statute or provision.",
    },
    instructions: {
      uz: "1. Normaning maqsadi va qabul qilinish tarixini tavsiflang.\n2. Normani amaldagi qonunchilik tizimidagi oʻrnini koʻrsating.\n3. Kamida bitta xorijiy tajriba bilan qiyoslang.\n4. Amaliyotdagi muammolarni aniqlang va takliflar bering.",
      en: "1. Describe the purpose and legislative history of the provision.\n2. Explain its place in the current legal framework.\n3. Compare it with at least one foreign jurisdiction.\n4. Identify practical problems and propose improvements.",
    },
  },
  {
    id: "presentation",
    type: "presentation",
    label: { uz: "Taqdimot", en: "Presentation" },
    description: { uz: "Mavzu boʻyicha 10–12 slaydli taqdimot.", en: "A 10–12 slide presentation on the topic." },
    instructions: {
      uz: "PPTX formatida 10–12 slayd tayyorlang. Har bir slaydda asosiy fikr, oxirgi slaydda manbalar roʻyxati boʻlsin. Taqdimot 10 daqiqaga moʻljallangan.",
      en: "Prepare 10–12 slides in PPTX format. Each slide should carry one key point; list your sources on the final slide. The talk should last 10 minutes.",
    },
  },
  {
    id: "language_exercise",
    type: "language_exercise",
    label: { uz: "Yuridik ingliz tili mashqi", en: "Legal English exercise" },
    description: {
      uz: "Yuridik terminologiya va yozma nutq boʻyicha mashq.",
      en: "An exercise in legal terminology and legal writing.",
    },
    instructions: {
      uz: "1. Berilgan matndagi 20 ta yuridik atamani ingliz tiliga tarjima qiling va izohlang.\n2. Berilgan vaziyat boʻyicha mijozga 300 soʻzli maslahat xatini ingliz tilida yozing.\n3. Rasmiy uslubga rioya qiling.",
      en: "1. Translate and explain the 20 legal terms marked in the text.\n2. Write a 300-word advice letter to a client about the given situation.\n3. Use a formal register throughout.",
    },
  },
  {
    id: "research_paper",
    type: "research_paper",
    label: { uz: "Ilmiy maqola", en: "Research paper" },
    description: { uz: "Mustaqil tadqiqotga asoslangan ilmiy maqola.", en: "A research paper based on independent research." },
    instructions: {
      uz: "Tuzilma: annotatsiya, kirish, metodologiya, tahlil, xulosa, adabiyotlar roʻyxati. Hajmi: 4000–6000 soʻz. Kamida 15 ta manba.",
      en: "Structure: abstract, introduction, methodology, analysis, conclusion, bibliography. Length: 4,000–6,000 words. At least 15 sources.",
    },
  },
];

export interface FeedbackTemplate {
  id: string;
  field: "strengths" | "improvements" | "student_feedback";
  text: Record<Locale, string>;
}

export const FEEDBACK_TEMPLATES: FeedbackTemplate[] = [
  {
    id: "strong-structure",
    field: "strengths",
    text: { uz: "Ish mantiqiy tuzilgan va fikrlar izchil bayon qilingan.", en: "The work is logically structured and the argument is coherent." },
  },
  {
    id: "good-sources",
    field: "strengths",
    text: { uz: "Normativ-huquqiy manbalardan toʻgʻri va oʻrinli foydalanilgan.", en: "Legislative sources are used accurately and appropriately." },
  },
  {
    id: "need-citations",
    field: "improvements",
    text: {
      uz: "Daʼvolaringizni aniq iqtiboslar bilan asoslang va iqtibos uslubini bir xil qiling.",
      en: "Support your claims with precise citations and apply one citation style consistently.",
    },
  },
  {
    id: "deeper-analysis",
    field: "improvements",
    text: {
      uz: "Normalarni shunchaki bayon qilish oʻrniga ularni faktlarga chuqurroq qoʻllang va qarama-qarshi dalillarni koʻrib chiqing.",
      en: "Go beyond describing the rules: apply them to the facts in more depth and address counter-arguments.",
    },
  },
  {
    id: "overall-good",
    field: "student_feedback",
    text: {
      uz: "Yaxshi ish! Tahlilingiz puxta. Keyingi ishda manbalar bilan ishlashga koʻproq eʼtibor bering.",
      en: "Good work! Your analysis is thorough. In your next paper, pay closer attention to how you use sources.",
    },
  },
  {
    id: "revise",
    field: "student_feedback",
    text: {
      uz: "Ishingizni quyidagi izohlar asosida qayta koʻrib chiqing va belgilangan muddatgacha yangi versiyani yuklang.",
      en: "Please revise your work based on the comments below and upload a new version by the stated deadline.",
    },
  },
];
