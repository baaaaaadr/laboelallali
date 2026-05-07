const admin = require('firebase-admin');

// Initialize with environment variables if available
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function listBilans() {
  try {
    const snapshot = await db.collection('bilans').get();
    console.log('--- Current Bilans in Firestore ---');
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`ID: ${doc.id} | Name_FR: ${data.Nom_Bilan_FR}`);
    });
    console.log('--- End of List ---');
  } catch (error) {
    console.error('Error listing bilans:', error);
  }
}

listBilans();
