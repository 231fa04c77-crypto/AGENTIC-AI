-- 049: Educational knowledge for AI Assistant (disease, medicine, wellness, lab literacy)
-- Additive seed only; never used as diagnosis.

INSERT INTO ai_knowledge_chunks (title, body, category, tags, source)
SELECT v.title, v.body, v.category, v.tags, 'seed_education'
FROM (VALUES
    (
        'What is diabetes',
        'Diabetes means blood sugar stays higher than normal because the body does not make enough insulin or cannot use insulin well. Common types are type 1 and type 2. Only a doctor can diagnose diabetes with tests. MedClues can help you book a General Physician.',
        'disease_faq',
        'diabetes,sugar,blood sugar,what is'
    ),
    (
        'Symptoms of diabetes',
        'People with diabetes may notice increased thirst, frequent urination, tiredness, blurred vision, or slow-healing wounds. These signs can have other causes too. This is general information, not a personal diagnosis. See a doctor for testing.',
        'disease_faq',
        'diabetes,symptoms'
    ),
    (
        'Can diabetes be cured',
        'There is no simple cure for diabetes in most cases. Type 2 can often be managed with lifestyle, medicines, and follow-up. Type 1 usually needs lifelong insulin. Ask your doctor about a plan for you.',
        'disease_faq',
        'diabetes,cure,treatment'
    ),
    (
        'Foods for people with diabetes',
        'General tips often include limiting sugary drinks and sweets, choosing high-fibre foods, and eating balanced meals. Exact diets should be planned with a clinician or dietitian for your health.',
        'disease_faq',
        'diabetes,food,diet,avoid'
    ),
    (
        'What is asthma',
        'Asthma is a long-term condition where the airways become inflamed and sensitive, which can cause wheezing, cough, and shortness of breath. Triggers vary. This is educational only — emergency breathing problems need urgent care.',
        'disease_faq',
        'asthma,breathing'
    ),
    (
        'Thyroid problems overview',
        'The thyroid gland helps control metabolism. Underactive or overactive thyroid can cause fatigue, weight changes, or heart-rate changes. Blood tests guide diagnosis. Book a General Physician for evaluation.',
        'disease_faq',
        'thyroid,hormone'
    ),
    (
        'Migraine overview',
        'Migraine is a type of headache that may include throbbing pain, nausea, or sensitivity to light. Triggers differ by person. Frequent migraines deserve a clinician review; Neurology may be suggested for specialist care.',
        'disease_faq',
        'migraine,headache'
    ),
    (
        'Fever body pain sore throat guidance',
        'Fever with body pain and sore throat is often linked to common viral illnesses, but other causes exist. Rest, fluids, and monitoring temperature help while you decide next steps. Seek urgent care for very high fever, stiff neck, chest pain, or breathing trouble. A General Physician visit is reasonable if symptoms persist.',
        'symptom_literacy',
        'fever,sore throat,body pain,cold,flu'
    ),
    (
        'Dizziness when standing',
        'Feeling dizzy when standing can relate to dehydration, low blood pressure, medicines, or other issues. Sit or lie down if dizzy, hydrate if appropriate, and avoid sudden standing. Persistent or severe dizziness with chest pain or fainting needs urgent care. Otherwise consider a General Physician visit.',
        'symptom_literacy',
        'dizzy,dizziness,standing'
    ),
    (
        'Stomach pain guidance',
        'Stomach pain has many possible causes, from indigestion to infection. Note duration, fever, vomiting, or severe pain. Severe sudden pain, blood in stool, or vomiting blood needs urgent care. For milder ongoing pain, a General Physician is a common first step.',
        'symptom_literacy',
        'stomach,abdomen,pain,gastric'
    ),
    (
        'Paracetamol uses',
        'Paracetamol (acetaminophen) is commonly used for fever and mild to moderate pain. Follow the dose on the label or your doctor''s advice. Do not combine multiple products that contain paracetamol. If you have liver disease, ask a clinician before use. This is general information, not a personal prescription.',
        'medicine_info',
        'paracetamol,acetaminophen,tablet,fever,pain'
    ),
    (
        'Taking medicines with food',
        'Some medicines work better with food; others need an empty stomach. Always check the label or pharmacist advice for your specific tablet. If unsure, ask your doctor or pharmacist rather than guessing.',
        'medicine_info',
        'food,after food,tablet,medicine'
    ),
    (
        'Missed morning tablet',
        'If you forget a dose, general advice is often to take it when you remember unless it is almost time for the next dose — then skip the missed one. Do not double dose unless a clinician told you to. Check your medicine leaflet or ask a pharmacist/doctor for your specific medicine.',
        'medicine_info',
        'forgot,missed,dose,tablet'
    ),
    (
        'Combining medicines caution',
        'Combining medicines can cause interactions. Do not start or stop tablets based on chat advice. Ask a pharmacist or doctor whether your medicines can be taken together.',
        'medicine_info',
        'together,interaction,paracetamol'
    ),
    (
        'Stress and sleep wellness',
        'Stress can affect sleep and mood. Helpful habits include a regular sleep schedule, reducing screens before bed, light daytime activity, and limiting caffeine late in the day. If stress or poor sleep continues or disrupts daily life, consider speaking with a qualified healthcare professional. For suicidal thoughts, seek emergency help immediately.',
        'wellness',
        'stress,sleep,mental,wellness'
    ),
    (
        'Daily healthy routine',
        'A healthy routine usually includes balanced meals, regular physical activity as suitable for you, adequate sleep, hydration, and routine medical checkups. Personal plans should fit your age and medical history — ask a clinician if you have chronic conditions.',
        'wellness',
        'lifestyle,health,daily,routine'
    ),
    (
        'Hemoglobin meaning',
        'Hemoglobin carries oxygen in red blood cells. A value around 10 g/dL is lower than typical adult ranges used in many labs and may relate to anemia, but lab ranges and causes vary. Only your clinician can interpret your full report. You can book a General Physician on MedClues.',
        'lab_literacy',
        'hemoglobin,haemoglobin,anemia,blood report'
    ),
    (
        'Blood sugar meaning',
        'Blood sugar (glucose) results depend on whether the test was fasting or after meals. “Normal” ranges differ by lab and test type. Bring your report to a doctor for interpretation rather than relying on chat alone.',
        'lab_literacy',
        'sugar,glucose,blood sugar,report'
    )
) AS v(title, body, category, tags)
WHERE NOT EXISTS (
    SELECT 1 FROM ai_knowledge_chunks k WHERE k.title = v.title
);
