# Système de Gestion des Ordonnances

## Vue d'ensemble

Ce document explique le système de gestion des ordonnances avec expiration automatique pour éviter la saturation du stockage Firebase.

## Fonctionnalités

### 1. Upload avec URL dans WhatsApp/Email

Lorsqu'un utilisateur soumet une demande de rendez-vous :

- **Formulaire standard** : L'ordonnance est uploadée vers Firebase Storage et l'URL est envoyée par email au laboratoire
- **Option WhatsApp** : L'ordonnance est uploadée et l'URL est incluse dans le message WhatsApp pré-rempli

**Avantages :**
- ✅ Expérience fluide pour l'utilisateur (un seul clic)
- ✅ Fichier sécurisé dans Firebase avec règles de sécurité
- ✅ Traçabilité complète dans Firestore
- ✅ Le laboratoire reçoit directement le lien cliquable

### 2. Expiration Automatique (30 jours)

Chaque ordonnance uploadée est automatiquement supprimée après **30 jours**.

#### Comment ça fonctionne

**a) Lors de l'upload :**
- Un champ `expiresAt` est ajouté au document Firestore
- Date d'expiration = Date actuelle + 30 jours

**b) Nettoyage automatique :**
- Une Cloud Function `cleanupExpiredPrescriptions` s'exécute **tous les jours à 2h00 du matin**
- Elle recherche tous les documents avec `expiresAt <= maintenant`
- Pour chaque ordonnance expirée :
  - Supprime le fichier de Firebase Storage
  - Met à jour le document Firestore (`prescriptionImageUrl = null`)
  - Ajoute des métadonnées : `prescriptionDeletedAt`, `prescriptionDeletedReason`

## Structure des Données

### Document Firestore (`appointmentRequests`)

```json
{
  "name": "Hassan El Allali",
  "phone": "0612345678",
  "email": "hassan@example.com",
  "desiredDate": "15/01/2026",
  "desiredTime": "10:00",
  "comments": "Analyse de sang à jeun",
  "prescriptionImageUrl": "https://firebasestorage.googleapis.com/.../ordonnances/1704567890123-ordonnance.jpg",
  "submittedAt": Timestamp,
  "expiresAt": Date (30 jours après submittedAt),
  "status": "new_appointment_request",
  "type": "lab_appointment"
}
```

### Après expiration (30 jours) :

```json
{
  ...
  "prescriptionImageUrl": null,
  "prescriptionDeletedAt": Timestamp,
  "prescriptionDeletedReason": "expired_30_days"
}
```

## Règles de Sécurité

### Firebase Storage (`storage.rules`)

```javascript
match /ordonnances/{fileName} {
  allow read: if true;  // URLs publiques
  allow write: if request.resource.size < 5 * 1024 * 1024  // Max 5MB
               && (request.resource.contentType.matches('image/jpeg')
                   || request.resource.contentType.matches('image/png')
                   || request.resource.contentType.matches('application/pdf'));
}
```

### Firestore (`firestore.rules`)

```javascript
match /appointmentRequests/{requestId} {
  allow create: if true; // Tout le monde peut créer
  allow read, update, delete: if false; // Admin seulement
}
```

## Cloud Functions

### 1. `sendAppointmentRequestEmail` (Existante)

- **Trigger** : Création d'un nouveau document dans `appointmentRequests`
- **Action** : Envoie un email au laboratoire avec les détails du RDV
- **Gestion de l'ordonnance** : Télécharge le fichier et l'attache à l'email

### 2. `cleanupExpiredPrescriptions` (Nouvelle)

- **Schedule** : Tous les jours à 2h00 (heure de Paris)
- **Action** :
  1. Recherche les documents avec `expiresAt <= now` et `prescriptionImageUrl != null`
  2. Pour chaque document :
     - Supprime le fichier de Storage
     - Met à jour le document Firestore
  3. Log le nombre de fichiers supprimés et d'erreurs

**Code simplifié :**

```typescript
export const cleanupExpiredPrescriptions = onSchedule(
  {
    schedule: "0 2 * * *", // Cron: tous les jours à 2h00
    timeZone: "Europe/Paris",
    region: "europe-southwest1",
  },
  async () => {
    const now = new Date();
    const expiredDocs = await db.collection("appointmentRequests")
      .where("expiresAt", "<=", now)
      .where("prescriptionImageUrl", "!=", null)
      .get();

    for (const doc of expiredDocs.docs) {
      // Supprimer fichier Storage
      await bucket.file(filePath).delete();

      // Mettre à jour Firestore
      await doc.ref.update({
        prescriptionImageUrl: null,
        prescriptionDeletedAt: FieldValue.serverTimestamp(),
        prescriptionDeletedReason: "expired_30_days"
      });
    }
  }
);
```

## Déploiement

### 1. Déployer les règles de sécurité

```bash
firebase deploy --only storage
```

### 2. Déployer les Cloud Functions

```bash
npm run deploy:functions
```

Ou pour tout déployer en une fois :

```bash
npm run deploy
```

## Modification de la Période d'Expiration

Pour changer la durée d'expiration (actuellement 30 jours), modifiez :

### Dans le formulaire ([src/app/[lang]/rendez-vous/page.tsx](src/app/[lang]/rendez-vous/page.tsx))

```typescript
// Ligne 155 et 240
expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 jours
```

Exemples :
- **7 jours** : `7 * 24 * 60 * 60 * 1000`
- **14 jours** : `14 * 24 * 60 * 60 * 1000`
- **60 jours** : `60 * 24 * 60 * 60 * 1000`

## Monitoring

### Vérifier les logs de la Cloud Function

```bash
firebase functions:log --only cleanupExpiredPrescriptions
```

### Vérifier manuellement les ordonnances expirées

```javascript
// Dans la console Firebase (Firestore)
db.collection("appointmentRequests")
  .where("expiresAt", "<=", new Date())
  .where("prescriptionImageUrl", "!=", null)
  .get()
```

## FAQ

**Q : Que se passe-t-il si le laboratoire a besoin de l'ordonnance après 30 jours ?**
R : Le document Firestore reste intact avec toutes les informations du patient. Seul le fichier image/PDF est supprimé. Vous pouvez demander au patient de renvoyer l'ordonnance si nécessaire.

**Q : Peut-on récupérer les fichiers supprimés ?**
R : Non, la suppression est définitive. Firebase Storage ne garde pas d'historique automatique. Si vous avez besoin d'archivage, considérez une sauvegarde externe avant suppression.

**Q : La fonction de nettoyage consomme-t-elle beaucoup de quota ?**
R : Non. Elle s'exécute une fois par jour et traite seulement les documents expirés (généralement quelques dizaines maximum).

**Q : Peut-on désactiver le nettoyage automatique ?**
R : Oui, il suffit de ne pas déployer la fonction `cleanupExpiredPrescriptions` ou de la supprimer via :
```bash
firebase functions:delete cleanupExpiredPrescriptions
```

## Coûts Estimés

Avec environ **50 rendez-vous/mois** avec ordonnances :

- **Storage** : ~500MB/mois → ~0.026$/mois (0.026$/GB)
- **Cloud Function (cleanup)** : 30 exécutions/mois → Gratuit (2M invocations gratuites)
- **Storage operations** : ~50 deletes/mois → Négligeable

**Total estimé** : < 0.05$/mois

## Support

Pour toute question ou problème, consultez :
- [Documentation Firebase Storage](https://firebase.google.com/docs/storage)
- [Documentation Cloud Functions Scheduler](https://firebase.google.com/docs/functions/schedule-functions)
