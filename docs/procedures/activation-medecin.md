# Activer l'accès « Mes patients » d'un médecin

**Pour :** Dr Aziz, ou un administrateur du laboratoire.
**Durée :** environ 15 minutes par médecin, plus l'attente de l'envoi Qalam (5 minutes).
**Résultat :** le médecin voit dans l'application, rubrique « Mes patients », les bilans **qu'il a lui-même prescrits**, et seulement ceux-là.

> ⚠ **Avant le tout premier médecin :** Aziz relit et valide le texte « Accès des médecins prescripteurs » de la page Confidentialité de l'application, et l'engagement que le médecin accepte dans l'application (étape 4, texte en fin de document).

---

## Étape 1 — Qalam : activer le prescripteur

1. Ouvrir la **fiche Prescripteur** du médecin et noter son **code** (exemple : `MOUSTZOU`).
2. Mettre **« Serveur Résultat » sur Oui**. L'identifiant est le code du médecin.
3. Choisir un **mot de passe long** (12 caractères ou plus). Il sert à l'ancien portail cyberlab.ma, pas à l'application : **ne pas le donner au médecin**.
4. Enregistrer.

## Étape 2 — Qalam : envoyer ses dossiers déjà faits

Activer un médecin n'envoie **que ses futurs dossiers**. Chaque ancien dossier qu'il doit voir est à renvoyer à la main :

1. Ouvrir le dossier, **retirer le médecin prescripteur**, enregistrer.
2. **Remettre le médecin**, enregistrer (ou « régénérer » le dossier).
3. Recommencer pour chacun de ses dossiers récents. L'application n'affiche que ses **50 bilans les plus récents**.
4. Dans l'écran **« Serveur Résultat Prescripteur »** :
   - regarder la file **« Attentes »** ;
   - lancer l'envoi s'il ne part pas tout seul (**« Envois »**) ;
   - vérifier que la file **« Erreurs »** est vide.
5. Attendre **5 minutes** après l'envoi. C'est le délai avant que le serveur de résultats voie les dossiers.

## Étape 3 — Son compte dans l'application

**Il a déjà un compte** (il est patient du labo, ou s'est déjà inscrit) : rien à lui demander, passez à l'étape 5.

**Il n'a pas encore de compte** : envoyez-lui le lien d'invitation.
1. Admin → onglet **« Médecins »** → carte **« Inviter un médecin »** (en bas de l'onglet).
2. Tapez son téléphone (facultatif), puis **« Envoyer par WhatsApp »** : le message contient le lien et les trois étapes. Ou **« Copier le lien »** pour l'envoyer autrement.
3. Le médecin ouvre le lien, se connecte avec **son compte Google** ou crée son compte (e-mail et mot de passe), complète son profil (nom, date de naissance, téléphone), coche **l'engagement de confidentialité**, puis touche **« Demander mon accès médecin »**. Un médecin qui n'a jamais fait d'analyse au labo peut le faire aussi.
4. Sa demande arrive **en haut de l'onglet « Médecins »** (badge sur l'onglet), et le labo reçoit un e-mail.
5. Le même lien ouvrira ses patients une fois l'accès activé : c'est aussi son marque-page.

- **S'il est aussi patient du laboratoire**, il garde un seul compte. Sous « Résultats », il trouve deux entrées :
  - « Moi et ma famille » : ses propres résultats et ceux de ses proches ;
  - « Mes patients » : les bilans qu'il a prescrits.

## Étape 4 — L'engagement de confidentialité du médecin

**Rien à faire pour le laboratoire : il est pris dans l'application.**
- S'il a demandé son accès par le lien d'invitation, il a coché l'engagement sur son formulaire.
- S'il a été activé directement, l'application le lui présente **une fois**, avant sa première consultation : il ne voit aucun patient tant qu'il ne l'a pas accepté.

La date d'acceptation est enregistrée sur son compte. Elle apparaît dans l'onglet « Médecins » et sur la carte « Accès médecin » de sa fiche (« Engagement de confidentialité accepté le … »).

## Étape 5 — Activer dans l'espace admin

Il faut un compte **administrateur ou propriétaire** : un stagiaire voit la carte mais ne peut pas activer.

1. **S'il a fait la demande depuis le lien** : onglet « Médecins » → sa demande, en haut → **« Ouvrir sa fiche et activer »**. Sa fiche s'ouvre, carte « Accès médecin » déjà remplie avec le nom de ses ordonnances.
   **Sinon** : onglet **« Patients »**, cherchez-le par son nom, son e-mail ou son téléphone, puis ouvrez sa fiche.
2. Vérifiez que c'est bien lui (nom, téléphone).
3. Remplir la carte **« Accès médecin — « Mes patients » »** :
   - **Code du médecin dans Qalam** : le code de l'étape 1 ;
   - **Type** : Médecin (« Correspondant » est réservé aux cliniques) ;
   - **Nom affiché** : par exemple « Dr Moustadraf Zouhair ».
4. Cliquer **« Vérifier le code »**. L'application interroge le serveur du laboratoire et affiche le nombre de bilans et de patients, jamais de noms.
   - **« Le serveur connaît ce code : N bilans, M patients »** : tout va bien.
   - **« … ne connaît encore aucun dossier pour ce code »** : l'envoi de l'étape 2 n'est pas encore arrivé. Attendre 5 minutes et vérifier à nouveau. La case « Activer quand même » existe, mais le médecin verrait alors une page vide.
   - **« Ce code est déjà rattaché à : … »** : le même médecin est déjà sur un autre compte (par exemple celui de sa secrétaire). Cocher la confirmation **seulement si le laboratoire l'accepte**.
5. Cliquer **« Activer l'accès médecin »**. Le médecin reçoit un e-mail « Votre accès médecin est actif ».

## Étape 6 — Vérifier avec le médecin

- S'il a été activé directement, l'application lui présente d'abord l'engagement de confidentialité (une seule fois).
- Il ouvre **« Mes patients »** par l'une de ces entrées :
  - le menu « Résultats » → « Mes patients » ;
  - le sélecteur « Moi et ma famille | Mes patients » en haut de la page Résultats.
- Il voit la liste de ses patients et peut chercher un nom.
- En ouvrant un patient, son dernier bilan s'affiche. Les anciens s'ouvrent d'un clic.
- **Il ne voit pas un patient ?** Deux raisons possibles :
  - le dossier n'a pas été renvoyé par Qalam (étape 2) ;
  - le dossier a été prescrit par un autre médecin : le serveur ne le montre qu'à son prescripteur, c'est voulu.
- **Deux patients qui portent exactement le même nom** apparaissent sur une seule ligne. La date et le numéro de dossier de chaque bilan permettent de les distinguer.

## Suivre les médecins

- **Onglet « Médecins »** : tous les médecins qui ont accès, sans les chercher. Pour chacun : sa dernière visite, ses jours de visite et ses bilans ouverts ce mois-ci, son engagement, et trois boutons — **« Ouvrir sa fiche »** (pour modifier le code ou le nom affiché), **« WhatsApp »** (lui renvoyer le lien de son espace), **« Retirer l'accès »**.
- **Tableau de bord → « Les médecins »** : la même utilisation, médecin par médecin. Les comptes de l'équipe (vos tests) n'y sont comptés que si la case « Inclure les comptes de l'équipe » est cochée.
- Seuls des **nombres et des dates** sont enregistrés : jamais quels patients ni quels bilans le médecin a ouverts.

## Retirer l'accès

**Admin → onglet « Médecins » → sa carte → « Retirer l'accès »** (deux clics), ou **fiche du médecin → carte « Accès médecin » → « Retirer l'accès »**. Le retrait est immédiat.

Pour arrêter aussi les envois vers le serveur, remettre « Serveur Résultat » sur **Non** dans Qalam.

## À ne pas faire

- **Ne pas remettre au médecin la lettre Qalam** (identifiant et mot de passe cyberlab.ma). Il ne s'en sert pas, et ce portail n'est pas joignable depuis internet.
- **Ne jamais saisir le code d'un médecin comme « numéro de dossier patient »** d'un compte. L'application le refuse. Si ça arrivait, il verrait les résultats de ses patients présentés comme les siens.

---

## L'engagement, tel que le médecin le lit dans l'application *(à valider par Aziz)*

**Mon engagement de confidentialité**

En utilisant cet accès, je m'engage à :
- consulter ces résultats uniquement pour soigner mes patients ;
- ne donner mes identifiants à personne, et ne laisser personne utiliser mon compte ;
- respecter le secret médical : ne diffuser aucun résultat hors du cadre du soin ;
- prévenir le laboratoire sans délai si mon téléphone est perdu ou volé, ou si j'arrête mon activité.

Je sais que je ne vois que les bilans que j'ai moi-même prescrits, que le laboratoire enregistre la date et le nombre de mes consultations (jamais lesquelles), et qu'il peut retirer cet accès à tout moment.

☐ *Je suis médecin et j'accepte cet engagement.* (sur le formulaire de demande)
☐ *J'accepte cet engagement.* (à la première visite d'un médecin activé directement)

Pour modifier ce texte, le demander à Hassan : chaque médecin devra alors l'accepter à nouveau.
