/**
 * Génère les images PNG 1080×1080 des posts à partir des templates HTML.
 *
 * Usage (depuis la racine du repo) :
 *   node marketing/scripts/render-posts.js --month 2026-09 [--post <slug>] [--lang fr|ar]
 *
 * Lit  : marketing/content/<month>/posts.json + marketing/templates/*.html
 * Écrit: marketing/output/<month>/<slug>-<fr|ar>.png + index.html (planche-contact)
 */
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const TEMPLATES = path.join(ROOT, "templates");

const BRAND = {
  fr: {
    name: "Laboratoire El Allali",
    contact: "05 28 84 33 84 · WhatsApp 06 54 07 95 92 · laboelallali.com",
  },
  ar: {
    name: "مختبر العلالي للتحاليل الطبية",
    // dir="ltr" sur les numéros : sinon le rendu RTL inverse les groupes de chiffres
    contact:
      '<span dir="ltr">05 28 84 33 84</span> · واتساب <span dir="ltr">06 54 07 95 92</span> · laboelallali.com',
  },
};

const CHECK_SVG =
  '<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.5 8.5l3.5 3.5 7-8" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const FORMATS = {
  square: { suffix: "", width: 1080, height: 1080, cls: "" },
  story: { suffix: "-story", width: 1080, height: 1920, cls: " fmt-story" },
};

function parseArgs() {
  const args = { month: null, post: null, lang: null, format: null };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--month") args.month = argv[++i];
    else if (argv[i] === "--post") args.post = argv[++i];
    else if (argv[i] === "--lang") args.lang = argv[++i];
    else if (argv[i] === "--format") args.format = argv[++i];
  }
  if (!args.month) {
    console.error(
      "Usage: node marketing/scripts/render-posts.js --month 2026-09 [--post <slug>] [--lang fr|ar] [--format square|story]"
    );
    process.exit(1);
  }
  if (args.format && !FORMATS[args.format]) {
    console.error(`Format inconnu : ${args.format} (square ou story)`);
    process.exit(1);
  }
  return args;
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildHtml(post, lang, format) {
  const tplPath = path.join(TEMPLATES, `${post.template}.html`);
  if (!fs.existsSync(tplPath)) throw new Error(`Template introuvable : ${post.template}`);
  let html = fs.readFileSync(tplPath, "utf8");

  const loc = post[lang];
  if (!loc) throw new Error(`Post ${post.slug} : pas de contenu "${lang}"`);

  const mode = post.mode === "photo" ? "mode-photo" : "mode-brand";
  const accent = post.accent || "bordeaux";
  const modeclass = `${mode} accent-${accent}${post.veil === "fuchsia" ? " veil-fuchsia" : ""}${FORMATS[format].cls}`;

  let bgimg = "";
  if (post.mode === "photo") {
    const bg = post.background || "hero-banner.jpg";
    bgimg = `<img class="bg-photo" src="../assets/backgrounds/${esc(bg)}" alt="">`;
  }

  const isChecklist = post.template === "preparation-examen";
  const lineshtml = (loc.lines || [])
    .map((l) =>
      isChecklist
        ? `<li><span class="ck">${CHECK_SVG}</span><span>${esc(l)}</span></li>`
        : `<li><span class="b"></span><span>${esc(l)}</span></li>`
    )
    .join("\n");

  const slots = {
    lang,
    dir: lang === "ar" ? "rtl" : "ltr",
    modeclass,
    bgimg,
    lineshtml,
    title: esc(loc.title || ""),
    eyebrow: esc(loc.eyebrow || ""),
    chip: esc(loc.chip || ""),
    source: esc(loc.source || ""),
    screenshot: (post.screenshot || "../assets/screenshots/mobile-home-{lang}.png").replace("{lang}", lang),
    brandname: BRAND[lang].name,
    contact: BRAND[lang].contact,
  };

  html = html.replace(/\{\{(\w+)\}\}/g, (_, key) => (key in slots ? slots[key] : ""));
  return html;
}

async function main() {
  const args = parseArgs();
  const contentPath = path.join(ROOT, "content", args.month, "posts.json");
  if (!fs.existsSync(contentPath)) {
    console.error(`Introuvable : ${contentPath}`);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(contentPath, "utf8"));
  const outDir = path.join(ROOT, "output", args.month);
  fs.mkdirSync(outDir, { recursive: true });

  let posts = data.posts;
  if (args.post) posts = posts.filter((p) => p.slug === args.post);
  const langs = args.lang ? [args.lang] : ["fr", "ar"];
  if (!posts.length) {
    console.error("Aucun post à générer (vérifier --post).");
    process.exit(1);
  }

  const formats = args.format ? [args.format] : ["square", "story"];
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 1 });

  const tmpFile = path.join(TEMPLATES, "_render-tmp.html");
  const warnings = [];

  try {
    for (const post of posts) {
      for (const lang of langs) {
        for (const format of formats) {
          const { suffix, width, height } = FORMATS[format];
          const html = buildHtml(post, lang, format);
          fs.writeFileSync(tmpFile, html, "utf8");
          await page.setViewportSize({ width, height });
          await page.goto(pathToFileURL(tmpFile).href, { waitUntil: "load" });
          await page.evaluate(async () => {
            await document.fonts.ready;
            await Promise.all(
              Array.from(document.images).map((img) => (img.decode ? img.decode().catch(() => {}) : null))
            );
          });
          await page.waitForFunction(() => window.__fitDone === true, { timeout: 5000 });
          const fitWarning = await page.evaluate(() => window.__fitWarning);
          if (fitWarning) warnings.push(`${post.slug} [${lang}/${format}] : ${fitWarning}`);

          const outFile = path.join(outDir, `${post.slug}-${lang}${suffix}.png`);
          await page.screenshot({ path: outFile, clip: { x: 0, y: 0, width, height } });
          console.log(`OK  ${path.relative(ROOT, outFile)}`);
        }
      }
    }
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    await browser.close();
  }

  writeContactSheet(data, outDir, args.month);

  if (warnings.length) {
    console.warn("\nAvertissements :");
    warnings.forEach((w) => console.warn(" - " + w));
  }
  console.log(
    `\nTerminé : ${posts.length} post(s) × ${langs.length} langue(s) × ${formats.length} format(s) → ${path.relative(ROOT, outDir)}`
  );
}

function writeContactSheet(data, outDir, month) {
  const rows = data.posts
    .map((p) => {
      const cap = (lang) =>
        `<pre>${esc(p[lang].caption || "")}\n\n${(p[lang].hashtags || []).join(" ")}</pre>`;
      return `
    <section>
      <h2>${esc(p.date)} — ${esc(p.slug)} <small>(${esc(p.template)} · risque ${esc(p.risk)})</small></h2>
      <div class="pair">
        <figure><img src="${p.slug}-fr.png" alt=""><figcaption>FR${cap("fr")}</figcaption></figure>
        <figure dir="rtl"><img src="${p.slug}-ar.png" alt=""><figcaption>AR${cap("ar")}</figcaption></figure>
      </div>
    </section>`;
    })
    .join("\n");

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>Planche-contact ${esc(month)}</title>
<style>
  body{font-family:"Segoe UI",sans-serif;margin:24px;background:#faf6f7;color:#2b171d}
  h1{color:#800020} h2{color:#800020;font-size:1rem;margin:2rem 0 .5rem} small{color:#888;font-weight:400}
  .pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  figure{margin:0} img{width:100%;border-radius:8px;box-shadow:0 4px 14px rgba(0,0,0,.12)}
  figcaption{font-size:.8rem;margin-top:6px}
  pre{white-space:pre-wrap;background:#fff;border:1px solid #e9d8dd;border-radius:6px;padding:8px;font-family:inherit}
</style></head><body>
<h1>Posts ${esc(month)} — Laboratoire El Allali</h1>
<p>Chaque post : image FR + image AR, avec la légende à copier-coller sous chaque image.</p>
${rows}
</body></html>`;
  fs.writeFileSync(path.join(outDir, "index.html"), html, "utf8");
  console.log(`OK  planche-contact → output/${month}/index.html`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
