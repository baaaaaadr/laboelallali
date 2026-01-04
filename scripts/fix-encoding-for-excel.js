/**
 * Script pour corriger l'encodage final et créer un fichier compatible Excel
 *
 * Problèmes résolus:
 * - Caractères mal encodés résiduels (éééé → é)
 * - UTF-8 avec BOM pour Excel
 * - Nettoyage final des caractères spéciaux
 */

const fs = require('fs');
const path = require('path');

const INPUT_FILE = path.join(__dirname, '..', 'BDDMedecins', 'cleaned', 'medecins_agadir_cleaned.csv');
const OUTPUT_FILE_EXCEL = path.join(__dirname, '..', 'BDDMedecins', 'cleaned', 'medecins_agadir_excel.csv');
const OUTPUT_FILE_GSHEET = path.join(__dirname, '..', 'BDDMedecins', 'cleaned', 'medecins_agadir_gsheet.csv');

// UTF-8 BOM (Byte Order Mark) pour Excel
const UTF8_BOM = '\uFEFF';

/**
 * Applique les corrections d'encodage dans le bon ordre
 */
function fixEncoding(text) {
  if (!text) return text;

  let fixed = text;

  // ÉTAPE 1: Corrections spécifiques d'abord (pour éviter les conflits)
  const specificFixes = {
    'Néphrologie': 'Néphrologie',  // Protéger les mots qui commencent par Né
    'Néphr': 'Néphr',
    'Inezgane éééé': 'Inezgane',
    'Ait Melloul é': 'Ait Melloul',
    'Biougra é': 'Biougra',
    'Dcheira El Jihadia éé': 'Dcheira El Jihadia',
    'Routiére': 'Routière',
    'Aét': 'Aït',
    'Héspitalier': 'Hospitalier'
  };

  for (const [wrong, correct] of Object.entries(specificFixes)) {
    fixed = fixed.replace(new RegExp(wrong, 'g'), correct);
  }

  // ÉTAPE 2: Corriger les caractères résiduels multiples
  fixed = fixed.replace(/é{2,}/g, 'é');

  // ÉTAPE 3: Corriger Né en N° uniquement pour les numéros (suivi de chiffres)
  fixed = fixed.replace(/Né(\d)/g, 'N°$1');

  return fixed;
}


/**
 * Parse une ligne CSV
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
 * Échappe les valeurs pour CSV
 */
function escapeCSV(value, forceText = false) {
  if (!value) return '';

  const str = String(value);

  // Pour Google Sheets: ajouter ' pour forcer le format texte
  if (forceText && str.match(/^0\d+$/)) {
    return `'${str}`;
  }

  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Fonction principale
 */
function main() {
  console.log('='.repeat(70));
  console.log('CORRECTION D\'ENCODAGE POUR EXCEL ET GOOGLE SHEETS');
  console.log('='.repeat(70));
  console.log(`Fichier source: ${INPUT_FILE}\n`);

  try {
    // Lire le fichier
    const content = fs.readFileSync(INPUT_FILE, 'utf8');
    const lines = content.split('\n').filter(line => line.trim() !== '');

    console.log(`📄 Lignes lues: ${lines.length}`);

    const correctedLinesExcel = [];
    const correctedLinesGSheet = [];
    const corrections = new Set();

    // Traiter chaque ligne
    for (let i = 0; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);

      // Pour Excel (sans apostrophe)
      const correctedValuesExcel = values.map(val => {
        const original = val;
        const fixed = fixEncoding(val);

        if (original !== fixed && i > 0) {
          corrections.add(`"${original}" → "${fixed}"`);
        }

        return escapeCSV(fixed, false);
      });

      // Pour Google Sheets (avec apostrophe pour les téléphones)
      const correctedValuesGSheet = values.map((val, index) => {
        const fixed = fixEncoding(val);

        // Colonnes 4 (GSM) et 5 (Téléphone Pro) en index 4 et 5
        const isPhoneColumn = (index === 4 || index === 5) && i > 0;

        return escapeCSV(fixed, isPhoneColumn);
      });

      correctedLinesExcel.push(correctedValuesExcel.join(','));
      correctedLinesGSheet.push(correctedValuesGSheet.join(','));
    }

    // Écrire le fichier Excel avec UTF-8 BOM
    const outputExcel = UTF8_BOM + correctedLinesExcel.join('\n');
    fs.writeFileSync(OUTPUT_FILE_EXCEL, outputExcel, 'utf8');

    // Écrire le fichier Google Sheets avec UTF-8 BOM
    const outputGSheet = UTF8_BOM + correctedLinesGSheet.join('\n');
    fs.writeFileSync(OUTPUT_FILE_GSHEET, outputGSheet, 'utf8');

    console.log(`\n✅ Fichier Excel créé: ${OUTPUT_FILE_EXCEL}`);
    console.log(`✅ Fichier Google Sheets créé: ${OUTPUT_FILE_GSHEET}`);
    console.log(`📝 Total d'enregistrements: ${lines.length - 1}`);

    if (corrections.size > 0) {
      console.log(`\n🔧 Corrections appliquées (${corrections.size} uniques):`);
      const correctionsList = Array.from(corrections).slice(0, 15);
      correctionsList.forEach(corr => {
        console.log(`   - ${corr}`);
      });
      if (corrections.size > 15) {
        console.log(`   ... et ${corrections.size - 15} autres corrections`);
      }
    }

    console.log('\n💡 UTILISATION:');
    console.log('   📊 EXCEL: Utilisez medecins_agadir_excel.csv');
    console.log('   📗 GOOGLE SHEETS: Utilisez medecins_agadir_gsheet.csv');
    console.log('      → Les numéros de téléphone garderont leur 0 initial!');

    console.log('\n✅ Les fichiers sont prêts!');
    console.log('='.repeat(70) + '\n');

  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  }
}

// Exécuter
main();
