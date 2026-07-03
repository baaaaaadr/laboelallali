# **PROPOSITION TECHNIQUE**

## **Intégration des résultats CyberLab dans l'application Labo El Allali**

*Architecture sécurisée, simple et conforme aux exigences de protection des données médicales*

|  |  |
| ----- | ----- |
| **Document destiné à** | Dr Aziz EL ALLALI — Si Brahim (éditeur Qalam LIS / CyberLab) |
| **Auteur** | Hassan EL ALLALI — Labo El Allali PWA |
| **Date** | Mai 2026 |
| **Version** | 2.0 — Reverse proxy \+ mTLS |

---

## **1\. Synthèse exécutive**

L'objectif est de permettre aux patients du laboratoire de consulter leurs résultats d'analyses directement depuis l'application Labo El Allali, sans avoir à mémoriser ni gérer plusieurs identifiants, et sans créer de nouveau risque de fuite de données.

La solution proposée repose sur quatre principes :

* Aucun résultat médical n'est jamais stocké sur les serveurs de l'application. Tout reste dans les serveurs du laboratoire au Maroc.  
* Aucun mot de passe patient pour accéder aux résultats n'est généré ni stocké, ni côté laboratoire ni côté application. L'authentification repose sur un identifiant patient interne et une clé d'application.  
* Quatre couches de sécurité indépendantes protègent chaque requête entre l'application et le serveur du laboratoire.  
* La conformité CNDP est assurée via consentement éclairé du patient, politique de confidentialité dédiée et déclaration auprès de la CNDP.

La mise en place demande quelques heures de travail côté serveur (Si Brahim) et une dizaine de jours côté application (Hassan). L'infrastructure additionnelle est gratuite (Cloudflare, Google Secret Manager dans les quotas Firebase actuels).

---

## **2\. Contexte et nouveau départ**

Le portail `cyberlab.ma`, aujourd'hui très peu utilisé, est abandonné : plus personne ne s'en sert, et il n'est pas géré par Si Brahim. Le passage à l'application Labo El Allali est l'occasion d'un nouveau départ : toute l'expérience patient est désormais concentrée dans une seule application moderne, installée sur le smartphone.

**Conséquences directes pour le laboratoire :**

* Plus aucun mot de passe n'est généré pour les patients. Plus de fiche papier imprimée. Plus de patients qui reviennent à l'accueil parce qu'ils ont perdu ou oublié leur mot de passe.  
* Le patient n'a qu'un seul jeu d'identifiants : ceux de l'application Labo El Allali, qu'il définit lui-même.  
* Le laboratoire n'a plus rien à gérer en matière de mots de passe patient — ni les créer, ni les protéger, ni les réinitialiser, ni gérer leur expiration.  
* Le système Qalam LIS continue de fonctionner exactement comme aujourd'hui en interne. Aucun changement côté production de résultats.

L'identifiant patient interne (`patient_id`, généré par Qalam comme aujourd'hui) reste le pivot technique du dispositif. Il est stocké dans l'application au moment de la création du compte patient par le stagiaire, et c'est lui qui sera utilisé pour aller chercher les résultats sur le serveur du laboratoire — sans jamais transiter par un mot de passe.

---

## **3\. Architecture proposée**

### **3.1 Vue d'ensemble**

L'application agit comme un pont sécurisé entre le patient et le serveur de résultats du laboratoire. À aucun moment l'application ne devient un dépôt de données médicales : elle récupère les résultats à la demande, les affiche à l'écran, puis les oublie.

  PATIENT (smartphone)  
       |  
       | 1\. Connexion à son compte application  
       v  
   APPLICATION LABO EL ALLALI  (Firebase Hosting \+ Auth)  
       |  
       | 2\. Appel d'une fonction Cloud  fetchResults(type, requester\_id)  
       v  
   CLOUD FUNCTION  (sans persistance, aucun log de données)  
       |  
       | 3\. Requête HTTPS signée (clé \+ horodatage \+ nonce)  
       v  
   CLOUDFLARE  (reverse proxy — transmet la requête au serveur)  
       |  
       | 4\. Connexion vers le serveur (IP Cloudflare autorisée \+ mTLS)  
       v  
   SERVEUR LINUX AU LABORATOIRE  (Si Brahim)  
       |  
       | 5\. Vérifie clé \+ signature \+ horodatage \+ nonce \+ type/droits  
       | 6\. Lit la réplique CyberLab locale  
       v  
   RÉPONSE  →  résultats remontés jusqu'au navigateur du patient

Le serveur Linux du laboratoire reste la source unique des résultats. Il n'est joignable qu'à travers Cloudflare, et uniquement par des requêtes authentifiées cryptographiquement (voir section 4).

---

## **4\. Les quatre couches de sécurité**

Chaque requête de l'application vers le serveur du laboratoire doit franchir quatre vérifications indépendantes. Même si une couche est compromise, les trois autres tiennent.

### **Couche 1 — Transport chiffré (HTTPS / TLS 1.2+)**

Toutes les communications utilisent HTTPS avec TLS 1.2 ou supérieur. Aucune donnée n'est jamais transmise en clair sur le réseau, y compris l'identifiant patient. Le certificat est géré automatiquement par Cloudflare (renouvellement transparent, pas de manipulation manuelle).

### **Couche 2 — Reverse proxy Cloudflare avec filtrage IP et authentification mutuelle (mTLS)**

Le nom de domaine de l'API est placé sous la gestion de Cloudflare. Toutes les requêtes de l'application passent d'abord par Cloudflare, qui les transmet ensuite au serveur de résultats du laboratoire (principe du reverse proxy). Le pare-feu du serveur est configuré pour n'accepter les connexions **que** depuis les plages d'adresses de Cloudflare : toute tentative de connexion directe depuis une autre source est bloquée.

Pour renforcer ce filtrage, on active l'option **Authenticated Origin Pulls (mTLS)** de Cloudflare. Le serveur exige alors un certificat prouvant cryptographiquement que la requête a bien transité par notre configuration Cloudflare — et pas seulement qu'elle provient d'une adresse appartenant au réseau Cloudflare (ces adresses étant publiques et partagées entre tous les clients de Cloudflare). On passe ainsi d'un contrôle « de localisation réseau » à un contrôle « d'identité prouvée ».

Cette approche remplace l'idée initiale du tunnel sortant. Les deux sont valables et largement utilisées dans le secteur de la santé. Le reverse proxy a été retenu parce qu'il ne nécessite **aucun logiciel tiers installé sur le serveur médical** : seule une configuration du pare-feu et du certificat est requise, ce qui laisse l'administrateur du serveur en pleine maîtrise de sa machine.

### **Couche 3 — Clé d'application secrète**

Chaque requête envoyée au serveur contient une clé d'application unique à 64 caractères aléatoires. Le serveur rejette toute requête ne présentant pas cette clé. Cette clé est stockée exclusivement dans Google Secret Manager, un coffre-fort géré par Google :

* La clé n'apparaît jamais dans le code source de l'application.  
* Elle n'est pas embarquée dans l'application mobile (impossible à extraire par un utilisateur).  
* Elle n'est pas présente sur les machines des développeurs.  
* Seules les fonctions Cloud autorisées peuvent la lire au moment de l'exécution.  
* Toute lecture est journalisée dans les logs Google Cloud.

En cas de fuite suspectée, la clé peut être révoquée et remplacée en moins de cinq minutes, sans redéploiement de l'application.

### **Couche 4 — Signature horodatée (protection contre le rejeu)**

Le « rejeu » désigne une attaque où quelqu'un capture une requête légitime (par exemple en s'introduisant dans un journal de logs réseau) et tente de la rejouer plus tard pour obtenir une réponse à sa place. Pour neutraliser ce risque, chaque requête transporte :

* Un horodatage Unix (`X-Timestamp`) : le serveur rejette toute requête âgée de plus de 120 secondes.  
* Un identifiant unique de requête (`X-Nonce`) : le serveur mémorise les nonces consommés et rejette tout doublon.  
* Une signature HMAC-SHA256 (`X-Signature`) calculée sur le timestamp \+ nonce \+ corps de la requête, avec un secret partagé.

Concrètement : même si quelqu'un capture une requête légitime, il ne peut pas la réutiliser après 120 secondes, et il ne peut pas non plus en fabriquer une nouvelle sans connaître le secret HMAC.

**Récapitulatif :**

| \# | Couche | Protège contre |
| ----- | ----- | ----- |
| 1 | HTTPS / TLS | Écoute réseau, interception de données |
| 2 | Reverse proxy Cloudflare \+ mTLS | Accès direct au serveur, scan de ports, usurpation de l'origine |
| 3 | Clé d'application en coffre Google | Requêtes non autorisées, fuite par code source |
| 4 | Signature \+ horodatage | Rejeu de requêtes, falsification de contenu |

---

## **5\. Comment le reverse proxy résout le problème de l'IP non fixe de Firebase**

Le filtrage par adresse IP est une bonne pratique, mais il se heurte à une contrainte technique précise dans notre cas.

### **5.1 — Firebase n'a pas d'adresse IP fixe**

Les fonctions Cloud Firebase (le mécanisme utilisé côté application pour appeler le serveur) s'exécutent sur un parc de serveurs Google qui change régulièrement d'adresse IP. Il est donc impossible de dire au serveur du laboratoire « n'accepte que l'IP de l'application » : cette IP varie en permanence. Obtenir une IP fixe côté Firebase nécessiterait un service additionnel payant (VPC Connector \+ Cloud NAT, environ 35 €/mois) qui complique la maintenance.

### **5.2 — Cloudflare sert de pont stable**

Le reverse proxy contourne élégamment ce problème. Cloudflare, lui, dispose de plages d'adresses IP stables et publiées. Plutôt que de filtrer l'IP changeante de l'application, le serveur du laboratoire filtre les IP stables de Cloudflare. L'application parle à Cloudflare (qu'elle peut toujours joindre), et Cloudflare — avec ses adresses connues — parle au serveur du laboratoire.

Le résultat est une synthèse satisfaisante : le serveur garde son filtrage par IP (une source connue et maîtrisée), et la limitation de Firebase est contournée sans surcoût. Le mTLS décrit en section 4 verrouille la dernière faille théorique (la découverte de l'IP réelle du serveur).

---

## **6\. Conformité CNDP — approche pragmatique**

La loi 09-08 marocaine encadre strictement le traitement des données de santé, classifiées comme données sensibles. La Commission Nationale de Contrôle de Protection des Données à caractère Personnel (CNDP) supervise ce cadre.

Une conformité 100% rigoureuse implique : autorisation préalable (et non simple déclaration), hébergement exclusif au Maroc, autorisation de transfert international, consentement papier signé par patient, audit annuel. Cela prend plusieurs mois et coûte de l'ordre de 30 000 à 50 000 MAD en prestations juridiques.

Nous proposons une **approche à 80%** qui couvre l'essentiel des obligations sans bloquer le projet.

### **6.1 Ce que nous mettons en place immédiatement**

* Aucun résultat médical n'est jamais stocké sur Firebase. Tous les résultats restent sur les serveurs du laboratoire au Maroc.  
* Aucun mot de passe patient n'est généré ni stocké nulle part : l'authentification repose sur un identifiant patient interne et une clé d'application.  
* Chiffrement de bout en bout (HTTPS / TLS) pour toutes les communications.  
* Politique de confidentialité dédiée accessible depuis chaque page de l'application.  
* Consentement explicite du patient via case à cocher obligatoire à l'inscription, doublé d'un consentement papier signé à l'accueil.  
* Journalisation des accès (qui, quand) sans jamais journaliser le contenu des résultats.  
* Droit à l'effacement : tout patient peut demander la suppression de son compte à tout moment.  
* Déclaration auprès de la CNDP du traitement des données personnelles (formulaire en ligne gratuit).  
* Déclaration de transfert à l'étranger pour les données non sensibles hébergées sur Firebase (nom, email, téléphone).

### **6.2 Ce que nous pourrons renforcer dans une seconde phase**

* Demande d'autorisation préalable formelle auprès de la CNDP pour le traitement de données de santé (procédure de 6 à 8 semaines).  
* Audit sécurité indépendant par un prestataire local.  
* Migration progressive des données de profil patient vers un hébergeur au Maroc (par exemple N+ONE, Maroc Datacenter ou Genious Communications).

*Cette approche progressive est commune chez les acteurs digitaux marocains du secteur santé. L'essentiel est de pouvoir prouver, en cas de contrôle, que le minimum vital est en place et qu'une trajectoire de mise en conformité complète est documentée.*

---

## **7\. Spécifications pour le serveur du laboratoire (Si Brahim)**

Cette section décrit précisément ce qui doit être mis en place côté serveur de résultats. L'ensemble des opérations devrait représenter quelques heures de travail pour un développeur familier avec Linux.

**Note importante à l'attention de Si Brahim**

*Les extraits de code, les commandes et l'architecture présentés dans cette section sont une proposition de départ, générée avec l'aide d'un assistant IA pour gagner du temps de rédaction. Ils sont là pour fixer les idées et te montrer que la mise en œuvre est réaliste, pas pour être copiés sans réflexion. C'est toi qui maîtrises ton serveur, ta réplique CyberLab et tes contraintes de production : adapte, simplifie, ou réécris ce code comme tu l'entends. L'essentiel est que tu valides la structure de l'API (endpoint, en-têtes de sécurité, format de réponse), et que tu sois à l'aise avec ce que tu déploies. Toute remarque ou alternative que tu proposeras sera la bienvenue.*

### **7.1 Prérequis**

* Serveur Linux Ubuntu 22.04 LTS ou équivalent (Debian, AlmaLinux).  
* Node.js 20 LTS installé (commande ci-dessous).  
* La réplique des PDF de résultats CyberLab déjà opérationnelle sur ce serveur, accessible localement.  
* Accès sudo / racine pour l'installation.  
* Une **adresse IP publique fixe dédiée** (communiquée séparément, hors de ce document pour des raisons de sécurité) et la possibilité de rediriger le port 443 vers le serveur, en le restreignant aux plages d'adresses Cloudflare.  
* Un **certificat d'origine Cloudflare** installé sur le serveur web (nginx/apache) ou l'application, pour activer le mTLS.

*Atout existant : le serveur de résultat dispose déjà d'une ligne ADSL dédiée avec IP fixe, distincte de la connexion internet générale du laboratoire. Cette isolation réseau est une excellente pratique : elle sépare le serveur médical du reste du réseau du laboratoire et réduit la surface d'attaque.*

### **7.2 Installation de Node.js et des dépendances**

\# Installation de Node.js 20 LTS  
curl \-fsSL https://deb.nodesource.com/setup\_20.x | sudo \-E bash \-  
sudo apt install \-y nodejs

\# Création du dossier de l'API  
sudo mkdir \-p /opt/cyberlab-api && cd /opt/cyberlab-api  
sudo npm init \-y  
sudo npm install express dotenv

### **7.3 Endpoint API à implémenter**

Un seul endpoint suffit : **POST /api/v1/results**

**En-têtes obligatoires acceptés :**

* `Authorization: Bearer <API_KEY>` — clé d'application fournie par Hassan  
* `X-Timestamp: <unix_timestamp>` — secondes depuis Epoch  
* `X-Nonce: <uuid_v4>` — identifiant unique de la requête  
* `X-Signature: <hex>` — HMAC-SHA256 (timestamp \+ « . » \+ nonce \+ « . » \+ body) avec HMAC\_SECRET  
* `Content-Type: application/json`

La fenêtre de validité de l'horodatage est fixée à **120 secondes** pour laisser une marge confortable, tout en conservant une protection anti-rejeu efficace.

**Corps de la requête :**

{  
  "type": "medecin",  
  "requester\_id": "DR\_AB12",  
  "max\_results": 50  
}

Le champ `type` identifie le demandeur : `patient`, `medecin` ou `correspondant`. Le type `correspondant` couvre les cliniques et tout autre établissement. Il permet au serveur d'appliquer les droits d'accès correspondants (un patient ne voit que ses propres résultats ; un médecin ou un correspondant ne voit que ceux des patients qui l'ont désigné — règles exactes à définir avec Si Brahim).

Le champ `requester_id` est **alphanumérique** (chaîne de caractères, et non un simple nombre) : un identifiant de médecin ou de correspondant peut contenir des lettres.

**Réponse attendue (200 OK) :**

{  
  "type": "medecin",  
  "requester\_id": "DR\_AB12",  
  "results": \[  
    {  
      "dossier\_id": "150426014",  
      "patient\_nom": "EL ALLALI",  
      "patient\_prenom": "HASSAN",  
      "date\_dossier": "2026-04-15T08:52:20Z",  
      "etat": "Final",  
      "analyses\_summary": "NFS, GLY, HBA1C, U, CR",  
      "pdf\_base64": "JVBERi0xLjQK..."  
    }  
  \]  
}

Chaque résultat contient `patient_nom` et `patient_prenom`. Ces champs sont **renseignés** lorsque le demandeur est un `medecin` ou un `correspondant` (qui ont besoin d'identifier le patient concerné par chaque résultat). Ils sont laissés **vides** lorsque le demandeur est le `patient` lui-même, qui connaît déjà son identité — un principe de minimisation des données apprécié par la CNDP : on ne transmet que ce qui est strictement nécessaire.

**Note sur les gros volumes (optionnel) :** renvoyer 50 PDF encodés en une seule réponse peut être lourd (plusieurs Mo). Une alternative plus légère consiste à séparer en deux temps : un premier appel renvoie uniquement la **liste** des résultats (dates, intitulés, `dossier_id`, `patient_nom/prenom` selon le type, sans PDF), puis l'application télécharge chaque PDF à la demande quand le patient clique dessus. À décider ensemble selon la préférence du serveur.

**Réponses d'erreur :**

* `401 Unauthorized` : clé invalide, signature incorrecte, horodatage hors fenêtre, ou nonce déjà utilisé.  
* `404 Not Found` : `requester_id` inconnu.  
* `429 Too Many Requests` : limite de fréquence dépassée.  
* `500 Internal Server Error` : problème serveur (ne jamais inclure de détails techniques dans le corps de réponse).

### **7.4 Code de base de l'API (Node.js / Express)**

Voici la structure complète. Il suffit de copier ce fichier dans `/opt/cyberlab-api/server.js` et d'adapter la fonction `fetchResultsFromReplica` selon la structure de votre réplique CyberLab.

const express \= require('express');  
const crypto \= require('crypto');  
require('dotenv').config();

const app \= express();  
const API\_KEY \= process.env.API\_KEY;  
const HMAC\_SECRET \= process.env.HMAC\_SECRET;  
const REPLAY\_WINDOW\_SEC \= 120;          // fenêtre élargie à 120 s  
const usedNonces \= new Map();

app.use(express.json({ limit: '50kb' }));

function verifyRequest(req, res, next) {  
  // 1\. Clé API  
  const auth \= req.headers.authorization;  
  if (\!auth || \!auth.startsWith('Bearer ') || auth.slice(7) \!== API\_KEY) {  
    return res.status(401).json({ error: 'invalid\_api\_key' });  
  }  
  // 2\. Horodatage  
  const ts \= parseInt(req.headers\['x-timestamp'\]);  
  const now \= Math.floor(Date.now() / 1000);  
  if (\!ts || Math.abs(now \- ts) \> REPLAY\_WINDOW\_SEC) {  
    return res.status(401).json({ error: 'timestamp\_out\_of\_window' });  
  }  
  // 3\. Nonce  
  const nonce \= req.headers\['x-nonce'\];  
  if (\!nonce || usedNonces.has(nonce)) {  
    return res.status(401).json({ error: 'nonce\_reused\_or\_missing' });  
  }  
  usedNonces.set(nonce, now);  
  // 4\. Signature HMAC  
  const body \= JSON.stringify(req.body);  
  const payload \= ts \+ '.' \+ nonce \+ '.' \+ body;  
  const expected \= crypto.createHmac('sha256', HMAC\_SECRET)  
    .update(payload).digest('hex');  
  const provided \= req.headers\['x-signature'\] || '';  
  if (provided.length \!== expected.length ||  
      \!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided))) {  
    return res.status(401).json({ error: 'invalid\_signature' });  
  }  
  next();  
}

app.post('/api/v1/results', verifyRequest, (req, res) \=\> {  
  const { type, requester\_id, max\_results } \= req.body;  
  // À IMPLÉMENTER : selon \`type\` (patient | medecin | correspondant),  
  // déterminer les droits puis lire les résultats autorisés pour \`requester\_id\`  
  // dans la réplique CyberLab locale.  
  // patient\_nom / patient\_prenom : remplis pour medecin/correspondant, vides pour patient.  
  const results \= fetchResultsFromReplica(type, requester\_id, max\_results || 50);  
  res.set('Cache-Control', 'no-store');  
  return res.json({ type, requester\_id, results });  
});

// Nettoyage périodique des nonces expirés  
setInterval(() \=\> {  
  const cutoff \= Math.floor(Date.now() / 1000\) \- REPLAY\_WINDOW\_SEC \* 2;  
  for (const \[n, t\] of usedNonces.entries()) {  
    if (t \< cutoff) usedNonces.delete(n);  
  }  
}, 60 \* 1000);

app.listen(3001, '127.0.0.1', () \=\> {  
  console.log('CyberLab API listening on 127.0.0.1:3001');  
});

### **7.5 Configuration des secrets (.env)**

Créer `/opt/cyberlab-api/.env` avec les permissions 600 (lecture par root uniquement) :

API\_KEY=sk\_labo\_\<généré\_aléatoirement\_64\_caractères\>  
HMAC\_SECRET=\<généré\_aléatoirement\_64\_caractères\>

Hassan générera ces deux valeurs avec une commande sécurisée et te les transmettra par canal chiffré (Signal, ProtonMail ou clé USB en main propre). 64 caractères aléatoires suffisent largement : c'est déjà plus que la capacité cryptographique de l'algorithme HMAC-SHA256, donc allonger davantage n'apporte aucune sécurité supplémentaire. Après saisie :

sudo chmod 600 /opt/cyberlab-api/.env  
sudo chown root:root /opt/cyberlab-api/.env

### **7.6 Lancement en service systématique (systemd)**

Créer `/etc/systemd/system/cyberlab-api.service` :

\[Unit\]  
Description=CyberLab Results API  
After=network.target

\[Service\]  
Type=simple  
WorkingDirectory=/opt/cyberlab-api  
ExecStart=/usr/bin/node /opt/cyberlab-api/server.js  
Restart=on-failure  
User=root  
EnvironmentFile=/opt/cyberlab-api/.env

\[Install\]  
WantedBy=multi-user.target

sudo systemctl daemon-reload  
sudo systemctl enable \--now cyberlab-api  
sudo systemctl status cyberlab-api

#### **7.7 Configuration réseau et certificats — état et tâches**

**Côté passerelle (Hassan / Cloudflare) — FAIT :**

* Domaine dédié à l'API : un sous-domaine privé de `coraliaflat.com`, placé derrière Cloudflare (le nom exact est communiqué à Si Brahim en privé).  
* Compte Cloudflare créé, zone active, enregistrement A du sous-domaine → IP du serveur, **proxifié** (le serveur reste masqué).  
* Mode SSL/TLS : **Full (strict)**.  
* **mTLS (Authenticated Origin Pulls) Zone-level** : un certificat client signé par une CA dédiée a été généré et uploadé dans Cloudflare, et le toggle est activé. Cloudflare présentera ce certificat à chaque connexion vers l'origine.  
* Un **Cloudflare Origin Certificate** a été généré pour le serveur (fourni à Si Brahim).

**Côté serveur (Si Brahim) — à faire :**

1. **Implémenter l'API** décrite en 7.3 / 7.4 (endpoint unique `POST /api/v1/results`).  
2. **Servir en HTTPS** avec le certificat fourni (`origin.crt` / `origin.key`) — requis par le mode Full (strict).  
3. **Exiger le certificat client de Cloudflare** (mTLS) : installer `ca.crt` et activer la vérification.  
4. **Restreindre le pare-feu** : n'autoriser le port 443 que depuis les plages d'IP Cloudflare.

**Exemple de configuration nginx réunissant les deux sens :**

nginx

server {

    listen 443 ssl;

    server\_name \<sous-domaine-privé\>.coraliaflat.com;

    \# Le serveur prouve son identité à Cloudflare (Full strict)

    ssl\_certificate     /etc/nginx/cf/origin.crt;

    ssl\_certificate\_key /etc/nginx/cf/origin.key;

    \# Le serveur exige le certificat client de Cloudflare (mTLS / AOP)

    ssl\_client\_certificate /etc/nginx/cf/ca.crt;

    ssl\_verify\_client on;

    location /api/v1/results {

        proxy\_pass http://127.0.0.1:3001;   \# l'API Node locale

    }

}

**Pare-feu — n'autoriser que Cloudflare (exemple `ufw`) :**

bash

for ip in $(curl \-s https://www.cloudflare.com/ips-v4); do

  sudo ufw allow from $ip to any port 443 proto tcp

done

\# puis refuser tout autre accès au port 443

Les éléments sensibles (adresse exacte de l'API, IP d'origine, secrets `API_KEY`/`HMAC_SECRET`, certificats `origin.crt`/`origin.key`/`ca.crt`) sont transmis à Si Brahim par canal privé, hors de ce document.

### **7.8 Test de bon fonctionnement**

Une fois tout en place, Hassan peut envoyer une requête de test depuis sa machine. Si tout est correctement configuré, la réponse arrive en moins d'une seconde avec les résultats du patient de test (compte 7587 par exemple).

### **7.9 Résilience des deux serveurs redondants**

Les deux serveurs redondants doivent chacun exécuter cette même API et appliquer la même configuration de reverse proxy (pare-feu restreint aux IP Cloudflare \+ mTLS). Cloudflare gère automatiquement la bascule entre les deux : si un serveur tombe, l'autre prend le relais sans interruption visible pour les patients. Aucune configuration supplémentaire n'est requise du côté de l'application.

---

## **8\. Rôle des stagiaires à l'accueil**

Le processus de création de compte patient devient nettement plus simple qu'aujourd'hui. Voici le nouveau déroulé à l'accueil :

### **8.1 Workflow détaillé**

* **Étape 1** — Le patient arrive au laboratoire pour ses analyses.  
* **Étape 2** — Le stagiaire ouvre Qalam LIS et génère comme aujourd'hui l'identifiant interne du patient (`patient_id`, par exemple 7587). Aucun mot de passe n'est créé, et aucune fiche papier avec un mot de passe n'est imprimée.  
* **Étape 3** — Le stagiaire ouvre l'espace administrateur de l'application Labo El Allali — accessible à lui seul via son identifiant interne.  
* **Étape 4** — Il saisit : nom, prénom, date de naissance, numéro de téléphone, email du patient, et l'identifiant patient (7587).  
* **Étape 5** — Il imprime le formulaire de consentement (voir section 10\) et le fait signer par le patient.  
* **Étape 6** — Le patient reçoit par SMS un lien de première connexion lui permettant de définir son propre mot de passe pour l'application. C'est le seul mot de passe qu'il aura à mémoriser, et le laboratoire n'a pas à le gérer.

### **8.2 Bénéfices immédiats**

* Plus de fiches papier avec des mots de passe que les patients vont perdre dans deux semaines.  
* Plus de patients qui reviennent à l'accueil pour qu'on leur redélivre leur mot de passe.  
* Le laboratoire n'a strictement aucun mot de passe patient à gérer, protéger ou réinitialiser.  
* Le stagiaire fait une saisie unique dans une interface simple, plus rapide qu'aujourd'hui.  
* Le patient redéfinit lui-même son mot de passe d'application, ce qui responsabilise sa sécurité et allège celle du laboratoire.

---

## **9\. Côté application (Hassan)**

Pour information sur la part de travail côté application :

* Création d'une nouvelle page `/resultats` protégée par authentification dans l'application Labo El Allali.  
* Développement d'une fonction Cloud Firebase `fetchResults` qui : vérifie l'authentification du patient, lit son `patient_id` dans Firestore, signe la requête, l'envoie au serveur via Cloudflare, transmet la réponse au navigateur sans la stocker.  
* Création d'un espace administrateur séparé (route `/admin`) accessible aux seuls stagiaires authentifiés, pour créer les comptes patients.  
* Stockage des secrets `API_KEY` et `HMAC_SECRET` dans Google Secret Manager.  
* Gestion du compte et de la configuration Cloudflare : zone DNS sur `laboelallali.com`, enregistrement proxifié, SSL Full (strict), Authenticated Origin Pulls, certificat client mTLS.  
* Ajout d'une politique de confidentialité dédiée à cette nouvelle fonctionnalité et d'une case à cocher obligatoire à l'inscription.  
* Déclaration auprès de la CNDP du traitement.

Charge estimée côté application : environ 8 à 12 jours de développement.

### **9.1 État d'avancement côté application**

* ✅ **Cloud Function `fetchResults` — IMPLÉMENTÉE.** Callable (`onCall`, région
  `europe-southwest1`). Vérifie l'authentification Firebase, lit `requester_id` +
  `type` depuis `users/{uid}` (jamais depuis le client), construit la requête
  signée (`Authorization: Bearer` + `X-Timestamp` + `X-Nonce` uuid v4 +
  `X-Signature` HMAC-SHA256), appelle `POST <CYBERLAB_API_URL>/api/v1/results`,
  et renvoie la réponse au client **sans rien écrire dans Firestore ni journaliser
  le contenu** (`Cache-Control: no-store`). Erreurs mappées en `HttpsError`
  génériques (aucun détail technique exposé). `max_results` plafonné à 50.
  * Code : `functions/src/cyberlab/client.ts` (transport signé pur) +
    `functions/src/cyberlab/fetchResults.ts` (cœur + callable), exporté depuis
    `functions/src/index.ts`.
  * Secrets `CYBERLAB_API_KEY` / `CYBERLAB_HMAC_SECRET` via `defineSecret` (Google
    Secret Manager en prod ; `functions/.secret.local` pour l'émulateur/les tests).
    URL via `defineString CYBERLAB_API_URL` (`functions/.env`). Rien en dur.
  * Outils de test locaux : `functions/scripts/mock-cyberlab-server.js` (réplique
    la vérification §7.4, signe sur le **raw body**),
    `functions/scripts/test-battery.js` (batterie automatisée A/B/C/D) et
    `functions/scripts/call-fetch-results.js`.
  * ⚠️ Piège HMAC (re-sérialisation JSON) documenté avec vecteur de test
    reproductible dans [hmac-signature-notes.md](hmac-signature-notes.md).
* ✅ **Batterie de tests exécutée** — mock **21/21**, serveur réel **20/21**
  ([test-results.md](test-results.md)). B6 (corps modifié après signature) **passe**
  sur le serveur réel → HMAC vérifié sur le raw body, **aucun problème de
  sérialisation**. Seul écart : **C3** (`requester_id` manquant → le serveur renvoie
  `404` au lieu de `400`), bénin (la Function n'envoie jamais d'entrée malformée).
* ✅ **Optimisation perf (params `include_pdf` + `dossier_id`) — vérifiée côté serveur.**
  Groupe de tests E : `include_pdf="latest"` (liste complète, PDF du plus récent
  seulement), `"none"` (aucun PDF), `"all"`/absent (rétrocompat, tous les PDF), et
  `dossier_id` (1 dossier à la demande, `404` si inconnu). Tous PASS sur le serveur
  réel. `client.ts` envoie ces champs de façon optionnelle.
* ✅ **Optimisation branchée côté app.** Choix mesuré (voir
  `functions/scripts/time-approaches.js`) : **2 appels** plutôt qu'un seul `"latest"`
  — la liste s'affiche en ~0,2 s (`include_pdf:"none"`), puis le PDF le plus récent
  se charge automatiquement (`dossier_id`) et les autres à la demande, avec
  animations de chargement par carte. Impl. : `fetchResults` accepte `include_pdf`
  + `dossier_id` (validés) ; `ResultsContext` fait le flux 2 phases ; page
  `/resultats` progressive. Voir [../pages/resultats.md](../pages/resultats.md).
  * ⚠️ Les certificats mTLS (`origin.*`, `ca.*`, `mtls-client.*`) sécurisent le
    lien Cloudflare↔serveur ; ils ne sont **pas** utilisés par la Function.
* ⏳ À venir : page `/resultats`, espace `/admin` (encodage `requester_id`/`type`
  par le stagiaire), case de consentement + page `/confidentialite`, déclaration CNDP.

---

## **10\. Formulaire de consentement patient (modèle)**

Ce formulaire remplace la fiche actuelle CyberLab. Il est signé à l'accueil par le patient lors de la création de son compte sur l'application, et intègre les mentions exigées par la loi 09-08.

---

**CONSENTEMENT DU PATIENT POUR L'ACCÈS À SES RÉSULTATS D'ANALYSES**

*Laboratoire d'analyses médicales EL ALLALI — Agadir*

Je soussigné(e) :

Nom et prénom : ............................................................................................................

Date de naissance : ......./......./................. Numéro de dossier : ..............................

Téléphone : ........................................................ Email : ...............................................

**déclare avoir pris connaissance des informations suivantes et donner mon accord express pour :**

**1\)** La mise à disposition de mes résultats d'analyses dans l'application mobile **Labo El Allali**, accessible via mon compte personnel créé avec mon adresse email et mon numéro de téléphone. Mes résultats restent à tout moment stockés exclusivement sur les serveurs du laboratoire au Maroc et ne sont **jamais copiés ni sauvegardés** ailleurs.

**2\)** Le traitement de mes données personnelles (nom, prénom, date de naissance, téléphone, email) aux fins exclusives de me permettre d'accéder à mes propres résultats. Ces données sont conservées chez le prestataire technique Google (Firebase), avec des mesures de sécurité renforcées (chiffrement de bout en bout).

**3\)** La consultation à la demande de mes résultats médicaux : ils me sont transmis depuis le serveur du laboratoire au moment où j'en fais la demande dans l'application, affichés à l'écran, puis effacés dès que je quitte la page.

**Conformément à la loi 09-08 relative à la protection des données personnelles au Maroc, je dispose des droits suivants :**

* Droit d'accès, de rectification et d'opposition au traitement de mes données.  
* Droit à l'effacement de mon compte et de mes données personnelles à tout moment, sur simple demande.  
* Droit d'introduire une réclamation auprès de la CNDP (Commission Nationale de Contrôle de Protection des Données à caractère Personnel).

Pour exercer ces droits, je peux contacter le laboratoire à l'adresse contact@laboelallali.ma ou par téléphone.

**Le laboratoire décline toute responsabilité en cas de :**

* Diffusion publique de mes résultats par mes soins ou toute autre utilisation frauduleuse.  
* Perte ou vol de mon identifiant et de mon mot de passe d'application.

**Lu et approuvé.**

Date : ......./......./.................... À : .......................................................

Signature du patient :

...................................................

---

## **11\. Politique de confidentialité — extrait pour la page dédiée**

Ce texte sera publié sur la page `/confidentialite` de l'application, accessible depuis le pied de page et au moment de l'inscription. Voici les sections essentielles.

### **Quelles données nous collectons**

Nous collectons uniquement les données nécessaires pour vous identifier et vous permettre d'accéder à vos résultats : nom, prénom, date de naissance, téléphone, email, et votre identifiant interne au laboratoire.

### **Où sont vos résultats médicaux**

Vos résultats d'analyses médicales sont stockés exclusivement sur les serveurs du laboratoire EL ALLALI, situés au Maroc. Notre application ne les copie jamais. Lorsque vous consultez un résultat, il vous est transmis directement depuis le serveur du laboratoire, affiché dans votre navigateur, puis effacé dès que vous fermez la page.

### **Où sont vos données de profil**

Vos données de profil (nom, téléphone, email) sont stockées dans les services Firebase de Google, dans la région européenne. Ce transfert hors Maroc fait l'objet d'une déclaration auprès de la CNDP et de votre consentement express donné à l'inscription.

### **Vos droits**

* **Accéder à vos données** : vous pouvez les consulter à tout moment depuis votre page profil.  
* **Rectifier vos données** : vous pouvez les modifier directement dans l'application.  
* **Supprimer votre compte** : depuis votre profil, ou en écrivant à contact@laboelallali.ma. La suppression est effective sous 48 heures.  
* **Vous opposer au traitement** : sur simple demande écrite au laboratoire.  
* **Introduire une réclamation** auprès de la CNDP à Rabat.

### **Mesures de sécurité**

Toutes les communications entre l'application et le serveur du laboratoire sont chiffrées en HTTPS. Aucun mot de passe médical n'est stocké dans notre application. Les accès sont journalisés sans jamais enregistrer le contenu des résultats.

### **Durée de conservation**

Vos données de profil sont conservées tant que votre compte est actif. Après suppression de compte, elles sont effacées sous 48 heures, sauf obligation légale de conservation.

---

## **12\. En résumé**

La solution proposée atteint trois objectifs simultanément :

* **Pour le patient :** un accès simple, fluide et moderne à ses résultats, sans mémoriser plusieurs mots de passe.  
* **Pour le laboratoire :** aucune donnée médicale ne sort jamais du Maroc, l'application n'est qu'un visualiseur ; et plus aucun mot de passe patient à gérer.  
* **Pour la conformité :** un dispositif cohérent et documentable, en pleine adéquation avec l'esprit de la loi 09-08.

| Ancien modèle (cyberlab.ma) | Nouveau modèle (application) |
| ----- | ----- |
| 1 mot de passe par patient stocké | **0 mot de passe stocké** |
| IP fixe (pas applicable côté Firebase) | Reverse proxy Cloudflare \+ mTLS (**serveur invisible**) |
| 1 couche de sécurité (login/pass) | **4 couches indépendantes** |
| Le patient doit mémoriser un mot de passe | Le patient utilise son compte app |
| Fiches papier à imprimer | **Plus de fiches** |
| Réinitialisations fréquentes à l'accueil | **Zéro gestion de mot de passe** |
| Risque CNDP en cas de fuite | **Conforme par construction** |

La prochaine étape est la validation par Si Brahim de la structure de l'API. Une fois son retour reçu, nous pourrons établir ensemble un calendrier de mise en œuvre.

*Hassan EL ALLALI — Labo El Allali PWA*

