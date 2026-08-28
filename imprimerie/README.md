# Matériel source — imprimerie

Dossier de **sources fournies par le laboratoire**, pas de fichiers produits.
Rien ici n'est généré : ne pas modifier, seulement ajouter.

## Contenu

- **`Logo Labo EL ALLALI 2025.pdf`** — le logo officiel, vectoriel (Adobe Illustrator 26.5),
  1080 × 1080, sans image bitmap. **C'est la source de tout le kit de marque.**
  Le dégradé qu'il contient fait autorité : `#800020` (bordeaux) → `#FF4081` (fuchsia).
  Il échappe volontairement à la règle `*.pdf` du `.gitignore`.
- **`extracted/`** — photos des supports existants (WhatsApp, 28/08/2026) : papier à en-tête,
  enveloppe à fenêtre recto/verso, affichettes murales, signalétique, bloc-notes, tapis de
  souris, boîte kraft, tampon. Elles documentent l'état avant refonte et ont servi au relevé
  des cotes de l'enveloppe.
- Les archives `.zip` d'origine sont ignorées par git (redondantes avec `extracted/`).

## Ce qui en découle

```
node marketing/scripts/extract-logo-svg.js   # PDF  -> marketing/assets/logos/*.svg
node scripts/generate-icons.js               # SVG  -> public/images/icons/*.png
node marketing/scripts/render-imprimerie.js  # HTML -> marketing/output/imprimerie/*.pdf
node marketing/scripts/verifier-pdf.js       # contrôle prépresse des PDF produits
```

`marketing/output/` est ignoré par git : les PDF pour l'imprimeur se régénèrent
avec la commande ci-dessus.

## Relevé de l'enveloppe

L'enveloppe est une **C5, 229 × 162 mm**, fenêtre **100 × 45 mm** à 20 mm du bord droit
et 57 mm du bord supérieur. Cotes déduites des photos par correction de perspective,
**précision ± 3 mm** — à confirmer par l'imprimeur avec
`marketing/imprimerie/plan-fenetre-enveloppe.html`, une planche à l'échelle 1:1 sur
laquelle on pose une enveloppe réelle.
