# Base de données des Médecins - Agadir

Ce dossier contient la base de données des médecins d'Agadir (secteur public et privé) pour le site web du Laboratoire El Allali.

## 📁 Structure des fichiers

```
BDDMedecins/
├── BDD MEDECIN AGADIR public.csv       # Fichier source - secteur public
├── BDD MEDECIN AGADIR privé.csv        # Fichier source - secteur privé
├── cleaned/
│   ├── medecins_agadir_cleaned.csv     # ✅ Fichier nettoyé à utiliser
│   └── cleaning_errors.json            # Rapport de nettoyage
└── README.md                            # Ce fichier
```

## 🎯 Fichier à utiliser

**`cleaned/medecins_agadir_cleaned.csv`** - Ce fichier est prêt pour :
- Import dans Google Sheets
- Synchronisation avec Firestore
- Affichage sur le site web

## 📊 Structure des données nettoyées

| Colonne | Description | Exemple |
|---------|-------------|---------|
| **Nom** | Nom de famille | AACHARI |
| **Prénom** | Prénom | El Hassan |
| **Spécialité** | Spécialité médicale | Gynécologie obstétrique |
| **Secteur** | Public ou privé | privé |
| **GSM** | Numéro mobile (10 chiffres) | 0661526770 |
| **Téléphone Professionnel** | Téléphone cabinet (10 chiffres) | 0528220102 |
| **Adresse Professionnelle** | Adresse du cabinet | Avenue Hassan 1Er... |
| **Commune** | Commune | Agadir |
| **Province** | Province | Agadir Ida Ou Tanan |
| **Email** | Email professionnel | docteuraachari@gmail.com |

## 📈 Statistiques

- **Total médecins :** 1,389
  - Secteur public : 645
  - Secteur privé : 746
- **Numéros de téléphone formatés :** 2,491
- **Doublons supprimés :** 2
- **Erreurs :** 0

## 🔧 Nettoyage des données

Le script `scripts/clean-medecins-csv.js` effectue les opérations suivantes :

### Corrections automatiques :
1. **Encodage** : Correction des caractères accentués (é, è, à, ô, ç, etc.)
2. **Numéros de téléphone** :
   - Format uniforme : 10 chiffres avec préfixe 0
   - Exemples : `0661234567`, `0528123456`
   - Numéros invalides : supprimés
3. **Emails** : Validation et nettoyage (tout en minuscules)
4. **Doublons** : Détection par nom + prénom + spécialité
5. **Tri** : Alphabétique par nom puis prénom

### Pour relancer le nettoyage :
```bash
node scripts/clean-medecins-csv.js
```

## 📤 Prochaines étapes

### 1. Import dans Google Sheets

1. Ouvrir Google Sheets
2. Créer une nouvelle feuille de calcul : **"Médecins Agadir"**
3. Importer le fichier `cleaned/medecins_agadir_cleaned.csv`
   - Fichier > Importer > Charger
   - Type de séparateur : Virgule
   - Encodage : UTF-8

### 2. Configuration de la synchronisation Firestore

#### Structure Firestore recommandée :

```
Collection: medecins
Document ID: auto-généré
Champs:
{
  nom: string,
  prenom: string,
  specialite: string,
  secteur: string,              // "public" | "privé"
  contact: {
    gsm: string,
    telProfessionnel: string,
    email: string
  },
  adresse: {
    complete: string,
    commune: string,
    province: string
  },
  searchTerms: array,            // Pour la recherche : [nom, prenom, specialite]
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### Script Apps Script pour Google Sheets → Firestore :

```javascript
// À ajouter dans Google Sheets > Extensions > Apps Script
function syncToFirestore() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  // Configuration Firestore (à adapter)
  const projectId = 'VOTRE_PROJECT_ID';
  const apiKey = 'VOTRE_API_KEY';

  // Parcourir les lignes et envoyer à Firestore
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const medecin = {
      nom: row[0],
      prenom: row[1],
      specialite: row[2],
      secteur: row[3],
      contact: {
        gsm: row[4],
        telProfessionnel: row[5],
        email: row[9]
      },
      adresse: {
        complete: row[6],
        commune: row[7],
        province: row[8]
      },
      searchTerms: [
        row[0].toLowerCase(),
        row[1].toLowerCase(),
        row[2].toLowerCase()
      ],
      updatedAt: new Date()
    };

    // Envoi à Firestore (à implémenter)
    // ... code d'envoi API REST Firestore
  }
}
```

### 3. Affichage sur le site web

#### Filtres recommandés :
- Par spécialité
- Par commune
- Par secteur (public/privé)
- Recherche par nom

#### Exemple de requête Firestore :

```typescript
// Recherche par spécialité et commune
const medecinsRef = collection(db, 'medecins');
const q = query(
  medecinsRef,
  where('specialite', '==', 'Cardiologie'),
  where('adresse.commune', '==', 'Agadir')
);

const snapshot = await getDocs(q);
```

## 🔒 Règles de sécurité Firestore

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /medecins/{medecinId} {
      // Lecture publique
      allow read: if true;

      // Écriture admin uniquement
      allow write: if request.auth != null
                   && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

## 📝 Notes importantes

1. **Données publiques** : Cette base contient des informations publiques (annuaire médical)
2. **Mise à jour** : Prévoir un processus de mise à jour régulier
3. **Validation** : Vérifier la validité des coordonnées avant publication
4. **RGPD** : S'assurer de la conformité pour les données personnelles

## 🆘 Support

Pour toute question ou modification du script de nettoyage, voir :
- Script : `scripts/clean-medecins-csv.js`
- Rapport détaillé : `cleaned/cleaning_errors.json`

---

**Dernière mise à jour :** 3 janvier 2026
