# ✅ Guide de Déploiement - Résumé des Tests

## 🎯 Ce qui a été testé et fonctionne

### ✅ Build Local
```bash
npm run build
```
**Statut** : ✅ **SUCCÈS** - Compilation Next.js complète sans erreurs

### ✅ Storage Rules
```bash
npx firebase deploy --only storage
```
**Statut** : ✅ **DÉPLOYÉ** - Règles de sécurité actives

### ✅ Firestore Rules & Indexes
```bash
npx firebase deploy --only firestore
```
**Statut** : ✅ **DÉPLOYÉ** - Règles et index composite créés

### ✅ Cloud Functions (Compilation)
```bash
cd functions && npm run build
```
**Statut** : ✅ **SUCCÈS** - TypeScript compilé vers `functions/lib/index.js`

---

## ⚠️ Étape Manquante : Configuration SendGrid

Avant de déployer les functions, vous devez configurer les variables d'environnement SendGrid.

### Option 1 : Configuration via Firebase CLI (Recommandée)

```bash
# Configurer SendGrid API Key
npx firebase functions:secrets:set SENDGRID_API_KEY

# Configurer l'email expéditeur
npx firebase functions:config:set sendgrid.sender="noreply@laboelallali.ma"

# Configurer l'email du laboratoire
npx firebase functions:config:set lab.email="contact@laboelallali.ma"
```

### Option 2 : Fichier .env local (Pour émulateurs uniquement)

Créez `functions/.env` :
```bash
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxx
SENDGRID_SENDER_EMAIL=noreply@laboelallali.ma
LAB_EMAIL=contact@laboelallali.ma
```

**⚠️ Important** : Ne committez JAMAIS le fichier `.env` (déjà dans `.gitignore`)

---

## 🚀 Déploiement Complet

### Étape 1 : Vérifier que tout est prêt

```bash
# Build local
npm run build

# Build functions
cd functions && npm run build && cd ..
```

### Étape 2 : Configurer les variables SendGrid

Utilisez l'Option 1 ci-dessus pour configurer vos clés API.

**Où obtenir la clé SendGrid ?**
1. Allez sur https://sendgrid.com
2. Settings → API Keys → Create API Key
3. Permissions : Full Access (ou au moins Mail Send)
4. Copiez la clé (elle ne sera affichée qu'une fois !)

### Étape 3 : Déployer les Functions

```bash
npx firebase deploy --only functions
```

**Temps estimé** : 3-5 minutes

**Ce qui sera déployé** :
- `nextServer` - Serveur Next.js (déjà existant)
- `sendAppointmentRequestEmail` - Envoi email lors d'un nouveau RDV
- `cleanupExpiredPrescriptions` - Nettoyage automatique quotidien (NOUVEAU)

### Étape 4 : Déployer le Hosting

```bash
npm run deploy:hosting
```

OU tout déployer en une fois :

```bash
npm run deploy
```

---

## 📋 Checklist Post-Déploiement

### 1. Vérifier que les 3 fonctions sont déployées

```bash
npx firebase functions:list
```

Vous devriez voir :
```
cleanupExpiredPrescriptions (schedule: 0 2 * * *)
sendAppointmentRequestEmail (firestore)
nextServer (https)
```

### 2. Tester l'upload d'ordonnance

1. Allez sur https://votre-site.com/fr/rendez-vous
2. Remplissez le formulaire avec une ordonnance
3. Cliquez sur "Envoyer ma demande de RDV"
4. Vérifiez :
   - ✅ Toast de succès apparaît
   - ✅ Email reçu au lab avec ordonnance en pièce jointe
   - ✅ Firestore : document créé avec `expiresAt` = 30 jours
   - ✅ Storage : fichier présent dans `ordonnances/`

### 3. Tester WhatsApp avec URL

1. Remplissez le formulaire avec ordonnance
2. Cliquez sur "Demander RDV par WhatsApp"
3. Vérifiez :
   - ✅ WhatsApp s'ouvre avec message pré-rempli
   - ✅ Le message contient l'URL de l'ordonnance
   - ✅ L'URL est cliquable et mène à l'ordonnance

### 4. Vérifier les logs de la fonction de nettoyage

```bash
npx firebase functions:log --only cleanupExpiredPrescriptions
```

Après la première exécution (le lendemain à 2h00), vous devriez voir :
```
Starting cleanup of expired prescriptions
Found 0 expired prescriptions to clean up
Cleanup completed. Deleted: 0, Errors: 0
```

---

## 💰 Vérification des Coûts

### Avec le Free Tier Firebase (Spark Plan)

Votre usage actuel reste **100% GRATUIT** :

| Service | Quota Gratuit | Votre Usage | Statut |
|---------|---------------|-------------|--------|
| Cloud Storage | 5 GB | ~0.5 GB/mois | ✅ Gratuit |
| Functions Invocations | 2M/mois | ~1,500/mois | ✅ Gratuit |
| Firestore Reads | 50K/jour | ~100/jour | ✅ Gratuit |
| Firestore Writes | 20K/jour | ~50/jour | ✅ Gratuit |

**Coût mensuel estimé** : **0€**

Vous ne paierez que si vous dépassez :
- Plus de 2 millions d'invocations functions/mois
- Plus de 5 GB de stockage simultané

---

## 🧪 Tester la Fonction de Nettoyage Manuellement

### Créer un test

1. Allez dans Firebase Console → Firestore
2. Créez un document dans `appointmentRequests` :

```json
{
  "name": "Test Cleanup",
  "phone": "0600000000",
  "desiredDate": "01/01/2026",
  "desiredTime": "10:00",
  "prescriptionImageUrl": "https://firebasestorage.googleapis.com/.../test.jpg",
  "expiresAt": [Date d'hier], // ⚠️ Important : date PASSÉE
  "status": "test",
  "type": "lab_appointment"
}
```

3. Uploadez un fichier test dans Storage → `ordonnances/test.jpg`

4. Invoquez manuellement la fonction :

```bash
npx firebase functions:call cleanupExpiredPrescriptions --region=europe-southwest1
```

5. Vérifiez :
   - ✅ Le fichier `test.jpg` est supprimé de Storage
   - ✅ Le document a `prescriptionImageUrl = null`
   - ✅ Le document a `prescriptionDeletedAt` et `prescriptionDeletedReason`

---

## 🔧 Dépannage

### Erreur : "Missing environment variables"

```bash
# Reconfigurer SendGrid
npx firebase functions:secrets:set SENDGRID_API_KEY
npx firebase functions:config:set sendgrid.sender="votre@email.com"
npx firebase functions:config:set lab.email="contact@labo.com"
```

### Erreur : "Missing index"

Cliquez sur le lien dans l'erreur ou :

```bash
npx firebase deploy --only firestore:indexes
```

Attendez 2-3 minutes que l'index soit construit.

### La fonction de nettoyage ne s'exécute pas

1. Vérifiez dans Console Firebase → Functions → cleanupExpiredPrescriptions
2. Regardez si Cloud Scheduler est activé
3. Vérifiez les logs :

```bash
npx firebase functions:log --only cleanupExpiredPrescriptions --limit 50
```

---

## 📝 Commandes Récapitulatives

### Déploiement complet (après configuration SendGrid) :

```bash
# 1. Build tout
npm run build
cd functions && npm run build && cd ..

# 2. Déployer tout
npm run deploy
```

### Déploiement par parties :

```bash
# Storage + Firestore (déjà fait ✅)
npx firebase deploy --only storage,firestore

# Functions (après config SendGrid)
npx firebase deploy --only functions

# Hosting
npx firebase deploy --only hosting
```

---

## ✅ Résumé de l'État Actuel

| Composant | Statut | Action Nécessaire |
|-----------|--------|-------------------|
| Code Frontend | ✅ Modifié | Redéployer hosting |
| Storage Rules | ✅ Déployé | Aucune |
| Firestore Rules | ✅ Déployé | Aucune |
| Firestore Indexes | ✅ Déployé | Aucune |
| Functions Code | ✅ Compilé | Configurer SendGrid puis déployer |
| Traductions | ✅ Modifiées | Redéployer hosting |

---

## 🎉 Prochaine Étape

**Pour finaliser le déploiement :**

1. Obtenez votre clé API SendGrid
2. Configurez les variables d'environnement :
   ```bash
   npx firebase functions:secrets:set SENDGRID_API_KEY
   ```
3. Déployez les functions :
   ```bash
   npx firebase deploy --only functions
   ```
4. Déployez le hosting :
   ```bash
   npm run deploy:hosting
   ```

**Ou lancez tout en une fois** (si SendGrid configuré) :
```bash
npm run deploy
```

Besoin d'aide pour configurer SendGrid ?
