# Guide : Configuration Google Sheets pour les Médecins

## 📊 ÉTAPE 1 : Créer la feuille Google Sheets

### 1.1 Importer le fichier CSV

1. Allez sur [Google Sheets](https://sheets.google.com)
2. Créez une nouvelle feuille : **"Médecins Agadir"**
3. Importez le fichier : `BDDMedecins/cleaned/medecins_agadir_gsheet.csv`
   - Fichier > Importer > Charger
   - Type de séparateur : Virgule
   - Encodage : UTF-8

### 1.2 Renommer l'onglet

**IMPORTANT :** Renommez l'onglet en : **`Medecins pour Application`**

### 1.3 Ajouter une colonne ID

**TRÈS IMPORTANT :** Vous devez ajouter une colonne `id` en première position.

#### Structure finale (11 colonnes) :

| A | B | C | D | E | F | G | H | I | J | K |
|---|---|---|---|---|---|---|---|---|---|---|
| **id** | **nom** | **prenom** | **specialite** | **secteur** | **gsm** | **tel_professionnel** | **adresse** | **commune** | **province** | **email** |

#### Génération des IDs :

Les IDs doivent suivre ce format : `MED001`, `MED002`, etc.

**Formule à utiliser dans la cellule A2 :**
```
="MED"&TEXT(ROW()-1,"000")
```

Puis copiez cette formule vers le bas pour toutes les lignes.

### 1.4 Renommer les en-têtes de colonnes

Renommez les colonnes pour correspondre exactement à ceci (case-sensitive) :

| Ancien (CSV) | Nouveau (Firestore) |
|--------------|---------------------|
| Nom | **nom** |
| Prénom | **prenom** |
| Spécialité | **specialite** |
| Secteur | **secteur** |
| GSM | **gsm** |
| Téléphone Professionnel | **tel_professionnel** |
| Adresse Professionnelle | **adresse** |
| Commune | **commune** |
| Province | **province** |
| Email | **email** |

### 1.5 Résultat final

Votre feuille devrait ressembler à ceci :

```
id      | nom      | prenom     | specialite                | secteur | gsm        | tel_professionnel | adresse              | commune | province            | email
--------|----------|------------|---------------------------|---------|------------|-------------------|----------------------|---------|---------------------|-------------------------
MED001  | AACHARI  | El Hassan  | Gynécologie obstétrique   | privé   | 0661526770 | 0528220102        | Avenue Hassan 1Er... | Agadir  | Agadir Ida Ou Tanan | docteuraachari@gmail.com
MED002  | AADLAFI  | Nadia      | Médecine générale         | public  | 0673191472 | 0673219147        | Centre de Santé...   | Dcheira | Inezgane Ait Melloul| nadiaaadlafi1@gmail.com
```

---

## 📝 ÉTAPE 2 : Installer le Script Apps Script

### 2.1 Ouvrir l'éditeur Apps Script

1. Dans Google Sheets : **Extensions > Apps Script**
2. Supprimez le code par défaut
3. Copiez le script fourni (voir `APPS_SCRIPT_MEDECINS.gs`)

### 2.2 Ajouter la bibliothèque OAuth2

1. Dans Apps Script, cliquez sur le **+** à côté de "Bibliothèques"
2. ID de script : `1B7FSrk5Zi6L1rSxxTDgDEUsPzlukDsi4KGuTMorsTQHhGBzBVvbr38Ea`
3. Sélectionnez la dernière version
4. Cliquez sur **Ajouter**

### 2.3 Configurer les propriétés du script

1. Dans Apps Script : **Paramètres du projet** (icône engrenage ⚙️)
2. Faites défiler jusqu'à **Propriétés du script**
3. Ajoutez ces deux propriétés :

**Propriété 1 :**
- Nom : `SERVICE_ACCOUNT_EMAIL`
- Valeur : `sheet-catalog-updater@labo-el-allali-pwa.iam.gserviceaccount.com`

**Propriété 2 :**
- Nom : `SERVICE_ACCOUNT_PRIVATE_KEY`
- Valeur : (copiez la clé privée depuis le JSON - voir ci-dessous)

#### Comment obtenir la clé privée :

Depuis le fichier JSON du service account, copiez EXACTEMENT la valeur du champ `private_key` (avec les `\n`) :

```
-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCRMLt+nBAEHY+u\nvj1tChwo5UwsU+zj5iqQc+qpRcs7WuEytDOMbqK5GBYhrR+MvpGxjSZgWFh6GZEM\ns7mkYYB8vwUWw0f7k6CM5nc32qZ22Bccqve0GqBs8bU2gl1GfLb/rGby6btbvAeB\nbNleRXXeuJIU8VyNrWijyLbpQ6sGrIXmAsKjdSzrc+vNyP5depGses1z1mVI+MNg\nnvQajqOnVLDpKQ+iDzmH2rO0/U0Pd1cUiaL3udh8Y77aMxPalYx+EVkPmp+RnFe+\nZVeBZydb5imfcUTkv5DGR76RowgYKNqz4H0iwVgSajLPF1uKI4RV1SiRrcoh5IaV\nGMYSnvZ9AgMBAAECggEAB60WZ8653NkKDpIme29xGeTP/qxfPJTskJLFIZ1Vh3Yg\neUaxG2fo0k77y8MBHuofMZs47LFIpQfyzpBpkuj7jimnpYW+KaBeX1fhJ+kdxPAo\nZKhRv7Cd5U489CLqg75ppG6jSlnhWt7zKW+tgsAhLhz/Acly/CPJAcor7xak4g2q\nyYAvNxFZzLGDX3EwmL3zrWjlhBnr2fVR0zOIIXmxOMpp2uszG1hVa2ysKxymtHfu\nevrXCJ1i0mz8QgH4xd8ZDowv2xl9nzyavMtGnrZk9KV/kQ0ceWTbfLVCRYaXvYIr\n/HS2AdQqvfcG8TL42IyGBiRzvHb/1rXV8deWZMGY5wKBgQDL/w8DfQ76SmxFxMdj\nmbaTcGjGzPNR0zQOzbS18CthDjAdDY0vVNxsCeEuZ5NTtelKHiiMEQHTvkCzpnGX\nodiS45k8FfGn5r390t0cSBQDZvKM84ID+JYzSnJ6zCc64TaqUjMQRne7o3v+LAjB\nX7Z/IgFBI4aXon1lC6oyfw9V6wKBgQC2M/S4hM2V9mi4OKY44Y8xvexSOG2PV69e\ndBB3y18X4yKI9SV/Zk798rvdfcMXZ4BfAnFm6dILigauVKs5uRdeqIarBJG41arg\n2MWmYONz4Z6fW3oMwpmAAToUqCeEedbtH4Hfm0OqYzrFWAUEIr6EIylM7jxGqs+9\nMIKpr8VDNwKBgBJmK919rxcmFUPprq4uFAiST/D2VU/hA8X+CbmLMu5rEC3epghJ\n2COqdHPyBZi8RJFZzQBtHEQT2dQaRA6QG2+MNar0s7oYFrTJCwZc/ekcpO3PnL9s\n8Wco5NBsj3FBFOQhy9dA89WptipDoHqIfnZTA9fzM1WD41l0xuINEb4HAoGAbtVo\nFh5i2MhNp1J+erdq3b1EVjeRHdMfEHvV0KlbrTIzvdAyAS+A+aWAdhmcZU5GnoTj\n6tBtPyu1KLLEfZaECsbFNJ7Q7fi7u47hnHXvpnwme5WvxrdRnLYiWJJ5h3J+NTwn\nSpguLyWxiH4kfwGLluG0q+F3tR0OxW0O7p3Hhz0CgYA82bI1N35/mIKuu0rvKbvK\n4mGVprK6MkFC1am1nI/k1a8BJl9QR1I3982+NT85sE1SUdKmFtK82MMPiXEArPGU\ncbFKCsrueIB/4jN3USWu21oivdyff4ex20sW58Wg3T9D5Cup0vrysJlpZokUC+7S\nj1ZJXtEzR7WU44XfvsYT0g==\n-----END PRIVATE KEY-----\n
```

### 2.4 Déployer et tester

1. Sauvegardez le script (Ctrl+S)
2. Rafraîchissez la page Google Sheets
3. Un nouveau menu **"Firestore Sync"** devrait apparaître
4. Cliquez sur **"Firestore Sync > Sync ALL to Firestore"**
5. Autorisez le script lors de la première exécution

---

## ✅ Vérification

Après la synchronisation :
1. Allez dans [Firebase Console](https://console.firebase.google.com/)
2. Sélectionnez votre projet : `labo-el-allali-pwa`
3. Allez dans **Firestore Database**
4. Vous devriez voir une collection `medecins` avec 1389 documents

---

## 🔄 Synchronisation automatique

Le script est configuré avec un trigger `onEdit` qui synchronise automatiquement :
- Lorsque vous modifiez une cellule
- Lorsque vous ajoutez une nouvelle ligne
- Lorsque vous supprimez une ligne

---

## 📞 Support

En cas de problème :
1. Vérifiez les logs : Apps Script > Exécutions
2. Vérifiez que le Service Account a les bonnes permissions dans Firebase
3. Vérifiez que les noms de colonnes correspondent EXACTEMENT

