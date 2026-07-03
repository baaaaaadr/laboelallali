# CyberLab API — résultats de la batterie de tests

> ⚠️ **Rapport sans aucun contenu de résultat réel.** Il ne contient que des identifiants de test, descriptions, codes/statuts attendus vs obtenus et PASS/FAIL. Aucun nom de patient, date de dossier ni donnée PDF n'y figure. Sûr à transmettre à un tiers.

_Généré le 2026-07-03T10:07:33.265Z._

## Vecteur de test de signature (à comparer par l'éditeur)

Secret de test (public, **pas** le secret de production) :
```
HMAC_SECRET = test_hmac_secret_abcdefghijklmnop
timestamp   = 1718000000
nonce       = 3f8b2c1a-0000-4a00-8000-000000000000
body        = {"type":"patient","requester_id":"7587","max_results":50}
payload     = 1718000000.3f8b2c1a-0000-4a00-8000-000000000000.{"type":"patient","requester_id":"7587","max_results":50}
X-Signature = 6dbfdc5b868c9481b3c2d26a9f041effd9009678c7c52093b2e2407119f809b3
```
Toute implémentation correcte doit reproduire exactement cette `X-Signature`.

## Cible « mock » — localhost (mock)

- Exécuté : 2026-07-03T10:06:32.969Z
- Résultat global : **21/21 PASS**

| ID | Groupe | Description | Attendu | Obtenu | Résultat |
| --- | --- | --- | --- | --- | --- |
| A1 | A | Patient 7587 — happy path | 200 + résultats + patient_nom vide (minimisation) | status=200, results=50, patient_nom_vide=true | ✅ PASS |
| A2 | A | Patient 142807 — happy path | 200 + résultats | status=200, results=50 | ✅ PASS |
| A3 | A | Correspondant TESTA — happy path | 200 + patient_nom renseigné | status=200, results=50, patient_nom_renseigne=true | ✅ PASS |
| A4 | A | Médecin TESTMED — happy path | 200 + patient_nom renseigné | status=200, results=50, patient_nom_renseigne=true | ✅ PASS |
| B1 | B | Mauvaise clé API | 401 | status=401 | ✅ PASS |
| B2 | B | Signature HMAC corrompue | 401 | status=401 | ✅ PASS |
| B3 | B | Header X-Signature absent | 401 ou 400 | status=401 | ✅ PASS |
| B4 | B | Timestamp expiré (now-300s) | rejet (401) | status=401 | ✅ PASS |
| B5 | B | Nonce rejoué (2× requête identique) | 1re acceptée, 2e rejetée (401) | 1re=200, 2e=401 | ✅ PASS |
| B6 | B | Corps modifié après signature | 401 | status=401 | ✅ PASS |
| C1 | C | requester_id inconnu (000000) | 404 ou résultats vides | status=404 _(comportement: 404)_ | ✅ PASS |
| C2 | C | type invalide (hacker) | 400 ou 422 | status=400 | ✅ PASS |
| C3 | C | requester_id manquant | 400 | status=400 | ✅ PASS |
| C4 | C | max_results > 50 (=100) | clampé (≤50) ou rejeté | status=200, results=50 _(comportement: clampé)_ | ✅ PASS |
| D1 | D | Champs attendus présents dans chaque résultat | présence de: dossier_id, patient_nom, patient_prenom, date_dossier, etat, analyses_summary, pdf_base64 | tous_champs_presents=true | ✅ PASS |
| D2 | D | pdf_base64 = base64 valide décodant en PDF | décodage → magic %PDF- | decode_pdf_ok=true | ✅ PASS |
| E1 | E | include_pdf=latest — liste complète, PDF du plus récent seulement | ≥1 résultat, exactement 1 PDF (le plus récent) | status=200, results=50, pdf_count=1, pdf_est_plus_recent=true | ✅ PASS |
| E2 | E | include_pdf=none — liste complète, aucun PDF | ≥1 résultat, tous pdf_base64 vides | status=200, results=50, tous_pdf_vides=true | ✅ PASS |
| E3 | E | include_pdf=all — tous les PDF (rétrocompatibilité) | ≥1 résultat, tous pdf_base64 remplis | status=200, results=50, tous_pdf_remplis=true | ✅ PASS |
| E4 | E | dossier_id connu — 1 dossier avec son PDF | 1 résultat, bon dossier, PDF présent | status=200, results=1, pdf_present=true, dossier_correspond=true | ✅ PASS |
| E5 | E | dossier_id inconnu — rejet | 404 | status=404 | ✅ PASS |

## Cible « real » — ***.coraliaflat.com

- Exécuté : 2026-07-03T10:07:33.264Z
- Résultat global : **20/21 PASS**

| ID | Groupe | Description | Attendu | Obtenu | Résultat |
| --- | --- | --- | --- | --- | --- |
| A1 | A | Patient 7587 — happy path | 200 + résultats + patient_nom vide (minimisation) | status=200, results=3, patient_nom_vide=true | ✅ PASS |
| A2 | A | Patient 142807 — happy path | 200 + résultats | status=200, results=3 | ✅ PASS |
| A3 | A | Correspondant TESTA — happy path | 200 + patient_nom renseigné | status=200, results=3, patient_nom_renseigne=true | ✅ PASS |
| A4 | A | Médecin TESTMED — happy path | 200 + patient_nom renseigné | status=200, results=3, patient_nom_renseigne=true | ✅ PASS |
| B1 | B | Mauvaise clé API | 401 | status=401 | ✅ PASS |
| B2 | B | Signature HMAC corrompue | 401 | status=401 | ✅ PASS |
| B3 | B | Header X-Signature absent | 401 ou 400 | status=401 | ✅ PASS |
| B4 | B | Timestamp expiré (now-300s) | rejet (401) | status=401 | ✅ PASS |
| B5 | B | Nonce rejoué (2× requête identique) | 1re acceptée, 2e rejetée (401) | 1re=200, 2e=401 | ✅ PASS |
| B6 | B | Corps modifié après signature | 401 | status=401 | ✅ PASS |
| C1 | C | requester_id inconnu (000000) | 404 ou résultats vides | status=404 _(comportement: 404)_ | ✅ PASS |
| C2 | C | type invalide (hacker) | 400 ou 422 | status=400 | ✅ PASS |
| C3 | C | requester_id manquant | 400 | status=404 | ❌ FAIL |
| C4 | C | max_results > 50 (=100) | clampé (≤50) ou rejeté | status=200, results=3 _(comportement: clampé)_ | ✅ PASS |
| D1 | D | Champs attendus présents dans chaque résultat | présence de: dossier_id, patient_nom, patient_prenom, date_dossier, etat, analyses_summary, pdf_base64 | tous_champs_presents=true | ✅ PASS |
| D2 | D | pdf_base64 = base64 valide décodant en PDF | décodage → magic %PDF- | decode_pdf_ok=true | ✅ PASS |
| E1 | E | include_pdf=latest — liste complète, PDF du plus récent seulement | ≥1 résultat, exactement 1 PDF (le plus récent) | status=200, results=3, pdf_count=1, pdf_est_plus_recent=true | ✅ PASS |
| E2 | E | include_pdf=none — liste complète, aucun PDF | ≥1 résultat, tous pdf_base64 vides | status=200, results=3, tous_pdf_vides=true | ✅ PASS |
| E3 | E | include_pdf=all — tous les PDF (rétrocompatibilité) | ≥1 résultat, tous pdf_base64 remplis | status=200, results=3, tous_pdf_remplis=true | ✅ PASS |
| E4 | E | dossier_id connu — 1 dossier avec son PDF | 1 résultat, bon dossier, PDF présent | status=200, results=1, pdf_present=true, dossier_correspond=true | ✅ PASS |
| E5 | E | dossier_id inconnu — rejet | 404 | status=404 | ✅ PASS |

## Comparaison mock vs serveur réel

Cas qui **passent sur le mock mais échouent sur le serveur réel** : C3.


> ℹ️ Écarts hors signature (C3) : différences de sémantique de validation d'entrée (p. ex. le code HTTP renvoyé pour une entrée invalide). **Sans impact sur le flux applicatif** : la Cloud Function lit et valide `type`/`requester_id` depuis Firestore et n'envoie donc jamais d'entrée malformée. À confirmer avec l'éditeur seulement si un alignement strict est souhaité.

