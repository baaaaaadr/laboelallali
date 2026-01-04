/**
 * Script de nettoyage des fichiers CSV des médecins
 *
 * Ce script nettoie et fusionne les fichiers CSV des médecins (public et privé)
 * pour les préparer à l'import dans Google Sheets puis Firestore.
 *
 * Fonctionnalités :
 * - Correction de l'encodage UTF-8
 * - Uniformisation des numéros de téléphone
 * - Fusion des deux fichiers avec distinction secteur public/privé
 * - Validation et nettoyage des données
 * - Export en CSV propre pour Google Sheets
 */

const fs = require('fs');
const path = require('path');

// Configuration
const INPUT_DIR = path.join(__dirname, '..', 'BDDMedecins');
const OUTPUT_DIR = path.join(__dirname, '..', 'BDDMedecins', 'cleaned');
const PUBLIC_FILE = path.join(INPUT_DIR, 'BDD MEDECIN AGADIR public.csv');
const PRIVE_FILE = path.join(INPUT_DIR, 'BDD MEDECIN AGADIR privé.csv');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'medecins_agadir_cleaned.csv');
const ERRORS_LOG = path.join(OUTPUT_DIR, 'cleaning_errors.json');

// Statistiques de nettoyage
const stats = {
  totalRecords: 0,
  publicRecords: 0,
  priveRecords: 0,
  errors: [],
  warnings: [],
  phoneFormatted: 0,
  emailsFixed: 0,
  duplicates: 0
};

/**
 * Nettoie et formate un numéro de téléphone marocain
 * @param {string} phone - Numéro de téléphone brut
 * @returns {string} - Numéro formatté ou chaîne vide
 */
function cleanPhoneNumber(phone) {
  if (!phone || phone.trim() === '') return '';

  // Nettoyer les caractères spéciaux
  let cleaned = phone
    .replace(/[_\-\s\/]/g, '')
    .replace(/\D/g, ''); // Garder uniquement les chiffres

  // Si le numéro est vide après nettoyage
  if (cleaned === '' || cleaned.length < 9) return '';

  // Ajouter le préfixe 0 si manquant pour les numéros à 9 chiffres
  if (cleaned.length === 9 && !cleaned.startsWith('0')) {
    cleaned = '0' + cleaned;
  }

  // Valider que c'est un numéro marocain valide (06xx ou 05xx, 10 chiffres)
  if (cleaned.length === 10 && (cleaned.startsWith('06') || cleaned.startsWith('05') || cleaned.startsWith('07'))) {
    stats.phoneFormatted++;
    return cleaned;
  }

  // Si le numéro ne correspond pas aux critères, retourner vide
  stats.warnings.push(`Numéro invalide ignoré: ${phone}`);
  return '';
}

/**
 * Nettoie et valide une adresse email
 * @param {string} email - Email brut
 * @returns {string} - Email nettoyé ou chaîne vide
 */
function cleanEmail(email) {
  if (!email || email.trim() === '') return '';

  const cleaned = email.trim().toLowerCase();

  // Validation basique de l'email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (emailRegex.test(cleaned)) {
    return cleaned;
  }

  return '';
}

/**
 * Nettoie le texte en corrigeant l'encodage
 * @param {string} text - Texte avec encodage incorrect
 * @returns {string} - Texte avec encodage corrigé
 */
function fixEncoding(text) {
  if (!text) return '';

  // Mapping des caractères mal encodés vers les bons caractères
  const encodingMap = {
    '�': 'é',
    'Ã©': 'é',
    'Ã¨': 'è',
    'Ã': 'à',
    'Ã´': 'ô',
    'Ã§': 'ç',
    'Ã»': 'û',
    'Ã®': 'î',
    'Ã«': 'ë',
    'Ã¯': 'ï',
    'É': 'É',
    'È': 'È',
    'À': 'À'
  };

  let fixed = text;

  // Remplacer les caractères mal encodés
  for (const [wrong, correct] of Object.entries(encodingMap)) {
    fixed = fixed.replace(new RegExp(wrong, 'g'), correct);
  }

  return fixed.trim();
}

/**
 * Parse une ligne CSV en tenant compte des guillemets
 * @param {string} line - Ligne CSV
 * @returns {Array<string>} - Tableau de valeurs
 */
function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current);
  return values.map(v => v.trim().replace(/^"|"$/g, ''));
}

/**
 * Nettoie et normalise une entrée de médecin
 * @param {Object} raw - Données brutes
 * @param {string} secteur - 'public' ou 'privé'
 * @returns {Object} - Données nettoyées
 */
function cleanMedecinRecord(raw, secteur) {
  return {
    nom: fixEncoding(raw.nom || ''),
    prenom: fixEncoding(raw.prenom || ''),
    specialite: fixEncoding(raw.specialite || ''),
    secteur: secteur,
    gsm: cleanPhoneNumber(raw.gsm || ''),
    telProfessionnel: cleanPhoneNumber(raw.telProfessionnel || ''),
    adresseProfessionnelle: fixEncoding(raw.adresseProfessionnelle || ''),
    commune: fixEncoding(raw.commune || ''),
    province: fixEncoding(raw.province || ''),
    email: cleanEmail(raw.email || '')
  };
}

/**
 * Lit et parse un fichier CSV
 * @param {string} filePath - Chemin du fichier
 * @param {string} secteur - 'public' ou 'privé'
 * @returns {Array<Object>} - Tableau d'objets médecins
 */
function readCSV(filePath, secteur) {
  console.log(`\nLecture de ${filePath}...`);

  try {
    // Lire le fichier avec différents encodages possibles
    let content;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch (err) {
      // Essayer avec latin1 si utf8 échoue
      content = fs.readFileSync(filePath, 'latin1');
    }

    const lines = content.split('\n').filter(line => line.trim() !== '');

    if (lines.length < 2) {
      throw new Error('Fichier vide ou invalide');
    }

    // Parser l'en-tête
    const header = parseCSVLine(lines[0]);
    console.log(`En-tête: ${header.join(' | ')}`);

    const records = [];

    // Parser les données
    for (let i = 1; i < lines.length; i++) {
      try {
        const values = parseCSVLine(lines[i]);

        // Mapper les valeurs selon la structure du fichier
        let raw;
        if (secteur === 'public') {
          // Structure: Nom,Prénom,Spécialité,GSM,Tel professionnel,Adresse professionnelle,Commune,Province,Email
          raw = {
            nom: values[0],
            prenom: values[1],
            specialite: values[2],
            gsm: values[3],
            telProfessionnel: values[4],
            adresseProfessionnelle: values[5],
            commune: values[6],
            province: values[7],
            email: values[8]
          };
        } else {
          // Structure privé: Nom,Prénom,Spécialité,Adresse professionnelle,[vide],GSM,Tel professionnel,Commune,Province,Email
          raw = {
            nom: values[0],
            prenom: values[1],
            specialite: values[2],
            adresseProfessionnelle: values[3],
            // values[4] est vide
            gsm: values[5],
            telProfessionnel: values[6],
            commune: values[7],
            province: values[8],
            email: values[9]
          };
        }

        const cleaned = cleanMedecinRecord(raw, secteur);

        // Validation: au minimum nom et prénom requis
        if (cleaned.nom && cleaned.prenom) {
          records.push(cleaned);
        } else {
          stats.warnings.push(`Ligne ${i + 1}: Nom ou prénom manquant`);
        }

      } catch (err) {
        stats.errors.push({
          line: i + 1,
          error: err.message,
          content: lines[i].substring(0, 100)
        });
      }
    }

    console.log(`✓ ${records.length} enregistrements lus`);
    return records;

  } catch (err) {
    console.error(`✗ Erreur lors de la lecture de ${filePath}:`, err.message);
    stats.errors.push({
      file: filePath,
      error: err.message
    });
    return [];
  }
}

/**
 * Détecte et marque les doublons
 * @param {Array<Object>} records - Tableau de médecins
 * @returns {Array<Object>} - Tableau sans doublons
 */
function removeDuplicates(records) {
  const seen = new Map();
  const unique = [];

  records.forEach((record, index) => {
    const key = `${record.nom.toLowerCase()}_${record.prenom.toLowerCase()}_${record.specialite.toLowerCase()}`;

    if (seen.has(key)) {
      stats.duplicates++;
      stats.warnings.push(`Doublon détecté: ${record.prenom} ${record.nom} (${record.specialite})`);
    } else {
      seen.set(key, true);
      unique.push(record);
    }
  });

  return unique;
}

/**
 * Écrit les données nettoyées en CSV
 * @param {Array<Object>} records - Tableau de médecins nettoyés
 * @param {string} outputPath - Chemin du fichier de sortie
 */
function writeCleanedCSV(records, outputPath) {
  console.log(`\nÉcriture de ${records.length} enregistrements dans ${outputPath}...`);

  // En-tête du fichier de sortie
  const header = [
    'Nom',
    'Prénom',
    'Spécialité',
    'Secteur',
    'GSM',
    'Téléphone Professionnel',
    'Adresse Professionnelle',
    'Commune',
    'Province',
    'Email'
  ];

  // Convertir les enregistrements en lignes CSV
  const lines = [header.join(',')];

  records.forEach(record => {
    const row = [
      escapeCSV(record.nom),
      escapeCSV(record.prenom),
      escapeCSV(record.specialite),
      escapeCSV(record.secteur),
      escapeCSV(record.gsm),
      escapeCSV(record.telProfessionnel),
      escapeCSV(record.adresseProfessionnelle),
      escapeCSV(record.commune),
      escapeCSV(record.province),
      escapeCSV(record.email)
    ];
    lines.push(row.join(','));
  });

  // Écrire le fichier
  fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');
  console.log(`✓ Fichier créé avec succès`);
}

/**
 * Échappe les valeurs pour CSV (ajoute des guillemets si nécessaire)
 * @param {string} value - Valeur à échapper
 * @returns {string} - Valeur échappée
 */
function escapeCSV(value) {
  if (!value) return '';

  const str = String(value);

  // Si la valeur contient une virgule, un guillemet ou un retour à la ligne, l'entourer de guillemets
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Génère un rapport de nettoyage
 */
function generateReport() {
  console.log('\n' + '='.repeat(60));
  console.log('RAPPORT DE NETTOYAGE');
  console.log('='.repeat(60));
  console.log(`Total d'enregistrements traités: ${stats.totalRecords}`);
  console.log(`  - Secteur public: ${stats.publicRecords}`);
  console.log(`  - Secteur privé: ${stats.priveRecords}`);
  console.log(`\nNettoyages effectués:`);
  console.log(`  - Numéros de téléphone formatés: ${stats.phoneFormatted}`);
  console.log(`  - Doublons supprimés: ${stats.duplicates}`);
  console.log(`\nProblèmes détectés:`);
  console.log(`  - Erreurs: ${stats.errors.length}`);
  console.log(`  - Avertissements: ${stats.warnings.length}`);
  console.log('='.repeat(60));

  // Sauvegarder le rapport détaillé
  const report = {
    date: new Date().toISOString(),
    statistics: stats,
    summary: {
      totalRecords: stats.totalRecords,
      publicRecords: stats.publicRecords,
      priveRecords: stats.priveRecords,
      errors: stats.errors.length,
      warnings: stats.warnings.length
    }
  };

  fs.writeFileSync(ERRORS_LOG, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\n✓ Rapport détaillé sauvegardé dans ${ERRORS_LOG}`);
}

/**
 * Fonction principale
 */
function main() {
  console.log('='.repeat(60));
  console.log('NETTOYAGE DES FICHIERS CSV DES MÉDECINS');
  console.log('='.repeat(60));

  // Créer le dossier de sortie s'il n'existe pas
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`✓ Dossier de sortie créé: ${OUTPUT_DIR}`);
  }

  // Lire les fichiers
  const publicRecords = readCSV(PUBLIC_FILE, 'public');
  const priveRecords = readCSV(PRIVE_FILE, 'privé');

  // Mettre à jour les statistiques
  stats.publicRecords = publicRecords.length;
  stats.priveRecords = priveRecords.length;

  // Fusionner les enregistrements
  console.log('\nFusion des enregistrements...');
  let allRecords = [...publicRecords, ...priveRecords];
  stats.totalRecords = allRecords.length;

  // Supprimer les doublons
  console.log('\nSuppression des doublons...');
  allRecords = removeDuplicates(allRecords);

  // Trier par nom puis prénom
  console.log('\nTri alphabétique...');
  allRecords.sort((a, b) => {
    const nameCompare = a.nom.localeCompare(b.nom, 'fr');
    if (nameCompare !== 0) return nameCompare;
    return a.prenom.localeCompare(b.prenom, 'fr');
  });

  // Écrire le fichier nettoyé
  writeCleanedCSV(allRecords, OUTPUT_FILE);

  // Générer le rapport
  generateReport();

  console.log('\n✓ Nettoyage terminé avec succès!\n');
}

// Exécuter le script
main();
