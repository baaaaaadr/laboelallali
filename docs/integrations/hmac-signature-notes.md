# HMAC signature — notes de référence (debug)

Référence technique pour la signature des requêtes `fetchResults` → serveur CyberLab.
À garder sous la main le jour où l'on branche le vrai serveur (Si Brahim).

Voir aussi : [cyberlab-results-api.md](cyberlab-results-api.md) §7.3–7.4.

---

## 1. La chaîne exacte qui est signée

```
payload = timestamp + "." + nonce + "." + body
```

Où :

- `timestamp` — secondes Unix, **entier** (pas de millisecondes, pas de décimales).
  Ex. `1718000000`. Envoyé dans l'en-tête `X-Timestamp`.
- `nonce` — **UUID v4** généré par `crypto.randomUUID()`.
  Ex. `3f8b2c1a-0000-4a00-8000-000000000000`. Envoyé dans `X-Nonce`.
- `body` — **exactement** la chaîne JSON transmise sur le réseau, c.-à-d.
  `JSON.stringify({ type, requester_id, max_results })` **dans cet ordre de clés**.

Signature = `HMAC-SHA256(payload, HMAC_SECRET)` en **hexadécimal minuscule**.
Envoyée dans `X-Signature`.

> ⚠️ Côté application, `body` est sérialisé **une seule fois** : la même chaîne sert
> à calculer la signature **et** à être envoyée (`fetch(..., { body })`). Voir
> `functions/src/cyberlab/client.ts` (`callCyberlab`).

---

## 2. Exemple concret complet (vecteur de test reproductible)

Entrée :

```json
{ "type": "patient", "requester_id": "7587", "max_results": 50 }
```

`body` (chaîne littérale, caractère par caractère, **aucun espace**, 57 octets UTF-8) :

```
{"type":"patient","requester_id":"7587","max_results":50}
```

Avec, pour l'exemple :

- `HMAC_SECRET` = `test_hmac_secret_abcdefghijklmnop`
- `timestamp`  = `1718000000`
- `nonce`      = `3f8b2c1a-0000-4a00-8000-000000000000`

`payload` :

```
1718000000.3f8b2c1a-0000-4a00-8000-000000000000.{"type":"patient","requester_id":"7587","max_results":50}
```

`X-Signature` attendu :

```
6dbfdc5b868c9481b3c2d26a9f041effd9009678c7c52093b2e2407119f809b3
```

Vérification (n'importe quel langage doit reproduire cette valeur exacte) :

```bash
node -e 'const c=require("crypto");
const body=JSON.stringify({type:"patient",requester_id:"7587",max_results:50});
const p="1718000000.3f8b2c1a-0000-4a00-8000-000000000000."+body;
console.log(c.createHmac("sha256","test_hmac_secret_abcdefghijklmnop").update(p).digest("hex"));'
# => 6dbfdc5b868c9481b3c2d26a9f041effd9009678c7c52093b2e2407119f809b3
```

Si le serveur reproduit cette signature à partir du même secret, timestamp, nonce et
raw body, sa vérification est correctement alignée.

---

## 3. ⚠️ Le piège de la re-sérialisation JSON

> **Si le serveur d'origine renvoie `401 invalid_signature` alors que le mock local
> accepte la même requête, la cause est quasi certainement une différence de
> sérialisation JSON entre les deux implémentations.**

Deux `JSON.stringify` de deux langages/librairies différents peuvent produire des
chaînes différentes pour le même objet logique :

- **ordre des clés** différent ;
- **espaces** insérés (`{ "type": ...}` vs `{"type":...}`) ;
- **échappement** des caractères non-ASCII (`é` vs `é` brut) ;
- **format des nombres** (`50` vs `50.0`).

Chaque différence casse le HMAC → `401`.

### Solution recommandée

**Signer et vérifier le corps brut de la requête (raw body) tel qu'il est transmis
sur le réseau — sans le re-sérialiser côté serveur.**

- ✅ Ce que fait notre mock (`functions/scripts/mock-cyberlab-server.js`) : il calcule
  le HMAC sur le **raw body reçu** (la chaîne exacte lue sur le socket), pas sur une
  re-sérialisation. C'est la bonne approche.
- ⚠️ Le code de référence de la proposition (§7.4) fait
  `const body = JSON.stringify(req.body)` — il **re-sérialise** l'objet parsé par
  Express. C'est fragile : ça ne marche que si `JSON.stringify` côté serveur reproduit
  exactement la chaîne d'origine. **À remplacer par une vérification sur le raw body.**

En Express, capturer le raw body :

```js
// Au lieu de app.use(express.json()) seul :
app.use(express.json({
  limit: "50kb",
  verify: (req, _res, buf) => { req.rawBody = buf.toString("utf8"); },
}));
// puis signer/vérifier sur req.rawBody (et non JSON.stringify(req.body)).
```

---

## 4. À confirmer avec l'éditeur du serveur (Si Brahim)

- [ ] La signature est vérifiée sur le **raw body reçu**, pas sur une re-sérialisation
      (`JSON.stringify(req.body)`).
- [ ] **Ordre des clés** attendu dans le body : `type`, `requester_id`, `max_results`.
- [ ] **Aucun espace** dans le JSON (sortie compacte de `JSON.stringify`).
- [ ] Encodage **UTF-8** ; les identifiants restent ASCII (pas d'échappement `\uXXXX`
      attendu ici, mais à confirmer si des champs texte s'ajoutent plus tard).
- [ ] `X-Signature` en **hex minuscule**, comparaison en temps constant
      (`crypto.timingSafeEqual`).
- [ ] Fenêtre anti-rejeu `X-Timestamp` = **120 s** ; `X-Nonce` mémorisé et refusé si
      rejoué.
- [ ] Le vecteur de test de la §2 ci-dessus produit bien la même `X-Signature` côté
      serveur.
