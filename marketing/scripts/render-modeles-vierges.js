/**
 * Génère les modèles vierges : le décor complet (fond, voile, logo, coordonnées)
 * SANS texte, pour que le laboratoire puisse écrire lui-même par-dessus
 * (Canva, PowerPoint, Word...). Carré 1080×1080 et story 1080×1920.
 * Usage : node marketing/scripts/render-modeles-vierges.js
 */
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const TEMPLATES = path.join(ROOT, "templates");
const OUT = path.join(ROOT, "output", "modeles-vierges");

const BRAND = {
  fr: { name: "Laboratoire El Allali", contact: "05 28 84 33 84 · WhatsApp 06 54 07 95 92 · laboelallali.com" },
  ar: {
    name: "مختبر العلالي للتحاليل الطبية",
    contact:
      '<span dir="ltr">05 28 84 33 84</span> · واتساب <span dir="ltr">06 54 07 95 92</span> · laboelallali.com',
  },
};

const MODELES = [
  { nom: "1-bordeaux", classes: "mode-brand accent-bordeaux", bg: null },
  { nom: "2-fuchsia", classes: "mode-brand accent-fuchsia", bg: null },
  { nom: "3-rose-clair", classes: "mode-brand accent-pale", bg: null },
  { nom: "4-photo-tubes", classes: "mode-photo accent-bordeaux", bg: "tubes-labo.jpg" },
  { nom: "5-photo-laboratoire", classes: "mode-photo accent-bordeaux", bg: "hero-banner.jpg" },
  { nom: "6-photo-microscope", classes: "mode-photo veil-fuchsia accent-bordeaux", bg: "cellules-micro.jpg" },
];

const FORMATS = [
  { suffix: "carre", width: 1080, height: 1080, cls: "" },
  { suffix: "story", width: 1080, height: 1920, cls: " fmt-story" },
];

function html(modele, format, lang) {
  const bgimg = modele.bg
    ? `<img class="bg-photo" src="../assets/backgrounds/${modele.bg}" alt="">`
    : "";
  return `<!DOCTYPE html>
<html lang="${lang}" dir="${lang === "ar" ? "rtl" : "ltr"}">
<head><meta charset="utf-8"><link rel="stylesheet" href="base.css"></head>
<body lang="${lang}" class="${modele.classes}${FORMATS.find((f) => f.suffix === format).cls}">
  <div class="canvas">
    <div class="bg">${bgimg}<div class="veil"></div><div class="deco"></div></div>
    <footer class="brandbar">
      <img src="../assets/logos/logo-footer.png" alt="">
      <div class="who">
        <span class="name">${BRAND[lang].name}</span>
        <span class="contact">${BRAND[lang].contact}</span>
      </div>
    </footer>
  </div>
</body></html>`;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 1 });
  const tmp = path.join(TEMPLATES, "_vierge-tmp.html");

  try {
    for (const modele of MODELES) {
      for (const fmt of FORMATS) {
        for (const lang of ["fr", "ar"]) {
          fs.writeFileSync(tmp, html(modele, fmt.suffix, lang), "utf8");
          await page.setViewportSize({ width: fmt.width, height: fmt.height });
          await page.goto(pathToFileURL(tmp).href, { waitUntil: "load" });
          await page.evaluate(async () => {
            await document.fonts.ready;
            await Promise.all(
              Array.from(document.images).map((i) => (i.decode ? i.decode().catch(() => {}) : null))
            );
          });
          const file = path.join(OUT, `modele-${modele.nom}-${fmt.suffix}-${lang}.png`);
          await page.screenshot({ path: file, clip: { x: 0, y: 0, width: fmt.width, height: fmt.height } });
          console.log(`OK  ${path.relative(ROOT, file)}`);
        }
      }
    }
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    await browser.close();
  }
  console.log(`\nTerminé : ${MODELES.length} modèles × 2 formats × 2 langues = ${MODELES.length * 4} fichiers`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
