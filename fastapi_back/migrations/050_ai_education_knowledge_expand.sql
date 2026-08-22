-- 050: Expand educational knowledge (India-facing topics). Additive seed only; never diagnosis.

INSERT INTO ai_knowledge_chunks (title, body, category, tags, source)
SELECT v.title, v.body, v.category, v.tags, 'seed_education_050'
FROM (VALUES
    (
        'Fever overview',
        'Fever is a raised body temperature, often from infection. Rest, fluids, and monitoring help for mild cases. Seek urgent care for very high fever, stiff neck, confusion, chest pain, or breathing trouble. A General Physician visit is reasonable if fever lasts more than a few days. This is general information, not a diagnosis. बुखार / జ్వరం.',
        'disease_faq',
        'fever,bukhar,jwaram,temperature,what is'
    ),
    (
        'What is anemia',
        'Anemia means the blood has fewer healthy red blood cells or less hemoglobin than expected, which can cause tiredness or weakness. Causes include iron deficiency and other conditions. Only lab tests and a clinician can confirm anemia. Book a General Physician on MedClues. खून की कमी / రక్తహీనత.',
        'disease_faq',
        'anemia,anaemia,hemoglobin,haemoglobin,tired,weakness'
    ),
    (
        'High blood pressure overview',
        'High blood pressure (hypertension) means the force of blood against artery walls is consistently high. It often has no early symptoms. Diagnosis needs repeated measurements by a clinician. Lifestyle and medicines, when prescribed, help manage it. Ask a General Physician for evaluation. बीपी / బిపి.',
        'disease_faq',
        'blood pressure,hypertension,bp,high bp'
    ),
    (
        'UTI overview',
        'A urinary tract infection (UTI) can cause burning while urinating, frequent urge to pass urine, or lower abdominal discomfort. Not every urinary symptom is a UTI. Persistent or severe symptoms, fever, or back pain need medical care. Book a General Physician. यह सामान्य जानकारी है।',
        'disease_faq',
        'uti,urine,burning,urinary,infection'
    ),
    (
        'Dengue overview',
        'Dengue is a mosquito-borne viral illness. Common features can include high fever, body pain, headache, and sometimes rash. Warning signs (severe abdominal pain, bleeding, extreme tiredness) need urgent care. Only lab tests and a clinician confirm dengue. Prevention includes avoiding mosquito bites. डेंगू / డెంగీ.',
        'disease_faq',
        'dengue,mosquito,viral fever,dengu'
    ),
    (
        'Common cold overview',
        'A common cold is usually a mild viral illness with runny nose, sneezing, or mild cough. Most people improve with rest and fluids. See a doctor if breathing is hard, fever is high, or symptoms last a long time. Not a personal diagnosis.',
        'disease_faq',
        'cold,sardi,cough,runny nose'
    ),
    (
        'Ibuprofen general information',
        'Ibuprofen is an anti-inflammatory pain reliever used for pain and fever in many over-the-counter products. Follow the label. People with stomach ulcers, kidney disease, or certain heart conditions should ask a clinician before use. This is not a personal prescription.',
        'medicine_info',
        'ibuprofen,pain,fever,nsaid,tablet'
    ),
    (
        'ORS and dehydration basics',
        'Oral rehydration salts (ORS) are used for fluid loss from diarrhea or vomiting when a clinician or label recommends them. Severe dehydration (very dry mouth, no urine, confusion) needs urgent care. Ask a pharmacist or doctor which product suits you.',
        'medicine_info',
        'ors,dehydration,diarrhea,diarrhoea,vomit'
    ),
    (
        'Antacids general information',
        'Antacids may ease occasional acidity or heartburn for some people. Persistent stomach pain, vomiting blood, or black stools need medical care. Do not replace prescribed ulcer therapy with chat advice.',
        'medicine_info',
        'antacid,acidity,heartburn,gastric'
    ),
    (
        'Antihistamines general information',
        'Antihistamines are used for some allergies and cold symptoms. They can cause drowsiness. Check the label and ask a pharmacist if you take other medicines. Not a personal prescription.',
        'medicine_info',
        'antihistamine,allergy,cetirizine,cold'
    ),
    (
        'CBC report basics',
        'A complete blood count (CBC) looks at red cells, white cells, and platelets. Individual values need lab reference ranges and clinical context. Bring your report to a doctor rather than relying on chat alone.',
        'lab_literacy',
        'cbc,blood count,wbc,rbc,platelets,report'
    ),
    (
        'Thyroid TSH meaning',
        'TSH is a blood test used when checking thyroid function. High or low values can relate to underactive or overactive thyroid, but only a clinician should interpret your result with full history and other tests.',
        'lab_literacy',
        'tsh,thyroid,lab,report'
    ),
    (
        'Vitamin D result basics',
        'Vitamin D blood tests measure levels that may be low, sufficient, or high depending on the lab range. Supplements should follow clinician advice. This is education, not a dosing plan.',
        'lab_literacy',
        'vitamin d,vit d,deficiency,lab'
    ),
    (
        'Persistent cough guidance',
        'A cough lasting more than two to three weeks, coughing blood, or cough with breathlessness deserves a clinician review. Short viral coughs often settle with time. This is not a diagnosis.',
        'symptom_literacy',
        'cough,khansi,daggu,persistent'
    ),
    (
        'Joint pain guidance',
        'Joint pain can come from strain, inflammation, or other conditions. Sudden severe swelling, fever with joint pain, or inability to walk needs prompt care. Otherwise a General Physician or Orthopedics visit may help.',
        'symptom_literacy',
        'joint,knee,arthritis,pain'
    ),
    (
        'Hydration and rest wellness',
        'Adequate water intake and rest support recovery from many mild illnesses, but they do not replace medical care when symptoms are severe or prolonged. Adjust fluids if you have heart or kidney disease — ask your doctor.',
        'wellness',
        'hydration,water,rest,recovery'
    )
) AS v(title, body, category, tags)
WHERE NOT EXISTS (
    SELECT 1 FROM ai_knowledge_chunks k WHERE k.title = v.title
);
