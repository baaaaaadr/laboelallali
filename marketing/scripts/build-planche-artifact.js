/**
 * Construit une planche-contact AUTONOME (images intégrées en data URI)
 * pour publication en artifact / envoi en une seule page.
 * Usage : node marketing/scripts/build-planche-artifact.js --month 2026-09 --out <fichier.html>
 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const argv = process.argv.slice(2);
const month = argv[argv.indexOf("--month") + 1];
const out = argv[argv.indexOf("--out") + 1];
if (!month || !out || month.startsWith("--") || out.startsWith("--")) {
  console.error("Usage: node marketing/scripts/build-planche-artifact.js --month 2026-09 --out <fichier.html>");
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(path.join(ROOT, "content", month, "posts.json"), "utf8"));
const outDir = path.join(ROOT, "output", month);

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* Les PNG pleine résolution dépassent la taille d'une page web : on les
   ré-encode en JPEG réduit, uniquement pour l'aperçu. Les fichiers livrés
   au laboratoire restent les PNG d'origine. */
const cache = new Map();
let page = null;

async function dataUriAsync(file, maxWidth) {
  const key = `${file}|${maxWidth}`;
  if (cache.has(key)) return cache.get(key);
  const src = "data:image/png;base64," + fs.readFileSync(file).toString("base64");
  const jpeg = await page.evaluate(
    ([src, maxWidth]) =>
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, maxWidth / img.width);
          const c = document.createElement("canvas");
          c.width = Math.round(img.width * scale);
          c.height = Math.round(img.height * scale);
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL("image/jpeg", 0.82));
        };
        img.src = src;
      }),
    [src, maxWidth]
  );
  cache.set(key, jpeg);
  return jpeg;
}

async function main() {
  const browser = await chromium.launch();
  page = await browser.newPage();
  await page.setContent("<html><body></body></html>");

const sections = [];
for (const p of data.posts) {
    const img = async (lang) => dataUriAsync(path.join(outDir, `${p.slug}-${lang}.png`), 900);
    const cap = (lang) =>
      `<pre>${esc(p[lang].caption || "")}\n\n${(p[lang].hashtags || []).join(" ")}</pre>`;
    const story = async (lang) => {
      const f = path.join(outDir, `${p.slug}-${lang}-story.png`);
      return fs.existsSync(f) ? await dataUriAsync(f, 420) : null;
    };
    const sFr = await story("fr");
    const sAr = await story("ar");
    const imgFr = await img("fr");
    const imgAr = await img("ar");
    const storiesBlock =
      sFr && sAr
        ? `
    <div class="stories">
      <figure><img src="${sFr}" alt="Story FR"><figcaption>Story FR — 1080×1920</figcaption></figure>
      <figure><img src="${sAr}" alt="Story AR"><figcaption>Story AR — 1080×1920</figcaption></figure>
      <p class="storynote">Chaque publication est livrée en 4 visuels : carré français et arabe pour le fil d'actualité, story verticale française et arabe pour les stories Facebook, Instagram et le statut WhatsApp.</p>
    </div>`
        : "";
    const d = new Date(p.date + "T12:00:00");
    const dateFr = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    sections.push(`
  <section>
    <h2>${esc(dateFr)} <small>· modèle « ${esc(p.template)} » · feu ${esc(p.risk)}</small></h2>
    <div class="pair">
      <figure><img src="${imgFr}" alt="Visuel FR ${esc(p.slug)}"><figcaption><b>Version française — légende à copier :</b>${cap("fr")}</figcaption></figure>
      <figure><img src="${imgAr}" alt="Visuel AR ${esc(p.slug)}"><figcaption><b>النسخة العربية — النص المرافق :</b><div dir="rtl">${cap("ar")}</div></figcaption></figure>
    </div>${storiesBlock}
  </section>`);
}

const affDir = path.join(ROOT, "output", "affiches");
let affSection = "";
if (fs.existsSync(affDir)) {
  const affs = fs.readdirSync(affDir).filter((f) => f.endsWith(".png"));
  if (affs.length) {
    const figs = [];
    for (const f of affs) {
      const uri = await dataUriAsync(path.join(affDir, f), 760);
      figs.push(`<figure><img src="${uri}" alt="${esc(f)}"><figcaption>${esc(f.replace(".png", "").replace("affiche-", "Affiche « ") + " »")}</figcaption></figure>`);
    }
    affSection = `
  <section>
    <h2>Affiches A4 pour l'accueil <small>· option A du devis · prêtes à imprimer (300 dpi)</small></h2>
    <div class="pair">
      ${figs.join("\n")}
    </div>
  </section>`;
  }
}
  await browser.close();

const html = `<title>Échantillons Posts El Allali</title>
<style>
  :root { --paper:#FFFFFF; --surface:#FAF3F5; --ink:#2B171D; --muted:#6E5A60; --line:#E9D8DD; --brand:#800020; --accent:#FF4081; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
    --paper:#1F1014; --surface:#2A161C; --ink:#F4E9EC; --muted:#C9ADB6; --line:#4A2F37; --brand:#FF79A8; --accent:#FF79A8; } }
  :root[data-theme="dark"] { --paper:#1F1014; --surface:#2A161C; --ink:#F4E9EC; --muted:#C9ADB6; --line:#4A2F37; --brand:#FF79A8; --accent:#FF79A8; }
  body { background:var(--paper); color:var(--ink); font-family:"Segoe UI",system-ui,sans-serif; margin:0; padding:2.5rem 1.25rem 4rem; line-height:1.5; }
  .sheet { max-width:860px; margin:0 auto; }
  .eyebrow { text-transform:uppercase; letter-spacing:.14em; font-size:.72rem; font-weight:600; color:var(--accent); margin:0 0 .4rem; }
  h1 { color:var(--brand); font-size:1.7rem; margin:0 0 .4rem; }
  .lede { color:var(--muted); font-size:.95rem; margin:0 0 2rem; }
  h2 { color:var(--brand); font-size:1rem; margin:2.2rem 0 .6rem; border-bottom:2px solid var(--brand); padding-bottom:.25rem; }
  h2 small { color:var(--muted); font-weight:400; font-size:.8rem; }
  .pair { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
  figure { margin:0; }
  img { width:100%; max-width:100%; border-radius:10px; box-shadow:0 6px 18px rgba(0,0,0,.18); }
  figcaption { font-size:.82rem; margin-top:.5rem; color:var(--muted); }
  figcaption b { color:var(--ink); }
  pre { white-space:pre-wrap; background:var(--surface); border:1px solid var(--line); border-radius:6px; padding:.6rem .8rem; font-family:inherit; color:var(--ink); margin:.4rem 0 0; }
  .stories { display:grid; grid-template-columns:200px 200px 1fr; gap:1rem; align-items:start; margin-top:1rem; padding-top:1rem; border-top:1px dashed var(--line); }
  .storynote { font-size:.82rem; color:var(--muted); margin:0; align-self:center; }
  @media (max-width:680px) { .pair { grid-template-columns:1fr; } .stories { grid-template-columns:1fr 1fr; } .storynote { grid-column:1 / -1; } }
</style>
<div class="sheet">
  <p class="eyebrow">Laboratoire El Allali · Échantillon du pack de lancement</p>
  <h1>6 exemples de publications, prêtes à poster</h1>
  <p class="lede">Un exemple par modèle graphique, chacun en version française et arabe, en carré pour le fil d'actualité et en story verticale, avec la légende à copier-coller. Le pack complet (18 publications, soit 72 visuels, + calendrier daté) est produit dès validation.</p>
${sections.join("\n")}
${affSection}
</div>`;

  fs.writeFileSync(out, html, "utf8");
  console.log(`OK  ${out} (${Math.round(fs.statSync(out).size / 1024)} Ko)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
