-- LegalEdu Manager — predefined subject areas (reference data, not personal data).
-- Keep in sync with src/lib/demo/subjects.ts.
insert into public.subjects (code, name_en, name_uz, description_en, description_uz, is_default) values
  ('CYBER', 'Cyber Law', 'Kiberhuquq',
   'Legal regulation of information technologies, cybercrime, data protection and electronic commerce.',
   'Axborot texnologiyalari, kiberjinoyatchilik, shaxsga doir maʼlumotlarni himoya qilish va elektron tijoratni huquqiy tartibga solish.', true),
  ('LEGAL-ENG', 'English Language and Legal English', 'Ingliz tili va yuridik ingliz tili',
   'General English and the terminology, reading and writing skills of legal English.',
   'Umumiy ingliz tili hamda yuridik ingliz tili terminologiyasi, oʻqish va yozish koʻnikmalari.', true),
  ('JUDICIAL', 'Judicial Power', 'Sud hokimiyati',
   'Organisation of the judiciary, judicial independence and principles of court proceedings.',
   'Sud tizimini tashkil etish, sudyalar mustaqilligi va sud ishlarini yuritish tamoyillari.', true),
  ('ADMIN', 'Administrative Law', 'Maʼmuriy huquq',
   'Public administration, administrative procedure and administrative liability.',
   'Davlat boshqaruvi, maʼmuriy tartib-taomillar va maʼmuriy javobgarlik.', true),
  ('FIN', 'Financial Law', 'Moliya huquqi',
   'Budget, tax, banking and currency regulation.',
   'Byudjet, soliq, bank va valyuta munosabatlarini tartibga solish.', true),
  ('CRIM', 'Criminal Law', 'Jinoyat huquqi',
   'General and special parts of criminal law: crime, guilt, liability and punishment.',
   'Jinoyat huquqining umumiy va maxsus qismlari: jinoyat, aybdorlik, javobgarlik va jazo.', true)
on conflict (code) do nothing;
