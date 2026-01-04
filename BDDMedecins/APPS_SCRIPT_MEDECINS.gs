// --- Configuration ---
const SHEET_NAME = "Medecins pour Application"; // NOM DE VOTRE ONGLET (à renommer si besoin)
const FIRESTORE_PROJECT_ID = "labo-el-allali-pwa";
const FIRESTORE_COLLECTION_NAME = "medecins"; // Collection Firestore pour les médecins
const ID_COLUMN_INDEX = 0; // Colonne 'id' en première position
const HEADER_ROWS = 1;

// --- Service Account Credentials (depuis Script Properties) ---
const SERVICE_ACCOUNT_EMAIL = PropertiesService.getScriptProperties().getProperty('SERVICE_ACCOUNT_EMAIL');
const SERVICE_ACCOUNT_PRIVATE_KEY = PropertiesService.getScriptProperties().getProperty('SERVICE_ACCOUNT_PRIVATE_KEY');

// --- OAuth2 Service ---
function getFirestoreService_() {
  if (!SERVICE_ACCOUNT_PRIVATE_KEY || !SERVICE_ACCOUNT_EMAIL) {
    throw new Error("Service account email or private key is not set in Script Properties.");
  }
  const formattedPrivateKey = SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n');

  return OAuth2.createService('Firestore')
    .setTokenUrl('https://oauth2.googleapis.com/token')
    .setPrivateKey(formattedPrivateKey)
    .setIssuer(SERVICE_ACCOUNT_EMAIL)
    .setSubject(SERVICE_ACCOUNT_EMAIL)
    .setPropertyStore(PropertiesService.getUserProperties())
    .setScope('https://www.googleapis.com/auth/datastore');
}

// --- Fonction principale de synchronisation ---
function syncSheetToFirestore() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) {
    Logger.log("Sheet not found: " + SHEET_NAME);
    SpreadsheetApp.getUi().alert("Error: Sheet '" + SHEET_NAME + "' not found.");
    return;
  }

  const data = sheet.getDataRange().getValues();
  if (data.length <= HEADER_ROWS) {
    Logger.log("No data to sync in sheet: " + SHEET_NAME);
    return;
  }

  const headers = data[HEADER_ROWS - 1];

  const firestoreService = getFirestoreService_();
  if (!firestoreService.hasAccess()) {
    const authUrl = firestoreService.getAuthorizationUrl();
    Logger.log("Authorization required. Please visit: " + authUrl);
    SpreadsheetApp.getUi().alert("Authorization Error: Script does not have access. Check Logs for details.");
    return;
  }

  const accessToken = firestoreService.getAccessToken();
  Logger.log("Access token obtained successfully.");

  let successCount = 0;
  let errorCount = 0;

  for (let i = HEADER_ROWS; i < data.length; i++) {
    const row = data[i];
    const docId = row[ID_COLUMN_INDEX] ? String(row[ID_COLUMN_INDEX]).trim() : null;

    if (!docId) {
      Logger.log("Skipping row " + (i + 1) + " due to missing ID.");
      continue;
    }

    const firestoreDoc = { fields: {} };
    let hasDataForDoc = false;

    for (let j = 0; j < headers.length; j++) {
      const header = String(headers[j]).trim();

      // Mapper les en-têtes français vers les noms de champs Firestore
      const fieldMapping = {
        'Nom': 'nom',
        'Prénom': 'prenom',
        'Spécialité': 'specialite',
        'Secteur': 'secteur',
        'GSM': 'gsm', // Stocké mais pas affiché publiquement
        'Téléphone Professionnel': 'tel_professionnel',
        'Adresse Professionnelle': 'adresse',
        'Commune': 'commune',
        'Province': 'province',
        'Email': 'email'
      };

      const firestoreFieldName = fieldMapping[header] || header.toLowerCase().replace(/\s+/g, '_');

      if (header && header !== "id") {
        let value = row[j];
        let typeValue = {};

        if (value === "" || value === null || typeof value === 'undefined') {
          continue; // Skip empty fields
        } else if (typeof value === 'boolean') {
          typeValue = { booleanValue: value };
        } else if (typeof value === 'number') {
          if (Number.isInteger(value)) {
            typeValue = { integerValue: String(value) };
          } else {
            typeValue = { doubleValue: value };
          }
        } else if (value instanceof Date) {
          typeValue = { timestampValue: value.toISOString() };
        } else {
          typeValue = { stringValue: String(value) };
        }

        firestoreDoc.fields[firestoreFieldName] = typeValue;
        hasDataForDoc = true;
      }
    }

    // Ajouter des métadonnées
    firestoreDoc.fields['updated_at'] = { timestampValue: new Date().toISOString() };
    firestoreDoc.fields['source'] = { stringValue: 'google_sheets' };

    if (!hasDataForDoc) {
      Logger.log("Row " + (i + 1) + " (ID: " + docId + ") has no data other than ID. Skipping.");
      continue;
    }

    const url = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/${FIRESTORE_COLLECTION_NAME}/${encodeURIComponent(docId)}`;
    const options = {
      method: 'patch',
      contentType: 'application/json',
      headers: {
        'Authorization': 'Bearer ' + accessToken
      },
      payload: JSON.stringify(firestoreDoc),
      muteHttpExceptions: true
    };

    try {
      const response = UrlFetchApp.fetch(url, options);
      const responseCode = response.getResponseCode();
      const responseBody = response.getContentText();

      if (responseCode >= 200 && responseCode < 300) {
        Logger.log("Successfully synced document ID: " + docId);
        successCount++;
      } else {
        Logger.log("Error syncing document ID: " + docId + ". Response Code: " + responseCode + ". Body: " + responseBody);
        errorCount++;
      }
    } catch (e) {
      Logger.log("Exception syncing document ID: " + docId + ". Error: " + e.toString());
      errorCount++;
    }
  }

  SpreadsheetApp.getUi().alert("Sync Complete. Successful: " + successCount + ", Errors: " + errorCount + ". Check logs for details.");
  Logger.log("Sync Complete. Successful: " + successCount + ", Errors: " + errorCount);
}

// --- Fonction de synchronisation lors de modifications ---
function onEditTrigger(e) {
  const sheet = e.source.getActiveSheet();

  if (sheet.getName() !== SHEET_NAME) {
    Logger.log("Edit in non-target sheet: " + sheet.getName() + ". Skipping sync.");
    return;
  }

  const range = e.range;
  const startRow = range.getRow();
  const numRows = range.getNumRows();

  if (startRow <= HEADER_ROWS || sheet.getLastRow() <= HEADER_ROWS) {
    Logger.log("Edit in header or no data rows. Skipping sync.");
    return;
  }

  Logger.log("Edit detected in " + SHEET_NAME + " at row " + startRow + ", numRows " + numRows);

  const data = sheet.getRange(startRow, 1, numRows, sheet.getLastColumn()).getValues();
  const headers = sheet.getRange(HEADER_ROWS, 1, 1, sheet.getLastColumn()).getValues()[0];

  const firestoreService = getFirestoreService_();
  if (!firestoreService.hasAccess()) {
    Logger.log("Authorization failed in onEditTrigger.");
    return;
  }
  const accessToken = firestoreService.getAccessToken();

  for (let i = 0; i < data.length; i++) {
    const currentRowData = data[i];
    const actualSheetRowNumber = startRow + i;
    const docId = currentRowData[ID_COLUMN_INDEX] ? String(currentRowData[ID_COLUMN_INDEX]).trim() : null;

    if (!docId) {
      Logger.log("Skipping row " + actualSheetRowNumber + " in onEditTrigger due to missing ID.");
      continue;
    }

    const isRowEffectivelyEmpty = !currentRowData.slice(ID_COLUMN_INDEX + 1).some(cell => cell !== "" && cell !== null && typeof cell !== 'undefined');

    if (isRowEffectivelyEmpty) {
      Logger.log("Row " + actualSheetRowNumber + " (ID: " + docId + ") is empty. Deleting from Firestore.");
      deleteDocumentFromFirestore_(docId, accessToken);
      continue;
    }

    const firestoreDoc = { fields: {} };
    let hasDataForDoc = false;

    for (let j = 0; j < headers.length; j++) {
      const header = String(headers[j]).trim();

      const fieldMapping = {
        'Nom': 'nom',
        'Prénom': 'prenom',
        'Spécialité': 'specialite',
        'Secteur': 'secteur',
        'GSM': 'gsm',
        'Téléphone Professionnel': 'tel_professionnel',
        'Adresse Professionnelle': 'adresse',
        'Commune': 'commune',
        'Province': 'province',
        'Email': 'email'
      };

      const firestoreFieldName = fieldMapping[header] || header.toLowerCase().replace(/\s+/g, '_');

      if (header && header !== "id") {
        let value = currentRowData[j];
        let typeValue = {};

        if (value === "" || value === null || typeof value === 'undefined') {
          typeValue = { nullValue: null };
        } else if (typeof value === 'boolean') {
          typeValue = { booleanValue: value };
        } else if (typeof value === 'number') {
          if (Number.isInteger(value)) {
            typeValue = { integerValue: String(value) };
          } else {
            typeValue = { doubleValue: value };
          }
        } else if (value instanceof Date) {
          typeValue = { timestampValue: value.toISOString() };
        } else {
          typeValue = { stringValue: String(value) };
        }

        firestoreDoc.fields[firestoreFieldName] = typeValue;
        hasDataForDoc = true;
      }
    }

    // Métadonnées
    firestoreDoc.fields['updated_at'] = { timestampValue: new Date().toISOString() };

    if (!hasDataForDoc && Object.keys(firestoreDoc.fields).length === 0) {
      Logger.log("Row " + actualSheetRowNumber + " (ID: " + docId + ") has no fields to update. Skipping.");
      continue;
    }

    const url = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/${FIRESTORE_COLLECTION_NAME}/${encodeURIComponent(docId)}`;
    const options = {
      method: 'patch',
      contentType: 'application/json',
      headers: { 'Authorization': 'Bearer ' + accessToken },
      payload: JSON.stringify(firestoreDoc),
      muteHttpExceptions: true
    };

    try {
      const response = UrlFetchApp.fetch(url, options);
      Logger.log(`Synced row ${actualSheetRowNumber} (ID: ${docId}) via onEdit. Status: ${response.getResponseCode()}`);
      if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
        Logger.log(`Error details: ${response.getContentText()}`);
      }
    } catch(err) {
      Logger.log(`Exception syncing row ${actualSheetRowNumber} (ID: ${docId}) via onEdit: ${err.message}`);
    }
  }
}

// --- Helper function to delete a document ---
function deleteDocumentFromFirestore_(docId, accessToken) {
  if (!docId || !accessToken) return;

  const url = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/${FIRESTORE_COLLECTION_NAME}/${encodeURIComponent(docId)}`;
  const options = {
    method: 'delete',
    headers: {
      'Authorization': 'Bearer ' + accessToken
    },
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    if (responseCode === 200) {
      Logger.log("Successfully deleted document ID: " + docId);
    } else if (responseCode === 404) {
      Logger.log("Document ID: " + docId + " not found in Firestore.");
    } else {
      Logger.log("Error deleting document ID: " + docId + ". Response Code: " + responseCode);
    }
  } catch (e) {
    Logger.log("Exception deleting document ID: " + docId + ". Error: " + e.toString());
  }
}

// --- Menu personnalisé ---
function onOpen() {
  SpreadsheetApp.getUi()
      .createMenu('Firestore Sync')
      .addItem('Sync ALL to Firestore', 'syncSheetToFirestore')
      .addToUi();
}
