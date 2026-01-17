#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script pour compléter le fichier CSV des analyses médicales
Ajoute les analyses manquantes avec enrichissement bilingue FR/AR
"""

import csv
import os

# Fichiers
SOURCE_FILE = r"BBD Analyses\Liste Statistique d'Exécution sur Analysess.xlsx - A.csv"
EXISTING_FILE = r"BBD Analyses\analyses_labo_2025_complet.csv"
OUTPUT_FILE = r"BBD Analyses\analyses_labo_2025_complet_final.csv"

# Dictionnaires de traduction
CATEGORIES_AR = {
    "Diabète": "السكري",
    "Hématologie": "أمراض الدم",
    "Hormonologie": "الهرمونات",
    "Bilan Rénal (Reins)": "فحص الكلى",
    "Bilan Hépatique (Foie)": "فحص الكبد",
    "Cardiologie": "القلب والشرايين",
    "Inflammation": "الالتهاب",
    "Anémie/Fer": "فقر الدم والحديد",
    "Coagulation": "التخثر",
    "Vitamines": "الفيتامينات",
    "Immuno-Hémato": "المناعة والدم",
    "Cancer": "السرطان",
    "Bactériologie": "البكتيريا",
    "Sérologie": "الفيروسات",
    "MST": "الأمراض المنقولة جنسيا",
    "Grossesse": "الحمل",
    "Fertilité": "الخصوبة",
    "Rhumatologie": "الروماتيزم",
    "Allergie": "الحساسية",
    "Parasitologie": "الطفيليات",
    "Immunologie": "المناعة",
    "Génétique": "الجينات",
    "Toxicologie": "السموم والمخدرات",
    "Neurologie": "الأعصاب",
    "Endocrinologie": "الغدد الصماء",
    "Bilan Général": "فحص عام",
    "Autre": "آخر"
}

PRE_ANALYTIQUE_AR = {
    "Non à jeun.": "بدون صيام.",
    "À jeun.": "صائم.",
    "Jeûne préférable.": "يفضل الصيام.",
    "Strictement à jeun": "صيام إلزامي",
    "Le matin": "صباحا",
    "Urines": "بول",
    "Selles": "براز",
    "Selon": "حسب"
}

def determine_category(code, nom_technique):
    """Déterminer la catégorie basée sur le code et le nom"""
    code_prefix = code.strip()[:2]
    nom_upper = nom_technique.upper()

    # Mapping par code
    if code_prefix == "C ":
        if any(x in nom_upper for x in ["GLYC", "HBA1", "FRUC", "INSUL"]):
            return "Diabète"
        elif any(x in nom_upper for x in ["CHOL", "TRIG", "HDL", "LDL", "APOL"]):
            return "Cardiologie"
        elif any(x in nom_upper for x in ["CREAT", "UREE", "CALI"]):
            return "Bilan Rénal (Reins)"
        elif any(x in nom_upper for x in ["BILI", "ALBU"]):
            return "Bilan Hépatique (Foie)"
        elif any(x in nom_upper for x in ["CRP"]):
            return "Inflammation"
        else:
            return "Bilan Général"

    elif code_prefix == "H ":
        return "Hématologie"

    elif code_prefix == "N ":
        if any(x in nom_upper for x in ["TSH", "T3", "T4", "THYRO"]):
            return "Hormonologie"
        elif any(x in nom_upper for x in ["FSH", "LH", "OESTRADIOL", "PROGESTERONE"]):
            return "Hormonologie"
        elif any(x in nom_upper for x in ["HCG", "BETA"]):
            return "Grossesse"
        else:
            return "Hormonologie"

    elif code_prefix == "EZ":
        if any(x in nom_upper for x in ["ALAT", "ASAT", "GGT", "PAL", "BILI"]):
            return "Bilan Hépatique (Foie)"
        else:
            return "Bilan Général"

    elif code_prefix == "B ":
        return "Bactériologie"

    elif code_prefix in ["S ", "SE"]:
        if any(x in nom_upper for x in ["HIV", "SIDA"]):
            return "Sérologie"
        elif any(x in nom_upper for x in ["SYPHILIS", "VDRL", "TPHA"]):
            return "MST"
        elif any(x in nom_upper for x in ["HEPATITE", "HBV", "HVC", "HVA"]):
            return "Sérologie"
        else:
            return "Sérologie"

    elif code_prefix == "MT":
        return "Cancer"

    elif code_prefix == "I ":
        if any(x in nom_upper for x in ["FERR"]):
            return "Anémie/Fer"
        else:
            return "Immunologie"

    elif code_prefix == "HS":
        return "Coagulation"

    elif code_prefix == "V ":
        return "Vitamines"

    elif code_prefix == "T ":
        return "Immuno-Hémato"

    elif code_prefix == "A ":
        return "Allergie"

    elif code_prefix == "SP":
        return "Fertilité"

    elif code_prefix == "BM":
        return "Génétique"

    elif code_prefix == "M ":
        return "Toxicologie"

    elif code_prefix == "EU":
        return "Bilan Rénal (Reins)"

    elif code_prefix == "O ":
        return "Coagulation"

    elif code_prefix == "TO":
        return "Toxicologie"

    elif code_prefix == "X ":
        return "Génétique"

    else:
        return "Autre"

def simplify_name(nom_technique):
    """Simplifier le nom technique pour le patient"""
    # Cas spéciaux
    if "ANTICORPS" in nom_technique.upper():
        return nom_technique.replace("ANTICORPS", "Ac")

    # Retourner tel quel si déjà simplifié
    return nom_technique.title()

def generate_pre_analytique(category):
    """Générer les conditions pré-analytiques basées sur la catégorie"""
    pre_fr = "Non à jeun."
    pre_ar = "بدون صيام."

    if category in ["Diabète", "Cardiologie", "Bilan Rénal (Reins)", "Bilan Hépatique (Foie)"]:
        pre_fr = "Jeûne préférable."
        pre_ar = "يفضل الصيام."
    elif "Bactériologie" in category:
        pre_fr = "Selon prélèvement."
        pre_ar = "حسب العينة."
    elif "Urine" in category or category == "Bilan Rénal (Reins)":
        pre_fr = "Urines fraîches."
        pre_ar = "بول طازج."

    return pre_fr, pre_ar

def generate_description(category, nom_technique):
    """Générer une description basée sur la catégorie"""
    desc_fr = f"Analyse de {nom_technique.lower()}."
    desc_ar = f"تحليل {nom_technique}."

    if category == "Diabète":
        desc_fr = "Bilan du diabète."
        desc_ar = "فحص السكري."
    elif category == "Cardiologie":
        desc_fr = "Bilan cardiovasculaire."
        desc_ar = "فحص القلب والشرايين."
    elif "Bilan Rénal" in category:
        desc_fr = "Bilan de la fonction rénale."
        desc_ar = "فحص وظائف الكلى."
    elif "Bilan Hépatique" in category:
        desc_fr = "Bilan de la fonction hépatique."
        desc_ar = "فحص وظائف الكبد."
    elif category == "Hématologie":
        desc_fr = "Analyse sanguine."
        desc_ar = "تحليل الدم."
    elif category == "Hormonologie":
        desc_fr = "Dosage hormonal."
        desc_ar = "فحص الهرمونات."
    elif category == "Bactériologie":
        desc_fr = "Recherche bactérienne."
        desc_ar = "فحص البكتيريا."
    elif category == "Sérologie":
        desc_fr = "Dépistage sérologique."
        desc_ar = "فحص فيروسي."
    elif category == "Cancer":
        desc_fr = "Marqueur tumoral."
        desc_ar = "مؤشر ورم."
    elif category == "Immunologie":
        desc_fr = "Analyse immunologique."
        desc_ar = "فحص مناعي."

    return desc_fr, desc_ar

def generate_tags(category, nom_technique):
    """Générer des tags basés sur la catégorie et le nom"""
    tags_fr = []
    tags_ar = []

    # Tags génériques par catégorie
    if category == "Diabète":
        tags_fr = ["diabète", "sucre", "glycémie"]
        tags_ar = ["السكري", "سكر", "غلوكوز"]
    elif category == "Cardiologie":
        tags_fr = ["cœur", "cholestérol", "artères"]
        tags_ar = ["قلب", "كوليسترول", "شرايين"]
    elif "Bilan Rénal" in category:
        tags_fr = ["reins", "rénale", "urines"]
        tags_ar = ["كلى", "كلوي", "بول"]
    elif "Bilan Hépatique" in category:
        tags_fr = ["foie", "hépatique", "enzymes"]
        tags_ar = ["كبد", "كبدي", "إنزيمات"]
    elif category == "Hématologie":
        tags_fr = ["sang", "anémie", "globules"]
        tags_ar = ["دم", "فقر دم", "كريات"]
    elif category == "Hormonologie":
        tags_fr = ["hormones", "endocrinologie"]
        tags_ar = ["هرمونات", "غدد"]
    elif category == "Bactériologie":
        tags_fr = ["infection", "bactérie", "culture"]
        tags_ar = ["عدوى", "بكتيريا", "زرع"]
    elif category == "Sérologie":
        tags_fr = ["virus", "sérologie", "anticorps"]
        tags_ar = ["فيروس", "أجسام مضادة"]
    elif category == "Cancer":
        tags_fr = ["cancer", "tumeur", "marqueur"]
        tags_ar = ["سرطان", "ورم", "مؤشر"]
    elif category == "Immunologie":
        tags_fr = ["immunité", "auto-immun", "anticorps"]
        tags_ar = ["مناعة", "أجسام مضادة"]
    elif category == "Coagulation":
        tags_fr = ["coagulation", "sang", "thrombose"]
        tags_ar = ["تخثر", "دم", "جلطة"]
    elif category == "Vitamines":
        tags_fr = ["vitamine", "carence"]
        tags_ar = ["فيتامين", "نقص"]
    elif category == "Allergie":
        tags_fr = ["allergie", "ige"]
        tags_ar = ["حساسية", "أيجي"]
    else:
        tags_fr = ["analyse", "test"]
        tags_ar = ["تحليل", "فحص"]

    return "; ".join(tags_fr), "; ".join(tags_ar)

def main():
    # Lire le fichier source
    source_analyses = {}
    try:
        with open(SOURCE_FILE, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                code = row.get('$ANACODE (CH ANAL)', '').strip()
                if code:
                    source_analyses[code] = {
                        'nom_technique': row.get('Nom de l analyse', ''),
                        'nombre': row.get('Nombre', '0'),
                        'prix': row.get('Dhs', '0')
                    }
    except Exception as e:
        print(f"Erreur lecture fichier source: {e}")
        return

    print(f"✓ Fichier source lu: {len(source_analyses)} analyses")

    # Lire le fichier existant
    existing_codes = set()
    existing_rows = []
    try:
        with open(EXISTING_FILE, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                code = row.get('Code_Interne', '').strip()
                if code:
                    existing_codes.add(code)
                    existing_rows.append(row)
    except Exception as e:
        print(f"Erreur lecture fichier existant: {e}")
        return

    print(f"✓ Fichier existant lu: {len(existing_codes)} analyses")

    # Identifier les analyses manquantes
    missing_codes = set(source_analyses.keys()) - existing_codes
    print(f"✓ Analyses manquantes: {len(missing_codes)}")

    # Générer les nouvelles lignes
    new_rows = []
    for code in sorted(missing_codes, key=lambda x: int(source_analyses[x]['nombre']), reverse=True):
        data = source_analyses[code]
        nom_technique = data['nom_technique']

        # Déterminer la catégorie
        category_fr = determine_category(code, nom_technique)
        category_ar = CATEGORIES_AR.get(category_fr, "آخر")

        # Simplifier le nom
        nom_patient_fr = simplify_name(nom_technique)
        nom_patient_ar = f"تحليل {nom_technique}"  # Traduction générique

        # Pré-analytique
        pre_fr, pre_ar = generate_pre_analytique(category_fr)

        # Description
        desc_fr, desc_ar = generate_description(category_fr, nom_technique)

        # Tags
        tags_fr, tags_ar = generate_tags(category_fr, nom_technique)

        new_row = {
            'Code_Interne': code,
            'Nom_Patient_FR': nom_patient_fr,
            'Nom_Patient_AR': nom_patient_ar,
            'Nom_Technique': nom_technique,
            'Categorie_FR': category_fr,
            'Categorie_AR': category_ar,
            'Prix_Dhs': data['prix'],
            'Pre_Analytique_FR': pre_fr,
            'Pre_Analytique_AR': pre_ar,
            'Description_Patient_FR': desc_fr,
            'Description_Patient_AR': desc_ar,
            'Tags_FR': tags_fr,
            'Tags_AR': tags_ar,
            'Nombre_Demandes': data['nombre']
        }
        new_rows.append(new_row)

    # Combiner toutes les lignes
    all_rows = existing_rows + new_rows

    # Trier par nombre de demandes (décroissant)
    all_rows.sort(key=lambda x: int(x.get('Nombre_Demandes', 0)), reverse=True)

    # Écrire le fichier final
    fieldnames = [
        'Code_Interne', 'Nom_Patient_FR', 'Nom_Patient_AR', 'Nom_Technique',
        'Categorie_FR', 'Categorie_AR', 'Prix_Dhs',
        'Pre_Analytique_FR', 'Pre_Analytique_AR',
        'Description_Patient_FR', 'Description_Patient_AR',
        'Tags_FR', 'Tags_AR', 'Nombre_Demandes'
    ]

    try:
        with open(OUTPUT_FILE, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(all_rows)

        print(f"\n✓ Fichier final créé: {OUTPUT_FILE}")
        print(f"✓ Total d'analyses: {len(all_rows)}")
        print(f"✓ Nouvelles analyses ajoutées: {len(new_rows)}")
    except Exception as e:
        print(f"Erreur écriture fichier final: {e}")
        return

if __name__ == "__main__":
    main()
