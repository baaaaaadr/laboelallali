/**
 * Fusionne les 12 publications rédigées par le workflow dans posts.json,
 * en appliquant les corrections de la relecture juridique et arabe.
 * Usage : node marketing/scripts/merge-posts.js <sortie-workflow.json> [--list]
 *   --list : affiche seulement les corrections (pour revue), n'écrit rien.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const src = process.argv[2];
const listOnly = process.argv.includes("--list");
if (!src) {
  console.error("Usage: node marketing/scripts/merge-posts.js <fichier.json> [--list]");
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(src, "utf8"));
const lots = (raw.result || raw).lots;

if (listOnly) {
  for (const lot of lots) {
    console.log(`\n===== LOT ${lot.key} — ${lot.problemes.length} correction(s)`);
    lot.problemes.forEach((p) => {
      console.log(`\n  [${p.slug}] ${p.champ}`);
      console.log(`  PB  : ${p.probleme.slice(0, 150)}`);
      console.log(`  FIX : ${p.correction.slice(0, 500)}`);
    });
  }
  process.exit(0);
}

/* Métadonnées visuelles de chaque publication (date, modèle, fond).
   Équilibre voulu : environ la moitié en fond photo, l'autre en dégradé. */
const META = {
  "04-glabo-domicile": { date: "2026-09-11", template: "service-info", risk: "vert", mode: "photo", accent: "bordeaux", background: "hero-banner.jpg" },
  "06-analyses-ordonnance-en-ligne": { date: "2026-09-18", template: "service-app", risk: "vert", mode: "brand", accent: "bordeaux", screenshot: "../assets/screenshots/mobile-home-{lang}.png" },
  "08-erreurs-qui-faussent": { date: "2026-09-22", template: "preparation-examen", risk: "vert", mode: "brand", accent: "pale" },
  "10-octobre-rose-campagne": { date: "2026-10-02", template: "journee-mondiale", risk: "vert", mode: "photo", accent: "bordeaux", veil: "fuchsia", background: "cellules-micro.jpg" },
  "11-rdv-ordonnance-photo": { date: "2026-10-06", template: "service-app", risk: "vert", mode: "brand", accent: "bordeaux", screenshot: "../assets/screenshots/mobile-home-{lang}.png" },
  "12-depistage-sein-medecin": { date: "2026-10-09", template: "le-saviez-vous", risk: "orange", mode: "brand", accent: "fuchsia" },
  "13-echantillon-urine": { date: "2026-10-13", template: "preparation-examen", risk: "vert", mode: "brand", accent: "pale" },
  "14-nous-joindre": { date: "2026-10-16", template: "service-info", risk: "vert", mode: "photo", accent: "bordeaux", background: "tubes-labo.jpg" },
  "15-octobre-rose-facteurs": { date: "2026-10-20", template: "journee-mondiale", risk: "orange", mode: "photo", accent: "bordeaux", veil: "fuchsia", background: "coeur-modele.jpg" },
  "16-annuaire-medecins": { date: "2026-10-23", template: "service-app", risk: "vert", mode: "brand", accent: "bordeaux", screenshot: "../assets/screenshots/mobile-home-{lang}.png" },
  "17-quoi-apporter": { date: "2026-10-27", template: "preparation-examen", risk: "vert", mode: "photo", accent: "bordeaux", background: "tubes-labo.jpg" },
  "18-laboratoire-recrute": { date: "2026-10-30", template: "annonce", risk: "vert", mode: "brand", accent: "bordeaux" },
};

/* Corrections retenues après relecture. Chemin -> texte de remplacement. */
const PATCHES = {
  "04-glabo-domicile": {
    "fr.lines.1": "Il est effectué par un membre du personnel du Laboratoire El Allali",
    "fr.caption": "Avec GLABO, c'est le laboratoire qui se déplace : le prélèvement est réalisé chez vous ou sur votre lieu de travail.\nIl est effectué par un membre du personnel du Laboratoire El Allali.\nLe service fonctionne sur rendez-vous et sur prescription médicale, aux horaires d'ouverture du laboratoire.\nPour convenir d'un passage, appelez-nous ou écrivez-nous sur WhatsApp 🏠\n📞 05 28 84 33 84 · WhatsApp 06 54 07 95 92\n🌐 www.laboelallali.com",
    "ar.title": "غلابو: نأتي إليكم لسحب العينة",
    "ar.lines.1": "يقوم به أحد موظفي مختبر العلالي المكلَّفين بسحب العينات",
    "ar.lines.3": "حدّدوا موعد الزيارة عبر الهاتف أو عبر الواتساب",
    "ar.caption": "مع خدمة غلابو، المختبر هو الذي يتنقل إليكم: يتم سحب العينة في منزلكم أو في مكان عملكم.\nيقوم بذلك أحد موظفي مختبر العلالي المكلَّفين بسحب العينات.\nتُقدَّم الخدمة بموعد مسبق وبناءً على وصفة طبية، خلال أوقات عمل المختبر.\nلتحديد موعد الزيارة، اتصلوا بنا أو راسلونا عبر الواتساب 🏠\n📞 05 28 84 33 84 · واتساب 06 54 07 95 92\n🌐 www.laboelallali.com",
  },
  "06-analyses-ordonnance-en-ligne": {
    "fr.caption": "Avant votre visite, le catalogue en ligne vous aide à vous organiser : retrouvez une à une les analyses inscrites sur votre ordonnance.\nPour chacune, vous voyez les conditions de préparation — à jeun ou non, type de prélèvement.\nVous pouvez ensuite envoyer votre demande au laboratoire directement depuis votre téléphone 📱\nAnalyses réalisées sur prescription médicale.\nLe laboratoire vous répond ensuite par WhatsApp pour organiser votre passage.\n🌐 www.laboelallali.com · 📞 05 28 84 33 84 · WhatsApp 06 54 07 95 92",
    "ar.caption": "قبل زيارتكم للمختبر، يساعدكم الدليل الإلكتروني على التنظيم: ابحثوا عن كل تحليل مسجَّل في وصفتكم الطبية.\nستجدون لكل تحليل شروط التحضير — الصيام أو عدمه، ونوع العينة المطلوبة.\nبعدها يمكنكم إرسال طلبكم إلى المختبر مباشرة من هاتفكم 📱\nتُجرى التحاليل بوصفة طبية.\nيجيبكم المختبر بعد ذلك عبر الواتساب لتنظيم زيارتكم.\n🌐 www.laboelallali.com · 📞 05 28 84 33 84 · واتساب 06 54 07 95 92",
  },
  "10-octobre-rose-campagne": {
    "fr.lines.1": "Cette campagne vise la détection précoce du cancer du sein et du col utérin.",
    "ar.caption": "🎗️ أكتوبر الوردي: طوال شهر أكتوبر، تقود وزارة الصحة والحماية الاجتماعية ومؤسسة للا سلمى الحملة الوطنية للتحسيس والكشف المبكر عن سرطان الثدي وعنق الرحم.\nمختبر العلالي يساهم في نشر هذه الحملة بين مرتاديه.\nما ينبغي فعله يُقرَّر مع أحد مهنيي الصحة: تحدثوا إلى طبيبكم، فهو من يوجّهكم حسب حالتكم.\nكل التحاليل الطبية تُنجز بناءً على وصفة طبية.\nمختبر العلالي — 61 مكرر، زنقة مراكش، أكادير. الهاتف 05 28 84 33 84 · واتساب 06 54 07 95 92.",
  },
  "12-depistage-sein-medecin": {
    "ar.lines.0": "عندما يُكتشف سرطان الثدي مبكراً، يكون التكفل به في ظروف أفضل.",
    "ar.lines.2": "طبيبكم هو من يحدد الفحوصات المفيدة حسب سنّكم وتاريخكم الصحي.",
    "ar.lines.3": "تحدثوا إلى طبيبكم، حتى إن لم تظهر عليكم أي أعراض.",
    "ar.caption": "هل تعلم؟ كلما اكتُشف سرطان الثدي مبكراً، كان التكفل به في ظروف أفضل. 🎗️\nلا توجد قاعدة واحدة صالحة لجميع النساء: وتيرة الفحوصات ونوعها يتوقفان على السن وعلى التاريخ الصحي الشخصي والعائلي.\nطبيبكم هو من يقيّم حالتكم ويوجّهكم. تحدثوا إلى طبيبكم، حتى إن لم تشعروا بأي شيء غير عادي.\nفي المختبر، كل التحاليل الطبية تُنجز بناءً على وصفة طبية.\nمختبر العلالي — 61 مكرر، زنقة مراكش، أكادير. الهاتف 05 28 84 33 84 · واتساب 06 54 07 95 92. www.laboelallali.com",
  },
  "15-octobre-rose-facteurs": {
    "fr.lines.2": "Bouger, ne pas fumer et éviter l'alcool restent à votre portée.",
  },
  "18-laboratoire-recrute": {
    "fr.lines.1": "Déposez votre CV au bureau d'accueil, avec quelques mots de motivation",
    "fr.lines.3": "Chaque candidature est examinée en fonction des besoins du laboratoire",
    "fr.caption": "Le Laboratoire El Allali étudie les candidatures 👋\nVous souhaitez rejoindre notre équipe, en poste ou en stage ? Déposez votre CV au bureau d'accueil du laboratoire, avec quelques mots sur vos motivations, ou envoyez-le à laboelallali@gmail.com.\nPrécisez le poste qui vous intéresse, votre formation et vos disponibilités.\nChaque candidature reçue est examinée avec attention, en fonction des besoins du laboratoire.\nLaboratoire El Allali — 61 Bis, rue de Marrakech, Agadir · 05 28 84 33 84",
    "ar.lines.1": "أودعوا سيرتكم الذاتية في مكتب الاستقبال مع بضع كلمات عن دوافعكم",
    "ar.lines.3": "كل ترشيح يُدرس حسب حاجيات المختبر",
    "ar.caption": "مختبر العلالي يدرس طلبات الترشيح 👋\nترغبون في الانضمام إلى فريقنا، للعمل أو للتدريب؟ أودعوا سيرتكم الذاتية في مكتب الاستقبال بالمختبر مع بضع كلمات عن دوافعكم، أو أرسلوها إلى laboelallali@gmail.com.\nحدّدوا المنصب الذي يهمكم، وتكوينكم، والفترة التي تكونون فيها متاحين.\nكل ترشيح يصلنا يُدرس بعناية حسب حاجيات المختبر.\nمختبر العلالي — 61 مكرر، زنقة مراكش، أكادير · 05 28 84 33 84",
  },
  "11-rdv-ordonnance-photo": {
    "ar.lines.0": "اختاروا التوقيت المناسب: لا تُعرض إلا المواعيد المتاحة فعلاً.",
    "ar.caption": "حجز موعدكم بالمختبر أصبح متاحاً عبر الإنترنت على www.laboelallali.com 📅\n1) تختارون التوقيت المناسب: لا تظهر إلا المواعيد المتاحة فعلاً.\n2) ترفقون صورة الوصفة الطبية من هاتفكم.\n3) يصلكم تأكيد الموعد بعد المصادقة على طلبكم.\nكل تحليل طبي يتم بوصفة طبية، ولأي سؤال حول تحاليلكم تحدثوا مع طبيبكم. الوصفة الظاهرة في الصورة نموذج وهمي.\n61 مكرر، زنقة مراكش، أكادير — الهاتف 05 28 84 33 84 — واتساب 06 54 07 95 92",
  },
  "14-nous-joindre": {
    "ar.eyebrow": "التواصل مع المختبر",
    "ar.lines.2": "الموقع يبيّن في الوقت الفعلي ما إذا كان المختبر مفتوحاً والطريق إليه.",
    "ar.caption": "هناك عدة طرق بسيطة للتواصل مع المختبر. 📞\nالهاتف: 05 28 84 33 84، من الاثنين إلى الجمعة من 7:30 إلى 18:30، والسبت من 7:30 إلى 13:00.\nواتساب: 06 54 07 95 92 للأسئلة العملية وتنظيم زيارتكم.\nالشركات وطب الشغل: خط خاص 06 61 20 86 35.\nعلى موقع www.laboelallali.com تعرفون في الوقت الفعلي ما إذا كان المختبر مفتوحاً، وتفتحون الطريق إليه بضغطة واحدة.\nلا تُعطى أي نتيجة ولا استشارة طبية عبر الهاتف أو الرسائل؛ لذلك تحدثوا مع طبيبكم أو مرّوا إلى مكتب الاستقبال بالمختبر، 61 مكرر، زنقة مراكش، أكادير.",
  },
  "16-annuaire-medecins": {
    "fr.lines.2": "L'annuaire est présenté sans classement ni mise en avant d'un praticien.",
    "ar.eyebrow": "دليل الأطباء",
    "ar.lines.2": "يُعرض الدليل دون أي ترتيب أو تفضيل لطبيب على آخر.",
    "ar.caption": "تبحثون عن طبيب بأكادير؟ دليل الموقع يضم حوالي 1390 طبيباً بالمدينة. 🩺\nتبحثون حسب التخصص وحسب الجماعة، بالفرنسية وبالعربية.\nبضغطة واحدة تتصلون بالعيادة أو تفتحون الطريق إليها من هاتفكم.\nالدليل يُعرض دون أي ترتيب تفضيلي ودون إبراز لطبيب على آخر: الهدف منه هو التوجيه فقط.\nكل تحليل طبي يتم بوصفة طبية: تحدثوا مع طبيبكم.\nwww.laboelallali.com — 61 مكرر، زنقة مراكش، أكادير — 05 28 84 33 84 — واتساب 06 54 07 95 92",
  },
  "17-quoi-apporter": {
    "fr.caption": "Le jour de votre passage au laboratoire, quatre choses à préparer. 📋\nL'ordonnance de votre médecin : toute analyse de biologie médicale se fait sur prescription médicale.\nUne pièce d'identité au nom de la personne prélevée.\nVotre carte de mutuelle ou d'assurance maladie, si vous en disposez.\nVos anciens résultats : ils permettent au biologiste de comparer avec votre nouveau bilan.\nUne question avant votre passage ? Appelez le 05 28 84 33 84 ou écrivez sur WhatsApp au 06 54 07 95 92 — 61 Bis, rue de Marrakech, Agadir.",
    "ar.lines.1": "خذوا معكم بطاقة التعريف باسم الشخص المعني بالتحاليل.",
    "ar.lines.3": "لا تنسوا نتائجكم السابقة، فهي تسمح بمقارنتها بالتحاليل الجديدة.",
    "ar.caption": "يوم زيارتكم للمختبر، هذه أربعة أشياء تحضرونها معكم. 📋\nوصفة طبيبكم: كل تحليل طبي يتم بوصفة طبية.\nبطاقة التعريف باسم الشخص المعني بسحب الدم أو بالتحاليل.\nبطاقة التأمين أو التغطية الصحية، إن كانت لديكم.\nنتائجكم السابقة: تمكّن البيولوجي المختص من مقارنتها بالتحاليل الجديدة.\nلأي سؤال قبل زيارتكم، اتصلوا بالرقم 05 28 84 33 84 أو راسلونا على واتساب 06 54 07 95 92 — 61 مكرر، زنقة مراكش، أكادير.",
  },
};

function applyPatch(post, chemin, valeur) {
  const parts = chemin.split(".");
  let cur = post;
  for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
  cur[parts[parts.length - 1]] = valeur;
}

const nouveaux = [];
for (const lot of lots) {
  for (const p of lot.posts) {
    const meta = META[p.slug];
    if (!meta) {
      console.warn(`ATTENTION : pas de métadonnées pour ${p.slug}, publication ignorée`);
      continue;
    }
    const post = { slug: p.slug, ...meta, fr: p.fr, ar: p.ar };
    for (const [chemin, valeur] of Object.entries(PATCHES[p.slug] || {})) {
      applyPatch(post, chemin, valeur);
    }
    nouveaux.push(post);
  }
}

const file = path.join(ROOT, "content", "2026-09", "posts.json");
const data = JSON.parse(fs.readFileSync(file, "utf8"));
const existants = new Set(data.posts.map((p) => p.slug));
const ajouts = nouveaux.filter((p) => !existants.has(p.slug));

data.posts = [...data.posts, ...ajouts].sort((a, b) => a.date.localeCompare(b.date));
data.note = "Pack de lancement : 18 publications de septembre et octobre 2026, chacune en 4 visuels (carré et story, français et arabe).";
fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");

console.log(`OK  ${ajouts.length} publication(s) ajoutée(s) — total ${data.posts.length}`);
data.posts.forEach((p) => console.log(`    ${p.date}  ${p.slug}`));
