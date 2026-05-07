/**
 * Firestore Cleanup Script for Bilans
 * 
 * This script removes unwanted documents from the 'bilans' collection.
 * It keeps only the 10 specified bilans and removes everything else,
 * including the accidental header row import.
 * 
 * Usage:
 * 1. Ensure you have the project credentials configured (or run via firebase-tools)
 * 2. Run: node scripts/cleanup-bilans.js
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
// If running locally, you might need: export GOOGLE_APPLICATION_CREDENTIALS="path/to/serviceAccountKey.json"
// Or if you have logged in via firebase CLI, it might pick up default credentials.
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// List of approved Bilan IDs
const APPROVED_IDS = [
  'bilan_sante_global',
  'bilan_diabete',
  'bilan_thyroide',
  'bilan_renal',
  'bilan_hepatique',
  'bilan_ist_mst',
  'bilan_mariage',
  'bilan_standard_femmes',
  'bilan_standard_hommes',
  'bilan_visa_espagne'
];

async function cleanupBilans() {
  console.log('--- Starting Firestore Bilans Cleanup ---');
  
  try {
    const bilansRef = db.collection('bilans');
    const snapshot = await bilansRef.get();
    
    if (snapshot.empty) {
      console.log('No documents found in "bilans" collection.');
      return;
    }

    let deletedCount = 0;
    let keptCount = 0;

    const batch = db.batch();

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const id = doc.id;
      
      // Check if it's the header row or not in approved list
      const isHeader = data.Nom_Bilan_FR === 'Nom_Bilan_FR';
      const isApproved = APPROVED_IDS.includes(id);

      if (isHeader || !isApproved) {
        console.log(`[DELETE] ID: ${id} | Name: ${data.Nom_Bilan_FR || 'N/A'}`);
        batch.delete(doc.ref);
        deletedCount++;
      } else {
        console.log(`[KEEP]   ID: ${id} | Name: ${data.Nom_Bilan_FR}`);
        keptCount++;
      }
    }

    if (deletedCount > 0) {
      await batch.commit();
      console.log(`\nSuccessfully deleted ${deletedCount} unwanted documents.`);
    } else {
      console.log('\nNo documents needed to be deleted.');
    }
    
    console.log(`Total kept: ${keptCount}`);
    console.log('--- Cleanup Complete ---');

  } catch (error) {
    console.error('Error during cleanup:', error);
    console.log('\nTIP: If you get "Credential implementation provided to initializeApp() via the \"credential\" property failed to fetch a token",');
    console.log('make sure you are authenticated with "firebase login" and have set the project ID.');
  }
}

cleanupBilans();
