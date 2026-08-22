/**
 * Specialization-to-Symptoms Mapping
 * Maps doctor specializations to relevant symptoms
 */

export const SPECIALIZATION_SYMPTOMS = {
    'General Physician': [
        'Fever',
        'Cough',
        'Cold',
        'Headache',
        'Body Pain',
        'Fatigue',
        'Weakness',
        'Nausea',
        'Vomiting',
        'Diarrhea',
        'Loss of Appetite',
        'Sore Throat',
        'Runny Nose',
        'Dizziness'
    ],
    
    'Gynecologist': [
        'Irregular Periods',
        'PCOS',
        'Period Pain',
        'Heavy Bleeding',
        'Pregnancy Issues',
        'Menopause Symptoms',
        'Vaginal Infection',
        'Pelvic Pain',
        'Infertility',
        'Hormonal Imbalance',
        'White Discharge',
        'Breast Pain'
    ],
    
    'Dermatologist': [
        'Acne',
        'Skin Rash',
        'Itching',
        'Hair Fall',
        'Dandruff',
        'Dark Spots',
        'Pigmentation',
        'Eczema',
        'Psoriasis',
        'Skin Allergy',
        'Fungal Infection',
        'Mole/Wart',
        'Dry Skin'
    ],
    
    'Pediatricians': [
        'Fever',
        'Cough',
        'Cold',
        'Diarrhea',
        'Vomiting',
        'Skin Rash',
        'Loss of Appetite',
        'Ear Pain',
        'Stomach Pain',
        'Growth Issues',
        'Vaccination',
        'Behavioral Issues',
        'Sleep Problems'
    ],
    
    'Neurologist': [
        'Headache',
        'Migraine',
        'Dizziness',
        'Seizures',
        'Tremors',
        'Memory Loss',
        'Numbness',
        'Nerve Pain',
        'Paralysis',
        'Sleep Disorders',
        'Back Pain',
        'Neck Pain',
        'Tingling Sensation'
    ],
    
    'Gastroenterologist': [
        'Stomach Pain',
        'Acidity',
        'Gas/Bloating',
        'Constipation',
        'Diarrhea',
        'Nausea',
        'Vomiting',
        'Loss of Appetite',
        'Blood in Stool',
        'Jaundice',
        'Liver Problems',
        'Indigestion',
        'Abdominal Cramps'
    ],
    
    'Cardiologist': [
        'Chest Pain',
        'High BP',
        'Low BP',
        'Heart Palpitations',
        'Irregular Heartbeat',
        'Breathing Difficulty',
        'Fatigue',
        'Swelling in Legs',
        'Dizziness',
        'Fainting',
        'Chest Discomfort',
        'Shortness of Breath'
    ],
    
    'Orthopedic': [
        'Back Pain',
        'Neck Pain',
        'Joint Pain',
        'Knee Pain',
        'Shoulder Pain',
        'Fracture',
        'Sprain',
        'Arthritis',
        'Muscle Pain',
        'Bone Pain',
        'Stiffness',
        'Sports Injury',
        'Hip Pain'
    ],
    
    'Psychiatrist': [
        'Depression',
        'Anxiety',
        'Stress',
        'Sleep Issues',
        'Panic Attacks',
        'Mood Swings',
        'OCD',
        'Addiction',
        'Behavioral Issues',
        'Memory Problems',
        'Concentration Issues',
        'Eating Disorders'
    ],
    
    'Ophthalmologist': [
        'Eye Pain',
        'Blurred Vision',
        'Redness',
        'Watery Eyes',
        'Itching',
        'Dry Eyes',
        'Eye Strain',
        'Vision Loss',
        'Double Vision',
        'Eye Infection',
        'Cataract',
        'Glaucoma'
    ],
    
    'ENT Specialist': [
        'Ear Pain',
        'Hearing Loss',
        'Tinnitus',
        'Sore Throat',
        'Nasal Congestion',
        'Sinusitis',
        'Tonsillitis',
        'Voice Changes',
        'Snoring',
        'Nosebleed',
        'Dizziness',
        'Ear Discharge'
    ],
    
    'Dentist': [
        'Tooth Pain',
        'Cavity',
        'Gum Bleeding',
        'Bad Breath',
        'Tooth Sensitivity',
        'Wisdom Tooth Pain',
        'Jaw Pain',
        'Mouth Ulcers',
        'Swollen Gums',
        'Loose Tooth',
        'Tooth Decay'
    ],
    
    'Urologist': [
        'Urinary Infection',
        'Painful Urination',
        'Frequent Urination',
        'Blood in Urine',
        'Kidney Stone',
        'Prostate Issues',
        'Erectile Dysfunction',
        'Incontinence',
        'Lower Back Pain',
        'Pelvic Pain'
    ],
    
    'Pulmonologist': [
        'Cough',
        'Breathing Difficulty',
        'Asthma',
        'Chest Pain',
        'Wheezing',
        'Shortness of Breath',
        'Chronic Cough',
        'Chest Congestion',
        'TB Symptoms',
        'Sleep Apnea',
        'Pneumonia'
    ],
    
    'Endocrinologist': [
        'Diabetes',
        'Thyroid Issues',
        'Weight Gain',
        'Weight Loss',
        'Fatigue',
        'Hormonal Imbalance',
        'Growth Issues',
        'Excessive Thirst',
        'Frequent Urination',
        'PCOS',
        'Osteoporosis'
    ],
    
    'Rheumatologist': [
        'Joint Pain',
        'Arthritis',
        'Muscle Pain',
        'Stiffness',
        'Swelling',
        'Back Pain',
        'Fatigue',
        'Autoimmune Symptoms',
        'Gout',
        'Lupus Symptoms'
    ]
};

/**
 * Get symptoms for a given specialization
 * @param {string} specialization - Doctor's specialization
 * @returns {Array<string>} - Array of relevant symptoms
 */
export const getSymptomsForSpecialization = (specialization) => {
    if (!specialization) return [];
    
    // Exact match
    if (SPECIALIZATION_SYMPTOMS[specialization]) {
        return SPECIALIZATION_SYMPTOMS[specialization];
    }
    
    // Fuzzy match (case insensitive, partial match)
    const normSpecialization = specialization.toLowerCase().trim();
    for (const [key, symptoms] of Object.entries(SPECIALIZATION_SYMPTOMS)) {
        if (key.toLowerCase().includes(normSpecialization) || 
            normSpecialization.includes(key.toLowerCase())) {
            return symptoms;
        }
    }
    
    // Default: return general physician symptoms
    return SPECIALIZATION_SYMPTOMS['General Physician'];
};

