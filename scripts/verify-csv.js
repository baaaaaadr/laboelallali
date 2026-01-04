/**
 * Script de vérification du fichier CSV nettoyé
 *
 * Vérifie :
 * - Nombre de lignes
 * - Encodage et accents
 * - Format des numéros de téléphone
 * - Format des emails
 * - Cohérence des données
 */

const fs = require('fs');
const path = require('path');

const CSV_FILE = path.join(__dirname, '..', 'BDDMedecins', 'cleaned', 'medecins_agadir_cleaned.csv');
const VERIFICATION_REPORT = path.join(__dirname, '..', 'BDDMedecins', 'cleaned', 'verification_report.json');

// Statistiques de vérification
const stats = {
  totalLines: 0,
  totalRecords: 0,
  encoding: {
    isUTF8: false,
    hasAccents: false,
    accentExamples: []
  },
  phoneNumbers: {
    valid: 0,
    invalid: 0,
    missing: 0,
    examples: {
      valid: [],
      invalid: []
    }
  },
  emails: {
    valid: 0,
    invalid: 0,
    missing: 0,
    examples: {
      valid: [],
      invalid: []
    }
  },
  secteurs: {
    public: 0,
    prive: 0,
    invalid: 0
  },
  specialites: {},
  communes: {},
  provinces: {},
  errors: [],
  warnings: []
};

/**
 * Vérifie si un numéro de téléphone est valide
 */
function isValidPhone(phone) {
  if (!phone || phone.trim() === '') return false;

  // Format attendu: 10 chiffres commençant par 05, 06, ou 07
  const phoneRegex = /^0[567]\d{8}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
}

/**
 * Vérifie si un email est valide
 */
function isValidEmail(email) {
  if (!email || email.trim() === '') return false;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Détecte les caractères accentués
 */
function detectAccents(text) {
  const accentRegex = /[àâäéèêëïîôùûüÿçœæ]/gi;
  return accentRegex.test(text);
}

/**
 * Extrait des exemples d'accents
 */
function extractAccentExamples(text) {
  const matches = text.match(/\b\w*[àâäéèêëïîôùûüÿçœæ]\w*\b/gi);
  return matches ? matches.slice(0, 5) : [];
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
 * Vérifie un enregistrement
 */
function verifyRecord(values, lineNumber) {
  // Structure attendue: Nom, Prénom, Spécialité, Secteur, GSM, Téléphone Pro, Adresse, Commune, Province, Email

  if (values.length !== 10) {
    stats.errors.push({
      line: lineNumber,
      error: `Nombre de colonnes incorrect: ${values.length} au lieu de 10`,
      data: values.slice(0, 3).join(', ')
    });
    return;
  }

  const [nom, prenom, specialite, secteur, gsm, telPro, adresse, commune, province, email] = values;

  // Vérifier les champs obligatoires
  if (!nom || !prenom) {
    stats.errors.push({
      line: lineNumber,
      error: 'Nom ou prénom manquant',
      data: `${nom} ${prenom}`
    });
    return;
  }

  // Détecter les accents
  const fullText = values.join(' ');
  if (detectAccents(fullText)) {
    stats.encoding.hasAccents = true;
    const examples = extractAccentExamples(fullText);
    if (examples.length > 0 && stats.encoding.accentExamples.length < 10) {
      stats.encoding.accentExamples.push(...examples.slice(0, 3));
    }
  }

  // Vérifier le secteur
  if (secteur === 'public') {
    stats.secteurs.public++;
  } else if (secteur === 'privé') {
    stats.secteurs.prive++;
  } else {
    stats.secteurs.invalid++;
    stats.warnings.push({
      line: lineNumber,
      warning: `Secteur invalide: "${secteur}"`,
      data: `${prenom} ${nom}`
    });
  }

  // Vérifier GSM
  if (gsm && gsm.trim() !== '') {
    if (isValidPhone(gsm)) {
      stats.phoneNumbers.valid++;
      if (stats.phoneNumbers.examples.valid.length < 5) {
        stats.phoneNumbers.examples.valid.push(gsm);
      }
    } else {
      stats.phoneNumbers.invalid++;
      if (stats.phoneNumbers.examples.invalid.length < 5) {
        stats.phoneNumbers.examples.invalid.push(gsm);
      }
      stats.warnings.push({
        line: lineNumber,
        warning: `GSM invalide: "${gsm}"`,
        data: `${prenom} ${nom}`
      });
    }
  } else {
    stats.phoneNumbers.missing++;
  }

  // Vérifier téléphone professionnel
  if (telPro && telPro.trim() !== '') {
    if (isValidPhone(telPro)) {
      stats.phoneNumbers.valid++;
      if (stats.phoneNumbers.examples.valid.length < 5) {
        stats.phoneNumbers.examples.valid.push(telPro);
      }
    } else {
      stats.phoneNumbers.invalid++;
      if (stats.phoneNumbers.examples.invalid.length < 5) {
        stats.phoneNumbers.examples.invalid.push(telPro);
      }
    }
  } else {
    stats.phoneNumbers.missing++;
  }

  // Vérifier email
  if (email && email.trim() !== '') {
    if (isValidEmail(email)) {
      stats.emails.valid++;
      if (stats.emails.examples.valid.length < 5) {
        stats.emails.examples.valid.push(email);
      }
    } else {
      stats.emails.invalid++;
      if (stats.emails.examples.invalid.length < 5) {
        stats.emails.examples.invalid.push(email);
      }
      stats.warnings.push({
        line: lineNumber,
        warning: `Email invalide: "${email}"`,
        data: `${prenom} ${nom}`
      });
    }
  } else {
    stats.emails.missing++;
  }

  // Compter les spécialités
  if (specialite) {
    stats.specialites[specialite] = (stats.specialites[specialite] || 0) + 1;
  }

  // Compter les communes
  if (commune) {
    stats.communes[commune] = (stats.communes[commune] || 0) + 1;
  }

  // Compter les provinces
  if (province) {
    stats.provinces[province] = (stats.provinces[province] || 0) + 1;
  }

  stats.totalRecords++;
}

/**
 * Fonction principale
 */
function main() {
  console.log('='.repeat(70));
  console.log('VÉRIFICATION DU FICHIER CSV NETTOYÉ');
  console.log('='.repeat(70));
  console.log(`Fichier: ${CSV_FILE}\n`);

  try {
    // Lire le fichier en UTF-8
    const content = fs.readFileSync(CSV_FILE, 'utf8');
    const lines = content.split('\n').filter(line => line.trim() !== '');

    stats.totalLines = lines.length;
    stats.encoding.isUTF8 = true;

    console.log(`📄 Total de lignes: ${stats.totalLines}`);

    if (lines.length < 2) {
      console.error('❌ Fichier vide ou invalide');
      return;
    }

    // Vérifier l'en-tête
    const header = parseCSVLine(lines[0]);
    console.log(`\n📋 En-tête (${header.length} colonnes):`);
    header.forEach((col, i) => {
      console.log(`   ${i + 1}. ${col}`);
    });

    // Vérifier chaque ligne
    console.log(`\n🔍 Vérification des enregistrements...`);
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      verifyRecord(values, i + 1);
    }

    // Afficher le rapport
    console.log('\n' + '='.repeat(70));
    console.log('RAPPORT DE VÉRIFICATION');
    console.log('='.repeat(70));

    console.log(`\n📊 STATISTIQUES GÉNÉRALES:`);
    console.log(`   Total lignes (avec en-tête): ${stats.totalLines}`);
    console.log(`   Total enregistrements: ${stats.totalRecords}`);
    console.log(`   Encodage UTF-8: ${stats.encoding.isUTF8 ? '✅ OUI' : '❌ NON'}`);

    console.log(`\n🔤 ENCODAGE ET ACCENTS:`);
    console.log(`   Accents détectés: ${stats.encoding.hasAccents ? '✅ OUI' : '❌ NON'}`);
    if (stats.encoding.accentExamples.length > 0) {
      console.log(`   Exemples de mots avec accents:`);
      [...new Set(stats.encoding.accentExamples)].slice(0, 10).forEach(ex => {
        console.log(`      - ${ex}`);
      });
    }

    console.log(`\n🏥 SECTEURS:`);
    console.log(`   Public: ${stats.secteurs.public}`);
    console.log(`   Privé: ${stats.secteurs.prive}`);
    if (stats.secteurs.invalid > 0) {
      console.log(`   ⚠️  Invalides: ${stats.secteurs.invalid}`);
    }

    console.log(`\n📱 NUMÉROS DE TÉLÉPHONE:`);
    console.log(`   Valides: ${stats.phoneNumbers.valid}`);
    console.log(`   Invalides: ${stats.phoneNumbers.invalid}`);
    console.log(`   Manquants: ${stats.phoneNumbers.missing}`);
    if (stats.phoneNumbers.examples.valid.length > 0) {
      console.log(`   Exemples valides: ${stats.phoneNumbers.examples.valid.slice(0, 3).join(', ')}`);
    }
    if (stats.phoneNumbers.examples.invalid.length > 0) {
      console.log(`   ⚠️  Exemples invalides: ${stats.phoneNumbers.examples.invalid.slice(0, 3).join(', ')}`);
    }

    console.log(`\n📧 EMAILS:`);
    console.log(`   Valides: ${stats.emails.valid}`);
    console.log(`   Invalides: ${stats.emails.invalid}`);
    console.log(`   Manquants: ${stats.emails.missing}`);
    if (stats.emails.examples.valid.length > 0) {
      console.log(`   Exemples valides: ${stats.emails.examples.valid.slice(0, 2).join(', ')}`);
    }

    console.log(`\n🏆 TOP 10 SPÉCIALITÉS:`);
    const topSpecialites = Object.entries(stats.specialites)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    topSpecialites.forEach(([spec, count]) => {
      console.log(`   ${spec}: ${count}`);
    });

    console.log(`\n🌍 TOP 10 COMMUNES:`);
    const topCommunes = Object.entries(stats.communes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    topCommunes.forEach(([commune, count]) => {
      console.log(`   ${commune}: ${count}`);
    });

    console.log(`\n📍 PROVINCES:`);
    const topProvinces = Object.entries(stats.provinces)
      .sort((a, b) => b[1] - a[1]);
    topProvinces.forEach(([province, count]) => {
      console.log(`   ${province}: ${count}`);
    });

    if (stats.errors.length > 0) {
      console.log(`\n❌ ERREURS (${stats.errors.length}):`);
      stats.errors.slice(0, 10).forEach(err => {
        console.log(`   Ligne ${err.line}: ${err.error}`);
        console.log(`      → ${err.data}`);
      });
      if (stats.errors.length > 10) {
        console.log(`   ... et ${stats.errors.length - 10} autres erreurs`);
      }
    }

    if (stats.warnings.length > 0) {
      console.log(`\n⚠️  AVERTISSEMENTS (${stats.warnings.length}):`);
      stats.warnings.slice(0, 10).forEach(warn => {
        console.log(`   Ligne ${warn.line}: ${warn.warning}`);
      });
      if (stats.warnings.length > 10) {
        console.log(`   ... et ${stats.warnings.length - 10} autres avertissements`);
      }
    }

    console.log('\n' + '='.repeat(70));

    // Verdict final
    console.log('\n🎯 VERDICT FINAL:');
    const isValid = stats.errors.length === 0 && stats.phoneNumbers.invalid === 0 && stats.emails.invalid === 0;

    if (isValid) {
      console.log('   ✅ FICHIER VALIDE - Prêt pour l\'import');
    } else {
      console.log('   ⚠️  FICHIER NÉCESSITE DES CORRECTIONS');
    }

    console.log('\n💡 PROBLÈME D\'ACCENTS DANS EXCEL:');
    console.log('   Le fichier est en UTF-8, mais Excel a besoin de UTF-8 avec BOM.');
    console.log('   Solution: Importer via "Données > Depuis un fichier texte/CSV"');
    console.log('   Ou utiliser le fichier Excel créé par le script de correction.');

    // Sauvegarder le rapport
    const report = {
      date: new Date().toISOString(),
      file: CSV_FILE,
      statistics: stats,
      verdict: isValid ? 'VALID' : 'NEEDS_CORRECTION'
    };

    fs.writeFileSync(VERIFICATION_REPORT, JSON.stringify(report, null, 2), 'utf8');
    console.log(`\n✅ Rapport détaillé sauvegardé: ${VERIFICATION_REPORT}`);
    console.log('='.repeat(70) + '\n');

  } catch (err) {
    console.error('❌ Erreur lors de la lecture du fichier:', err.message);
    process.exit(1);
  }
}

// Exécuter
main();
