/**
 * Assemble le dossier de livraison remis au laboratoire :
 * les documents en PDF (mise en page conservée) et les images rangées par dossier.
 * Le dossier obtenu se dépose tel quel dans Google Drive.
 * Usage : node marketing/scripts/build-livraison.js
 */
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "livraison");

const DOCS = [
  { src: "guide-publication.html", nom: "1 - Guide de publication.pdf" },
  { src: "strategie-2026.html", nom: "2 - Strategie de communication.pdf" },
  { src: "todo-labo.html", nom: "3 - Actions a mener au laboratoire.pdf" },
  { src: "reponses-whatsapp.html", nom: "4 - Reponses WhatsApp.pdf" },
  { src: "programme-editorial.html", nom: "5 - Programme editorial jusqu'en juillet 2027.pdf" },
];

// Les affiches relèvent de l'option A, non validée : elles ne sont incluses
// que si on le demande explicitement (--avec-affiches).
const avecAffiches = process.argv.includes("--avec-affiches");

const COPIES = [
  { from: path.join(ROOT, "output", "2026-09"), to: "Images des publications", filtre: (f) => f.endsWith(".png") },
  { from: path.join(ROOT, "output", "modeles-vierges"), to: "Modeles vierges", filtre: (f) => f.endsWith(".png") },
  ...(avecAffiches
    ? [{ from: path.join(ROOT, "output", "affiches"), to: "Affiches pour l'accueil", filtre: (f) => f.endsWith(".png") }]
    : []),
];

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Document des textes à copier-coller : une page qui s'ouvre dans le navigateur,
 * chaque publication avec sa légende française et arabe et ses hashtags.
 * En HTML plutôt qu'en PDF : le copier-coller de l'arabe y reste fidèle.
 */
function ecrireTextes() {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "2026-09", "posts.json"), "utf8"));
  const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

  const blocs = data.posts
    .map((p, i) => {
      const d = new Date(p.date + "T12:00:00Z");
      const date = `${d.getUTCDate()} ${MOIS[d.getUTCMonth()]}`;
      const bloc = (lang) => {
        const l = p[lang];
        const texte = `${l.caption}\n\n${(l.hashtags || []).join(" ")}`;
        return `<div class="col"${lang === "ar" ? ' dir="rtl"' : ""}>
        <h4>${lang === "fr" ? "Version française" : "النسخة العربية"}</h4>
        <p class="fichier">${esc(p.slug)}-${lang}.png &nbsp;·&nbsp; ${esc(p.slug)}-${lang}-story.png</p>
        <pre>${esc(texte)}</pre>
      </div>`;
      };
      return `<section>
      <h3><span class="num">${i + 1}</span> ${esc(date)} — ${esc(p.fr.title)}${p.risk === "orange" ? ' <em class="relire">relecture conseillée</em>' : ""}</h3>
      <div class="pair">${bloc("fr")}${bloc("ar")}</div>
    </section>`;
    })
    .join("\n");

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>Textes des publications — Laboratoire El Allali</title>
<style>
  body { font-family:"Segoe UI",system-ui,sans-serif; color:#2B171D; background:#fff; margin:0; padding:2.5rem 1.5rem 4rem; line-height:1.55; }
  .sheet { max-width:1000px; margin:0 auto; }
  h1 { color:#800020; font-size:1.6rem; margin:0 0 .3rem; }
  .lede { color:#6E5A60; font-size:.95rem; margin:0 0 2rem; }
  section { margin:0 0 2rem; padding-bottom:1.2rem; border-bottom:1px solid #E9D8DD; }
  h3 { color:#800020; font-size:1.02rem; margin:0 0 .7rem; display:flex; align-items:center; gap:.5rem; }
  .num { background:#800020; color:#fff; width:1.6rem; height:1.6rem; border-radius:50%; display:inline-grid; place-items:center; font-size:.82rem; flex:none; }
  .relire { color:#A05A0B; font-size:.78rem; font-style:normal; font-weight:600; background:#FBF3E6; border-radius:99px; padding:.1rem .55rem; }
  .pair { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
  h4 { font-size:.78rem; text-transform:uppercase; letter-spacing:.08em; color:#FF4081; margin:0 0 .25rem; }
  .fichier { font-size:.76rem; color:#6E5A60; margin:0 0 .4rem; }
  pre { white-space:pre-wrap; background:#FAF3F5; border:1px solid #E9D8DD; border-radius:6px; padding:.7rem .9rem; font-family:inherit; font-size:.9rem; margin:0; }
  @media (max-width:760px) { .pair { grid-template-columns:1fr; } }
</style></head><body><div class="sheet">
<h1>Textes des publications — septembre et octobre 2026</h1>
<p class="lede">Pour chaque publication : le texte à coller sous l'image, en français et en arabe, avec les hashtags. Sélectionnez le texte, copiez-le (Ctrl+C) et collez-le dans Facebook ou Instagram. Publiez la version française et la version arabe séparément.</p>
${blocs}
</div></body></html>`;

  fs.writeFileSync(path.join(OUT, "Textes des publications.html"), html, "utf8");
  console.log(`TXT  Textes des publications.html — ${data.posts.length} publications`);
}

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const doc of DOCS) {
    const src = path.join(ROOT, "docs", doc.src);
    if (!fs.existsSync(src)) {
      console.warn(`ATTENTION : ${doc.src} introuvable, ignoré`);
      continue;
    }
    // forcer le thème clair : le PDF est destiné à l'impression
    await page.emulateMedia({ colorScheme: "light", media: "print" });
    await page.goto(pathToFileURL(src).href, { waitUntil: "networkidle" });
    await page.evaluate(async () => { await document.fonts.ready; });
    await page.pdf({
      path: path.join(OUT, doc.nom),
      format: "A4",
      printBackground: true,
      margin: { top: "14mm", bottom: "14mm", left: "12mm", right: "12mm" },
    });
    console.log(`PDF  ${doc.nom}`);
  }
  await browser.close();

  ecrireTextes();

  for (const c of COPIES) {
    if (!fs.existsSync(c.from)) {
      console.warn(`ATTENTION : ${c.from} introuvable, ignoré`);
      continue;
    }
    const dest = path.join(OUT, c.to);
    fs.mkdirSync(dest, { recursive: true });
    const fichiers = fs.readdirSync(c.from).filter(c.filtre);
    fichiers.forEach((f) => fs.copyFileSync(path.join(c.from, f), path.join(dest, f)));
    console.log(`IMG  ${c.to} — ${fichiers.length} fichier(s)`);
  }

  const total = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? total(path.join(dir, e.name)) : 1), 0);
  const poids = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).reduce(
      (n, e) => n + (e.isDirectory() ? poids(path.join(dir, e.name)) : fs.statSync(path.join(dir, e.name)).size),
      0
    );
  console.log(`\nDossier prêt : ${path.relative(path.resolve(ROOT, ".."), OUT)}`);
  console.log(`${total(OUT)} fichiers, ${(poids(OUT) / 1024 / 1024).toFixed(1)} Mo`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
