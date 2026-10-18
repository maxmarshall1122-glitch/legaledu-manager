/** The six predefined subject areas. Also inserted by supabase/migrations/0002_reference_data.sql. */
export const DEFAULT_SUBJECTS = [
  {
    code: "CYBER",
    name_en: "Cyber Law",
    name_uz: "Kiberhuquq",
    description_en: "Legal regulation of information technologies, cybercrime, data protection and electronic commerce.",
    description_uz: "Axborot texnologiyalari, kiberjinoyatchilik, shaxsga doir maʼlumotlarni himoya qilish va elektron tijoratni huquqiy tartibga solish.",
  },
  {
    code: "LEGAL-ENG",
    name_en: "English Language and Legal English",
    name_uz: "Ingliz tili va yuridik ingliz tili",
    description_en: "General English and the terminology, reading and writing skills of legal English.",
    description_uz: "Umumiy ingliz tili hamda yuridik ingliz tili terminologiyasi, oʻqish va yozish koʻnikmalari.",
  },
  {
    code: "JUDICIAL",
    name_en: "Judicial Power",
    name_uz: "Sud hokimiyati",
    description_en: "Organisation of the judiciary, judicial independence and principles of court proceedings.",
    description_uz: "Sud tizimini tashkil etish, sudyalar mustaqilligi va sud ishlarini yuritish tamoyillari.",
  },
  {
    code: "ADMIN",
    name_en: "Administrative Law",
    name_uz: "Maʼmuriy huquq",
    description_en: "Public administration, administrative procedure and administrative liability.",
    description_uz: "Davlat boshqaruvi, maʼmuriy tartib-taomillar va maʼmuriy javobgarlik.",
  },
  {
    code: "FIN",
    name_en: "Financial Law",
    name_uz: "Moliya huquqi",
    description_en: "Budget, tax, banking and currency regulation.",
    description_uz: "Byudjet, soliq, bank va valyuta munosabatlarini tartibga solish.",
  },
  {
    code: "CRIM",
    name_en: "Criminal Law",
    name_uz: "Jinoyat huquqi",
    description_en: "General and special parts of criminal law: crime, guilt, liability and punishment.",
    description_uz: "Jinoyat huquqining umumiy va maxsus qismlari: jinoyat, aybdorlik, javobgarlik va jazo.",
  },
] as const;
