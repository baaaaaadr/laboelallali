# Brouillons d'e-mail — dossier 130726314 sans PDF (21/07/2026)

Deux brouillons ont été créés dans Gmail (non envoyés) :

1. **Si Hassan (labo)** — `communication.labo.elallali@gmail.com` : demande de test
   terrain, à envoyer **en premier**. Objet : « Petit test à faire : les PDF des
   bilans récents remontent-ils bien dans l'app ? ». Il lui demande 4–5 identifiants
   patients de juillet 2026 (ou de tester lui-même via l'onglet « Tester » de
   `/admin`), et de vérifier dans Qalam si le résultat du dossier 130726314 est
   imprimable. Objectif : savoir si l'incident est isolé ou s'il touche tous les
   bilans depuis début juillet.
2. **Si Brahim (éditeur du serveur)** — `computel.maroc@gmail.com` : le rapport
   technique ci-dessous, à envoyer une fois la réponse de Si Hassan reçue (ou tout de
   suite si on ne veut pas attendre).

---

## Brouillon Si Brahim — dossier sans PDF (à relire avant envoi)

**Objet :** Dossier 130726314 — l'API renvoie le dossier mais sans PDF

---

Bonjour Si Brahim,

J'espère que tu vas bien. Un point technique sur l'API de résultats, avec un cas
précis que j'ai isolé.

**Le symptôme.** Pour le patient `requester_id = 232527`, l'API renvoie bien son
dossier, mais avec un `pdf_base64` **vide** :

```
dossier_id      : 130726314
date_dossier    : 2026-07-13T08:42:19Z
etat            : Final
analyses_summary: H NFS^T GRS^C GLY^C HBA1^C CR^C ACU^C CHOL^C TRIG^EZASAT^EZALAT^S HVC^S HBV^S HIV
pdf_base64      : ""      ← chaîne vide
```

Réponse HTTP 200, corps complet de 290 octets (donc rien n'est tronqué en chemin).

**Ce que j'ai vérifié de mon côté**, en interrogeant le serveur directement (script
autonome, hors application, même signature HMAC) :

1. Le PDF est vide dans **les cinq modes** : `include_pdf:"none"`, `"latest"`,
   `"all"`, sans `include_pdf` (mode historique), et en requête ciblée
   `{"type":"patient","requester_id":"232527","dossier_id":"130726314"}`.
2. Ce n'est pas un problème général du serveur : **25 dossiers** d'autres patients,
   de août 2021 à juin 2026, renvoient tous un PDF parfaitement valide (120 Ko à
   920 Ko, entête `%PDF-` et marqueur de fin `%%EOF` présents). Le témoin habituel
   7587 fonctionne toujours.
3. Ce n'est pas non plus un problème d'application : le dossier remonte avec sa date,
   son état et ses 13 analyses — seul le document manque.

**Ma question.** Peux-tu regarder, côté réplique CyberLab, si le fichier PDF de ce
dossier est bien présent ? Autrement dit : dans quel cas un dossier peut-il être à
l'état `Final` sans fichier PDF associé (résultat pas encore imprimé/validé,
génération différée, fichier non copié vers la réplique, sérologies sous-traitées
qui retardent l'édition du document…) ?

**Un point que je ne peux pas trancher seul.** Dans mon échantillon, aucun autre
dossier n'est postérieur au 17/06/2026 — ce dossier du 13/07 est le seul récent que
je puisse tester. Je ne peux donc pas exclure que le problème touche **tous** les
dossiers depuis début juillet. Si tu peux vérifier côté serveur qu'un dossier
quelconque de juillet 2026 remonte bien avec son PDF, cela lèverait le doute
immédiatement.

**Deux suggestions, si cela te paraît simple à faire** (rien d'urgent) :

- Ajouter un champ booléen `pdf_disponible` (ou un motif court) dans la réponse,
  pour qu'on puisse afficher au patient « votre document sera disponible sous peu »
  plutôt qu'un message vague — et pour que le personnel à l'accueil sache dire quoi
  au patient.
- Le `429` (limite de débit) se déclenche à partir d'environ 25 requêtes rapprochées.
  C'est très bien pour la sécurité ; je le signale juste pour mémoire, mes scripts de
  diagnostic en tiennent compte.

Merci d'avance, et dis-moi si tu veux que je te renvoie une trace précise (horodatage
d'appel) pour retrouver la requête dans tes journaux.

Bien à toi,
Hassan
