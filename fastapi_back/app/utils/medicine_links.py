import urllib.parse

# Medicine purchase links mapping
MEDICINE_LINKS = {
    # Pain & Fever Relief
    'Paracetamol 500mg': {
        'amazon': 'https://www.amazon.in/s?k=paracetamol+500mg',
        '1mg': 'https://www.1mg.com/search/all?name=paracetamol%20500mg',
        'netmeds': 'https://www.netmeds.com/catalogsearch/result?q=paracetamol+500mg',
        'pharmeasy': 'https://pharmeasy.in/search/all?name=paracetamol%20500mg'
    },
    'Ibuprofen 400mg': {
        'amazon': 'https://www.amazon.in/s?k=ibuprofen+400mg',
        '1mg': 'https://www.1mg.com/search/all?name=ibuprofen%20400mg',
        'netmeds': 'https://www.netmeds.com/catalogsearch/result?q=ibuprofen+400mg',
        'pharmeasy': 'https://pharmeasy.in/search/all?name=ibuprofen%20400mg'
    },
    'Crocin': {
        'amazon': 'https://www.amazon.in/s?k=crocin',
        '1mg': 'https://www.1mg.com/search/all?name=crocin',
        'netmeds': 'https://www.netmeds.com/catalogsearch/result?q=crocin',
        'pharmeasy': 'https://pharmeasy.in/search/all?name=crocin'
    },
    
    # Cough & Cold
    'Cough Syrup': {
        'amazon': 'https://www.amazon.in/s?k=cough+syrup',
        '1mg': 'https://www.1mg.com/search/all?name=cough%20syrup',
        'netmeds': 'https://www.netmeds.com/catalogsearch/result?q=cough+syrup',
        'pharmeasy': 'https://pharmeasy.in/search/all?name=cough%20syrup'
    },
    'Cough Syrup (Dextromethorphan)': {
        'amazon': 'https://www.amazon.in/s?k=dextromethorphan+cough+syrup',
        '1mg': 'https://www.1mg.com/search/all?name=dextromethorphan',
        'netmeds': 'https://www.netmeds.com/catalogsearch/result?q=dextromethorphan',
        'pharmeasy': 'https://pharmeasy.in/search/all?name=dextromethorphan'
    },
    'Nasal Saline Drops': {
        'amazon': 'https://www.amazon.in/s?k=nasal+saline+drops',
        '1mg': 'https://www.1mg.com/search/all?name=nasal%20saline',
        'netmeds': 'https://www.netmeds.com/catalogsearch/result?q=nasal+saline',
        'pharmeasy': 'https://pharmeasy.in/search/all?name=nasal%20saline'
    },
    'Antihistamines': {
        'amazon': 'https://www.amazon.in/s?k=antihistamine',
        '1mg': 'https://www.1mg.com/search/all?name=antihistamine',
        'netmeds': 'https://www.netmeds.com/catalogsearch/result?q=antihistamine',
        'pharmeasy': 'https://pharmeasy.in/search/all?name=antihistamine'
    },
    'Vicks Vaporub': {
        'amazon': 'https://www.amazon.in/s?k=vicks+vaporub',
        '1mg': 'https://www.1mg.com/search/all?name=vicks%20vaporub',
        'netmeds': 'https://www.netmeds.com/catalogsearch/result?q=vicks+vaporub',
        'pharmeasy': 'https://pharmeasy.in/search/all?name=vicks%20vaporub'
    },
    
    # Stomach & Digestive
    'Antacid (Calcium Carbonate)': {
        'amazon': 'https://www.amazon.in/s?k=antacid+calcium+carbonate',
        '1mg': 'https://www.1mg.com/search/all?name=antacid',
        'netmeds': 'https://www.netmeds.com/catalogsearch/result?q=antacid',
        'pharmeasy': 'https://pharmeasy.in/search/all?name=antacid'
    },
    'Simethicone': {
        'amazon': 'https://www.amazon.in/s?k=simethicone',
        '1mg': 'https://www.1mg.com/search/all?name=simethicone',
        'netmeds': 'https://www.netmeds.com/catalogsearch/result?q=simethicone',
        'pharmeasy': 'https://pharmeasy.in/search/all?name=simethicone'
    },
    'Digestive Enzymes': {
        'amazon': 'https://www.amazon.in/s?k=digestive+enzymes',
        '1mg': 'https://www.1mg.com/search/all?name=digestive%20enzymes',
        'netmeds': 'https://www.netmeds.com/catalogsearch/result?q=digestive+enzymes',
        'pharmeasy': 'https://pharmeasy.in/search/all?name=digestive%20enzymes'
    },
    
    # Throat & Respiratory
    'Throat Lozenges': {
        'amazon': 'https://www.amazon.in/s?k=throat+lozenges',
        '1mg': 'https://www.1mg.com/search/all?name=throat%20lozenges',
        'netmeds': 'https://www.netmeds.com/catalogsearch/result?q=throat+lozenges',
        'pharmeasy': 'https://pharmeasy.in/search/all?name=throat%20lozenges'
    },
    
    # Skin Care
    'Calamine Lotion': {
        'amazon': 'https://www.amazon.in/s?k=calamine+lotion',
        '1mg': 'https://www.1mg.com/search/all?name=calamine',
        'netmeds': 'https://www.netmeds.com/catalogsearch/result?q=calamine',
        'pharmeasy': 'https://pharmeasy.in/search/all?name=calamine'
    },
    'Antihistamine Cream': {
        'amazon': 'https://www.amazon.in/s?k=antihistamine+cream',
        '1mg': 'https://www.1mg.com/search/all?name=antihistamine%20cream',
        'netmeds': 'https://www.netmeds.com/catalogsearch/result?q=antihistamine+cream',
        'pharmeasy': 'https://pharmeasy.in/search/all?name=antihistamine%20cream'
    },
    'Aloe Vera Gel': {
        'amazon': 'https://www.amazon.in/s?k=aloe+vera+gel',
        '1mg': 'https://www.1mg.com/search/all?name=aloe%20vera',
        'netmeds': 'https://www.netmeds.com/catalogsearch/result?q=aloe+vera',
        'pharmeasy': 'https://pharmeasy.in/search/all?name=aloe%20vera'
    },
    
    # Pain Relief Balms
    'Pain Relief Balm': {
        'amazon': 'https://www.amazon.in/s?k=pain+relief+balm',
        '1mg': 'https://www.1mg.com/search/all?name=pain%20relief%20balm',
        'netmeds': 'https://www.netmeds.com/catalogsearch/result?q=pain+relief+balm',
        'pharmeasy': 'https://pharmeasy.in/search/all?name=pain%20relief%20balm'
    },
    
    # Vitamins & Supplements
    'Multivitamin': {
        'amazon': 'https://www.amazon.in/s?k=multivitamin',
        '1mg': 'https://www.1mg.com/search/all?name=multivitamin',
        'netmeds': 'https://www.netmeds.com/catalogsearch/result?q=multivitamin',
        'pharmeasy': 'https://pharmeasy.in/search/all?name=multivitamin'
    },
    'ORS': {
        'amazon': 'https://www.amazon.in/s?k=ors+oral+rehydration',
        '1mg': 'https://www.1mg.com/search/all?name=ors',
        'netmeds': 'https://www.netmeds.com/catalogsearch/result?q=ors',
        'pharmeasy': 'https://pharmeasy.in/search/all?name=ors'
    },
    'Hydration (ORS)': {
        'amazon': 'https://www.amazon.in/s?k=ors+oral+rehydration',
        '1mg': 'https://www.1mg.com/search/all?name=ors',
        'netmeds': 'https://www.netmeds.com/catalogsearch/result?q=ors',
        'pharmeasy': 'https://pharmeasy.in/search/all?name=ors'
    }
}

def get_medicine_links(medicine_name: str):
    if not medicine_name:
        return None
    
    # Try exact match first
    if medicine_name in MEDICINE_LINKS:
        return MEDICINE_LINKS[medicine_name]
    
    # Try partial match (e.g., "Paracetamol 500mg" matches "Paracetamol")
    medicine_lower = medicine_name.lower()
    for key, links in MEDICINE_LINKS.items():
        if medicine_lower in key.lower() or key.lower() in medicine_lower:
            return links
    
    # Generate generic search links if no match found
    encoded_name = urllib.parse.quote_plus(medicine_name)
    return {
        'amazon': f"https://www.amazon.in/s?k={encoded_name}",
        '1mg': f"https://www.1mg.com/search/all?name={encoded_name}",
        'netmeds': f"https://www.netmeds.com/catalogsearch/result?q={encoded_name}",
        'pharmeasy': f"https://pharmeasy.in/search/all?name={encoded_name}"
    }

def format_medicine_with_links(medicine_name: str):
    links = get_medicine_links(medicine_name)
    return {
        'name': medicine_name,
        'links': links or {}
    }
