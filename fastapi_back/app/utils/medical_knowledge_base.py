from app.models import medical_model

async def get_comprehensive_medical_info(symptoms=None, query=None):
    if symptoms is None:
        symptoms = []
        
    try:
        all_results = []
        symptoms_list = symptoms if isinstance(symptoms, list) else [symptoms]
        
        # Search for each symptom
        for symptom in symptoms_list:
            if not symptom:
                continue
            results = await medical_model.search_medical_knowledge_db(symptom)
            all_results.extend(results)
            
        # Also search for query keywords if few results or no symptoms detected
        if (len(all_results) == 0 or len(symptoms_list) == 0) and query:
            results = await medical_model.search_medical_knowledge_db(query)
            all_results.extend(results)
            
        # Deduplicate results by ID
        unique_ids = set()
        unique_results = []
        for item in all_results:
            if item['id'] not in unique_ids:
                unique_ids.add(item['id'])
                unique_results.append(item)
                
        # Map to expected structure for Handlers
        high_severity = any(
            r.get('severity') and r['severity'].lower() == 'high' 
            for r in unique_results
        )
        
        return {
            'conditions': [
                r.get('keyword') or r.get('symptom')
                for r in unique_results
                if r.get('keyword') or r.get('symptom')
            ],
            'precautions': [], # Structure parity with Node.js
            'otc_medicines': [], # Structure parity with Node.js
            'when_to_see_doctor': 'Seek medical attention immediately' if high_severity else 'If symptoms persist or worsen',
            'summaries': [r.get('summary') for r in unique_results if r.get('summary')]
        }
    except Exception as e:
        print(f"Error fetching medical info from DB: {e}")
        return {
            'conditions': [],
            'precautions': [],
            'otc_medicines': [],
            'when_to_see_doctor': ''
        }

async def search_medical_knowledge(term):
    return await medical_model.search_medical_knowledge_db(term)
