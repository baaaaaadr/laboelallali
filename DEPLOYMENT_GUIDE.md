# Guide de Déploiement - Système d'Ordonnances avec Expiration

## 🚀 Checklist de Déploiement

Suivez ces étapes dans l'ordre pour déployer le nouveau système d'ordonnances.

---

## ✅ Étape 1 : Vérifier les Modifications

Les fichiers suivants ont été modifiés :

### Code Frontend
- ✅ `src/app/[lang]/rendez-vous/page.tsx` - Upload avec URL dans WhatsApp et Email

### Traductions
- ✅ `public/locales/fr/appointment.json` - Nouvelles clés de traduction
- ✅ `public/locales/ar/appointment.json` - Nouvelles clés de traduction

### Configuration Firebase
- ✅ `storage.rules` - Règles de sécurité pour les uploads
- ✅ `firestore.indexes.json` - Index pour la requête de nettoyage

### Cloud Functions
- ✅ `functions/src/index.ts` - Nouvelle fonction `cleanupExpiredPrescriptions`

---

## 📋 Étape 2 : Tester Localement (Optionnel mais Recommandé)

### A. Tester le Frontend

```bash
npm run dev
```

Puis testez :
1. Accédez à http://localhost:3000/fr/rendez-vous
2. Remplissez le formulaire et uploadez une ordonnance
3. Vérifiez que le fichier s'upload correctement
4. Testez les deux boutons (Email et WhatsApp)

### B. Tester les Cloud Functions (avec Emulateur)

Si vous voulez tester localement avec les émulateurs Firebase :

```bash
firebase emulators:start
```

⚠️ **Note** : Les émulateurs ne persistent pas les données. C'est juste pour tester la logique.

---

## 🔥 Étape 3 : Déployer les Règles de Sécurité

### Déployer Storage Rules

```bash
firebase deploy --only storage
```

**Attendu** :
```
✔ Deploy complete!

Storage rules:
✔ storage.rules
```

### Déployer Firestore Rules & Indexes

```bash
firebase deploy --only firestore
```

**Attendu** :
```
✔ Deploy complete!

Firestore rules:
✔ firestore.rules

Firestore indexes:
✔ firestore.indexes.json
```

---

## ☁️ Étape 4 : Déployer les Cloud Functions

### Option A : Déployer uniquement les Functions

```bash
npm run deploy:functions
```

ou

```bash
firebase deploy --only functions
```

**Attendu** :
```
✔ functions[sendAppointmentRequestEmail] Successful update
✔ functions[cleanupExpiredPrescriptions] Successful create
✔ functions[nextServer] Successful update

✔ Deploy complete!
```

### Option B : Déployer tout (Hosting + Functions)

```bash
npm run deploy
```

**Temps estimé** : 5-10 minutes

---

## 🔍 Étape 5 : Vérifier le Déploiement

### A. Vérifier que les Functions sont déployées

```bash
firebase functions:list
```

**Vous devriez voir** :
```
cleanupExpiredPrescriptions (schedule)
sendAppointmentRequestEmail (firestore)
nextServer (https)
```

### B. Vérifier le schedule de la fonction de nettoyage

1. Allez dans la [Console Firebase](https://console.firebase.google.com)
2. Allez dans **Functions**
3. Cherchez `cleanupExpiredPrescriptions`
4. Vérifiez que le **Trigger** est `Cloud Scheduler` avec `0 2 * * *`

### C. Tester l'upload en production

1. Accédez à votre site en production (https://[votre-domaine])
2. Allez sur `/fr/rendez-vous`
3. Remplissez et soumettez un formulaire avec ordonnance
4. Vérifiez dans Firebase Console :
   - **Storage** : Dossier `ordonnances/` contient le fichier
   - **Firestore** : Collection `appointmentRequests` a un nouveau document avec `expiresAt`

---

## 🧪 Étape 6 : Tester la Fonction de Nettoyage

### Option A : Attendre 24h

La fonction s'exécutera automatiquement tous les jours à 2h00 du matin.

### Option B : Tester manuellement (Recommandé)

Pour tester immédiatement sans attendre :

#### 1. Créer un document de test avec expiration passée

Dans la Console Firebase (Firestore) :

```javascript
// Créer un document dans appointmentRequests avec :
{
  name: "Test Cleanup",
  phone: "0600000000",
  desiredDate: "01/01/2026",
  desiredTime: "10:00",
  prescriptionImageUrl: "https://firebasestorage.googleapis.com/.../ordonnances/test.jpg",
  submittedAt: [timestamp actuel],
  expiresAt: [date passée, ex: hier],
  status: "test",
  type: "lab_appointment"
}
```

#### 2. Créer un fichier test dans Storage

1. Allez dans **Storage** → `ordonnances/`
2. Uploadez un fichier nommé `test.jpg`

#### 3. Invoquer manuellement la fonction

```bash
firebase functions:shell
```

Puis dans le shell :

```javascript
cleanupExpiredPrescriptions()
```

**OU** directement via gcloud CLI :

```bash
gcloud functions call cleanupExpiredPrescriptions --region=europe-southwest1
```

#### 4. Vérifier les résultats

- **Storage** : Le fichier `test.jpg` devrait être supprimé
- **Firestore** : Le document devrait avoir :
  ```json
  {
    ...
    "prescriptionImageUrl": null,
    "prescriptionDeletedAt": [timestamp],
    "prescriptionDeletedReason": "expired_30_days"
  }
  ```

---

## 📊 Étape 7 : Monitoring

### Vérifier les logs de la fonction

```bash
firebase functions:log --only cleanupExpiredPrescriptions
```

ou dans la Console Firebase → Functions → cleanupExpiredPrescriptions → Logs

**Vous devriez voir** (après la première exécution) :
```
Starting cleanup of expired prescriptions
Found 0 expired prescriptions to clean up
Cleanup completed. Deleted: 0, Errors: 0
```

### Configurer des alertes (Optionnel)

1. Allez dans **Monitoring** dans Firebase Console
2. Créez une alerte si la fonction `cleanupExpiredPrescriptions` échoue

---

## 🐛 Résolution de Problèmes

### Erreur : "Missing index"

Si vous voyez cette erreur dans les logs :

```
The query requires an index
```

**Solution** :
1. Cliquez sur le lien dans l'erreur (il vous amène à la console Firebase)
2. Créez l'index automatiquement
3. Attendez 2-3 minutes que l'index soit construit
4. Ré-exécutez la fonction

**OU** déployez les indexes manuellement :

```bash
firebase deploy --only firestore:indexes
```

### Erreur : "Permission denied" dans Storage

**Solution** : Vérifiez que `storage.rules` est bien déployé :

```bash
firebase deploy --only storage
```

### La fonction de nettoyage ne s'exécute pas

**Vérifiez** :

1. Cloud Scheduler est activé dans votre projet Google Cloud
2. La région est correcte (`europe-southwest1`)
3. Les logs pour voir si des erreurs sont enregistrées

```bash
firebase functions:log --only cleanupExpiredPrescriptions --limit 50
```

---

## 💰 Coûts Firebase

Avec le nouveau système :

| Service | Usage Estimé | Coût/Mois |
|---------|--------------|-----------|
| Storage (5GB) | 50 ordonnances × 100KB | ~$0.13 |
| Cloud Functions | 30 exécutions/mois | Gratuit |
| Storage Operations | ~50 deletes/mois | Négligeable |
| Firestore Reads | ~50/mois (cleanup) | Négligeable |

**Total estimé** : < $0.20/mois

---

## 📝 Checklist Finale

Avant de considérer le déploiement terminé :

- [ ] Storage rules déployées et testées
- [ ] Firestore rules & indexes déployées
- [ ] Cloud Functions déployées (3 fonctions visibles)
- [ ] Test d'upload réussi en production
- [ ] Document test de nettoyage créé et supprimé avec succès
- [ ] Logs de la fonction de nettoyage vérifiés (pas d'erreurs)
- [ ] Email de test reçu avec ordonnance en pièce jointe
- [ ] WhatsApp testé avec URL de l'ordonnance dans le message

---

## 🎉 Déploiement Terminé !

Votre système d'ordonnances avec expiration automatique est maintenant opérationnel.

**Prochaines étapes** :
- Surveillez les logs pendant les premiers jours
- Vérifiez que les ordonnances expirent bien après 30 jours
- Consultez le fichier `PRESCRIPTION_CLEANUP.md` pour plus de détails techniques

**Support** :
- Documentation Firebase : https://firebase.google.com/docs
- Logs en temps réel : Console Firebase → Functions → Logs
