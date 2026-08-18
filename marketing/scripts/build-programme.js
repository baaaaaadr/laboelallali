/**
 * Construit le programme éditorial (document client) à partir de
 * marketing/content/programme-editorial.json, en appliquant les corrections
 * issues de la relecture juridique et rédactionnelle.
 * Usage : node marketing/scripts/build-programme.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const data = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "programme-editorial.json"), "utf8"));

/* --------------------------------------------------------------------------
   Trimestre 1 — déjà cadré, en production (pack de lancement)
   -------------------------------------------------------------------------- */
const T1 = {
  key: "T1",
  periode: "septembre → octobre 2026",
  libelle: "Pack de lancement",
  posts: [
    { periode: "mar. 1er sept.", titre_fr: "Le laboratoire vous accueille", type: "informatif", template: "service-info", feu: "vert", fait: true },
    { periode: "ven. 4 sept.", titre_fr: "Vos résultats d'analyses, sur votre téléphone", type: "informatif", template: "service-app", feu: "vert", fait: true },
    { periode: "mar. 8 sept.", titre_fr: "Faut-il être à jeun pour votre prise de sang ?", type: "instructif", template: "preparation-examen", feu: "vert", fait: true },
    { periode: "ven. 11 sept.", titre_fr: "GLABO : le prélèvement à domicile ou au travail", type: "informatif", template: "service-info", feu: "vert" },
    { periode: "mar. 15 sept.", titre_fr: "Que mesure une NFS ?", type: "médical", template: "le-saviez-vous", feu: "vert", fait: true },
    { periode: "ven. 18 sept.", titre_fr: "Les analyses de votre ordonnance, en ligne", type: "informatif", template: "service-app", feu: "vert" },
    { periode: "sam. 19 sept.", titre_fr: "À jeun ? Venez dès 7h30", type: "instructif", template: "annonce", feu: "vert", fait: true },
    { periode: "mar. 22 sept.", titre_fr: "5 erreurs qui faussent vos analyses", type: "instructif", template: "preparation-examen", feu: "vert" },
    { periode: "mar. 29 sept.", titre_fr: "Prenez soin de votre cœur", type: "médical", template: "journee-mondiale", feu: "vert", fait: true },
    { periode: "ven. 2 oct.", titre_fr: "Octobre Rose : la campagne nationale de dépistage", type: "médical", template: "journee-mondiale", feu: "vert" },
    { periode: "mar. 6 oct.", titre_fr: "Prendre rendez-vous avec votre ordonnance en photo", type: "instructif", template: "service-app", feu: "vert" },
    { periode: "ven. 9 oct.", titre_fr: "Dépistage du sein : en parler à son médecin", type: "médical", template: "le-saviez-vous", feu: "orange" },
    { periode: "mar. 13 oct.", titre_fr: "Recueillir un échantillon d'urine sans erreur", type: "instructif", template: "preparation-examen", feu: "vert" },
    { periode: "ven. 16 oct.", titre_fr: "Nous joindre : téléphone, WhatsApp, itinéraire", type: "informatif", template: "service-info", feu: "vert" },
    { periode: "mar. 20 oct.", titre_fr: "Octobre Rose : ce qui augmente le risque", type: "médical", template: "journee-mondiale", feu: "orange" },
    { periode: "ven. 23 oct.", titre_fr: "Rechercher un médecin par spécialité à Agadir", type: "informatif", template: "service-app", feu: "vert" },
    { periode: "mar. 27 oct.", titre_fr: "Ce qu'il faut apporter le jour de l'analyse", type: "instructif", template: "preparation-examen", feu: "vert" },
    { periode: "ven. 30 oct.", titre_fr: "Le laboratoire recrute : comment postuler", type: "informatif", template: "annonce", feu: "vert" },
  ],
};

/* --------------------------------------------------------------------------
   Corrections issues de la relecture (juriste + rédacteur en chef).
   Clé = index 1-based dans le trimestre. null = publication remplacée.
   -------------------------------------------------------------------------- */
const PATCHES = {
  T2: {
    1: { titre_fr: "Novembre : qui est concerné par le diabète", angle: "Relais de la campagne nationale du ministère de la Santé : uniquement les facteurs de risque identifiés par l'OMS (antécédents familiaux, surpoids, sédentarité, âge, hypertension). Les signes d'alerte sont réservés à la publication du 14 novembre." },
    5: { titre_fr: "Accéder à son espace résultats en trois étapes", angle: "Mode d'emploi en trois étapes. La capture d'écran ne montre que l'accueil et l'écran de connexion — jamais une ligne d'examen, un nom ou une valeur." },
    6: { titre_fr: "Santé des hommes : pourquoi consulter plus tôt", type: "médical", template: "le-saviez-vous", angle: "Donnée sourcée OMS sur le moindre recours des hommes au suivi médical, invitation générale à ne pas repousser une consultation. Sans citer Movember (campagne privée étrangère), sans âge cible ni examen." },
    7: { titre_fr: "Antécédents familiaux : pourquoi votre médecin les demande", angle: "À quoi sert l'histoire familiale dans la décision médicale, source OMS, sans nommer aucun examen ni aucun organe. Remplace une publication sur le PSA, jugée trop proche de l'incitation à demander un examen précis." },
    13: null,
    15: { titre_fr: "TSH : le rôle de la thyroïde expliqué", angle: "Le rôle de la thyroïde dans l'organisme et ce que le médecin y cherche, source citée. Dosage sur prescription médicale." },
    16: { titre_fr: "Le devis des analyses de votre ordonnance", angle: "Le point de départ est l'ordonnance : le patient retrouve dans le catalogue les examens prescrits et reçoit un document individuel sur WhatsApp. Aucun montant, aucune fourchette." },
    17: { titre_fr: "Vendredi 1er janvier : nos horaires", angle: "Organisation du laboratoire le vendredi 1er janvier (férié), ouverture du samedi 2 en matinée, retour aux horaires habituels le lundi 4. Horaires exacts à confirmer avant publication." },
    18: { titre_fr: "Bilan prescrit : comment se déroule la visite", angle: "Déroulé concret de la visite : accueil, ordonnance, jeûne éventuel, temps sur place, résultats en ligne. Sans référence au « bilan annuel » de début d'année, qui reviendrait à créer la demande." },
    19: { angle: "Le rôle du foie et ce que le médecin regarde dans un bilan hépatique (ASAT, ALAT, GGT), sans référence à « Dry January » ni à l'alcool. Sur prescription médicale." },
    21: null,
    22: { titre_fr: "Prise de sang de l'enfant : bien l'accompagner", angle: "Conseils aux parents : expliquer avec des mots simples, ne pas promettre qu'il ne sentira rien, apporter un objet rassurant, privilégier la matinée. La durée de jeûne d'un enfant est fixée par le médecin." },
    23: { titre_fr: "Rechercher un médecin par spécialité à Agadir", angle: "Présentation neutre de la fonction de recherche, en français comme en arabe. Sans le mot « gratuitement », sans nom de praticien affiché ni classement." },
  },
  T3: {
    3: { titre_fr: "Analyses à jeun : quel créneau pendant le Ramadan", angle: "Pour les examens qui demandent 8 à 12 heures de jeûne, le meilleur créneau pendant le Ramadan est la fin d'après-midi, avant le ftour — le laboratoire est ouvert jusqu'à 16h30. Beaucoup d'analyses ne demandent aucun jeûne. Aucun avis religieux : la question de la compatibilité avec le jeûne se pose au médecin." },
    4: { periode: "semaine du 1er février", angle: "Publiée avant le début du mois : inviter les personnes diabétiques à faire le point avec leur médecin avant de jeûner. Sur prescription médicale." },
    5: { angle: "Repères généraux d'hydratation de l'OMS, sans inventer un référentiel « Ramadan » qui n'existe pas. Le lien avec le prélèvement est présenté comme un constat pratique de l'équipe." },
    6: { angle: "Retrouver ses bilans sans se déplacer, utile pendant le mois. La capture ne montre que l'écran de connexion ou la liste des années d'un compte de démonstration." },
    8: { titre_fr: "Trouver un médecin à Agadir depuis notre site", type: "informatif", template: "service-app", angle: "L'annuaire d'environ 1 390 médecins d'Agadir, avec recherche par spécialité. Remplace un second rappel des horaires du Ramadan, qui faisait doublon — le rappel passe en story." },
    9: { titre_fr: "Cancer colorectal : en parler avec son médecin", angle: "Ce qu'est le cancer colorectal et les signes qui doivent amener à consulter, source OMS. Sans citer « Mars Bleu » (campagne française) ni aucun seuil d'âge : le dépistage relève du médecin." },
    11: { titre_fr: "8 mars : ne repoussez pas votre suivi", angle: "Beaucoup de femmes font passer leur santé après celle de leur famille : ne pas laisser une consultation ou une ordonnance en attente. Aucun dosage nommé — le 8 mars 2027 tombe dans les derniers jours du Ramadan, parler de fatigue serait mal lu." },
    12: { periode: "lun. 9 mars", angle: "Publiée la veille de l'Aïd, en annonçant la journée mondiale du rein du 11 mars. Le rôle des reins et ce que le médecin surveille." },
    14: { titre_fr: "Préparer sa liste d'analyses avant de venir", angle: "Le catalogue comme outil d'organisation : retrouver les examens de son ordonnance et connaître leurs conditions de préparation. Sans faire du devis, donc du prix, le sujet de la publication." },
    17: { titre_fr: "Rhume ou allergie de printemps ?", angle: "Les symptômes du printemps et pourquoi seule une consultation permet de faire la différence. Sans nommer aucun dosage." },
    18: { angle: "Les trois étapes de la prise de rendez-vous. L'ordonnance montrée est entièrement fictive : aucun nom de patient, aucun cachet de médecin, aucun médicament lisible." },
    21: { angle: "Ordonnance, pièce d'identité, carte de mutuelle ou d'assurance (formulation générique, sans nommer d'organisme), anciens résultats pour la comparaison." },
    24: { titre_fr: "Semaine de la vaccination : faites le point sur votre carnet", angle: "Relais de la campagne OMS : ressortir son carnet et celui de ses enfants, en parler à son médecin ou à son centre de santé. Sans mention de sérologie de contrôle." },
  },
  T4: {
    1: { periode: "semaine du 17 mai", titre_fr: "Une fatigue qui dure : plusieurs causes possibles", angle: "Une fatigue prolongée a de multiples causes ; aucun bilan ne se décide seul. Source citée, aucune analyse nommée." },
    3: { periode: "semaine du 10 mai", titre_fr: "Aïd al-Adha : organisation du laboratoire", angle: "Publiée AVANT la fête (attendue vers le 16-19 mai selon l'annonce officielle) : le laboratoire adapte ses horaires, les horaires définitifs seront publiés dès l'annonce officielle. Anticiper les prélèvements programmés." },
    4: { titre_fr: "Pourquoi apporter vos anciens résultats", type: "instructif", template: "preparation-examen", angle: "Comparer un résultat à ceux des contrôles précédents aide le médecin : comment retrouver ses anciens bilans et les apporter le jour de l'analyse." },
    6: { titre_fr: "L'acide urique, un déchet éliminé par les reins", angle: "D'où vient l'acide urique et comment il est éliminé, source citée. Sans évoquer de symptôme ni de liste d'aliments, qui transformeraient la publication en incitation." },
    10: { titre_fr: "GLABO : le prélèvement à domicile ou au travail", angle: "Description factuelle du service : un membre du personnel du laboratoire se déplace, sur rendez-vous et sur ordonnance. Sans s'adresser à un tiers pour inscrire un proche âgé." },
    12: { titre_fr: "Ce que devient votre tube de sang au laboratoire", type: "informatif", template: "le-saviez-vous", angle: "Les étapes entre le prélèvement, l'acheminement, l'analyse et la validation par le biologiste. Sans citer d'examen ni annoncer de délai." },
    13: { titre_fr: "Vos questions par WhatsApp : ce que l'on peut vous répondre", type: "informatif", template: "service-info", angle: "Ce que l'équipe peut traiter par message (horaires, préparation, organisation d'un prélèvement à domicile) et ce qui relève du médecin : aucun résultat ni avis médical par messagerie." },
    14: { titre_fr: "Les analyses de votre ordonnance, en ligne", angle: "Retrouver les analyses prescrites et préparer sa venue. L'estimation personnalisée est mentionnée en une ligne, jamais dans le titre ni sur le visuel." },
    17: { titre_fr: "Sodium et potassium : ce que le médecin surveille", angle: "L'équilibre des sels minéraux dans le sang et pourquoi le médecin peut demander un ionogramme. Sans reprendre l'argument « forte chaleur », déjà traité en juin." },
    18: { angle: "Checklist avant le départ : emporter ses ordonnances en cours et ses derniers comptes rendus, vérifier avec son médecin s'il faut renouveler une ordonnance. Sans mention de l'application, traitée la semaine suivante." },
    20: { titre_fr: "Vitamine D : son rôle dans l'organisme", angle: "Le rôle de la vitamine D et la contribution de l'exposition solaire habituelle, source citée. Sans laisser entendre que chacun devrait se faire doser." },
    21: { titre_fr: "Chaleur et repas d'été : les bons réflexes", type: "médical", template: "le-saviez-vous", angle: "Conservation des aliments, lavage des mains, eau de boisson par forte chaleur, source OMS. Consulter en cas de troubles digestifs qui durent." },
    22: { titre_fr: "Signaler un malaise avant la prise de sang", angle: "Le malaise pendant un prélèvement est fréquent et sans gravité : le signaler à l'accueil pour être installé allongé, et les gestes qui aident." },
  },
};

/* Publications ajoutées après relecture (jours fériés non couverts) */
const AJOUTS = {
  T2: [
    { apres: 1, post: { periode: "ven. 6 novembre", titre_fr: "Vendredi 6 novembre : nos horaires", angle: "Anniversaire de la Marche Verte : organisation du laboratoire ce jour-là et reprise des horaires habituels. Horaires exacts à confirmer avant publication.", type: "informatif", template: "annonce", feu: "vert" } },
    { apres: 6, post: { periode: "mer. 18 novembre", titre_fr: "Mercredi 18 novembre : nos horaires", angle: "Fête de l'Indépendance : organisation du laboratoire ce jour-là et reprise des horaires habituels. Horaires exacts à confirmer avant publication.", type: "informatif", template: "annonce", feu: "vert" } },
  ],
};

const LIBELLES = {
  T2: "Pack trimestriel 1",
  T3: "Pack trimestriel 2",
  T4: "Pack trimestriel 3",
};

function applique(t) {
  const patches = PATCHES[t.key] || {};
  let posts = t.posts
    .map((p, i) => {
      const patch = patches[i + 1];
      if (patch === null) return null;
      return patch ? { ...p, ...patch, corrige: true } : p;
    })
    .filter(Boolean);

  for (const { apres, post } of (AJOUTS[t.key] || []).slice().reverse()) {
    posts.splice(apres, 0, { ...post, corrige: true });
  }
  return { ...t, libelle: LIBELLES[t.key] || t.key, posts };
}

const trimestres = [T1, ...data.trimestres.map(applique)];

/* --------------------------------------------------------------------------
   Rendu du document
   -------------------------------------------------------------------------- */
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const MODELES = {
  "service-info": "Info pratique",
  "le-saviez-vous": "Le saviez-vous",
  "journee-mondiale": "Journée mondiale",
  "preparation-examen": "Préparation",
  "service-app": "Service en ligne",
  annonce: "Annonce",
};

const sections = trimestres
  .map((t) => {
    const compte = { instructif: 0, informatif: 0, médical: 0 };
    t.posts.forEach((p) => compte[p.type]++);
    const lignes = t.posts
      .map(
        (p, i) => `
      <tr>
        <td class="num">${i + 1}</td>
        <td class="per">${esc(p.periode)}</td>
        <td><b>${esc(p.titre_fr)}</b>${p.angle ? `<span class="angle">${esc(p.angle)}</span>` : ""}</td>
        <td><span class="tag t-${p.type === "médical" ? "med" : p.type === "instructif" ? "ins" : "inf"}">${esc(p.type)}</span></td>
        <td class="mod">${esc(MODELES[p.template] || p.template)}</td>
        <td class="feu"><span class="dot ${p.feu}"></span></td>
      </tr>`
      )
      .join("");
    return `
  <section>
    <div class="thead">
      <h2>${esc(t.libelle)} — ${esc(t.periode)}</h2>
      <p class="meta">${t.posts.length} publications · ${compte.médical} médicales, ${compte.instructif} instructives, ${compte.informatif} informatives${t.key === "T1" ? " · en production" : ""}</p>
    </div>
    <div class="tablewrap">
      <table>
        <thead><tr><th></th><th>Quand</th><th>Publication</th><th>Type</th><th>Modèle</th><th>Feu</th></tr></thead>
        <tbody>${lignes}</tbody>
      </table>
    </div>
  </section>`;
  })
  .join("\n");

const total = trimestres.reduce((n, t) => n + t.posts.length, 0);

const html = `<title>Programme Éditorial El Allali</title>
<style>
  :root { --paper:#FFFFFF; --surface:#FAF3F5; --ink:#2B171D; --muted:#6E5A60; --line:#E9D8DD; --brand:#800020; --accent:#FF4081;
          --ok:#1E7B4F; --warn:#A05A0B; --ins:#0369A1; --inf:#6E5A60; --med:#800020; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
    --paper:#1F1014; --surface:#2A161C; --ink:#F4E9EC; --muted:#C9ADB6; --line:#4A2F37; --brand:#FF79A8; --accent:#FF79A8;
    --ok:#7ED9A7; --warn:#F0B86B; --ins:#7FC4E8; --inf:#C9ADB6; --med:#FF79A8; } }
  :root[data-theme="dark"] { --paper:#1F1014; --surface:#2A161C; --ink:#F4E9EC; --muted:#C9ADB6; --line:#4A2F37; --brand:#FF79A8; --accent:#FF79A8;
    --ok:#7ED9A7; --warn:#F0B86B; --ins:#7FC4E8; --inf:#C9ADB6; --med:#FF79A8; }
  body { background:var(--paper); color:var(--ink); font-family:"Segoe UI",system-ui,sans-serif; line-height:1.5; margin:0; padding:2.5rem 1.25rem 4rem; }
  .sheet { max-width:900px; margin:0 auto; }
  .eyebrow { text-transform:uppercase; letter-spacing:.14em; font-size:.72rem; font-weight:600; color:var(--accent); margin:0 0 .4rem; }
  h1 { color:var(--brand); font-size:1.75rem; line-height:1.15; margin:0 0 .4rem; text-wrap:balance; }
  .lede { color:var(--muted); font-size:.95rem; margin:0 0 1.6rem; max-width:70ch; }
  .cadre { background:var(--surface); border-inline-start:4px solid var(--accent); border-radius:0 6px 6px 0; padding:.8rem 1rem; font-size:.9rem; margin:0 0 1.4rem; }
  .cadre b { color:var(--brand); }
  .legende { display:flex; flex-wrap:wrap; gap:1.2rem; font-size:.82rem; color:var(--muted); margin:0 0 2rem; padding:.7rem 1rem; background:var(--surface); border:1px solid var(--line); border-radius:6px; }
  .legende span { display:inline-flex; align-items:center; gap:.4rem; }
  section { margin:0 0 2.4rem; }
  .thead { border-bottom:2px solid var(--brand); padding-bottom:.3rem; margin-bottom:.6rem; }
  h2 { color:var(--brand); font-size:1.08rem; margin:0; }
  .meta { color:var(--muted); font-size:.8rem; margin:.15rem 0 0; }
  .tablewrap { overflow-x:auto; }
  table { width:100%; border-collapse:collapse; font-size:.88rem; }
  th { text-align:start; text-transform:uppercase; letter-spacing:.06em; font-size:.68rem; color:var(--muted); border-bottom:1px solid var(--line); padding:.35rem .5rem; }
  td { border-bottom:1px solid var(--line); padding:.5rem; vertical-align:top; }
  td.num { color:var(--muted); font-variant-numeric:tabular-nums; width:2rem; }
  td.per { white-space:nowrap; color:var(--muted); font-size:.82rem; width:10rem; }
  td.mod { color:var(--muted); font-size:.8rem; white-space:nowrap; }
  td.feu { text-align:center; width:3rem; }
  .angle { display:block; color:var(--muted); font-size:.82rem; margin-top:.2rem; }
  .tag { font-size:.72rem; text-transform:uppercase; letter-spacing:.04em; white-space:nowrap; }
  .t-med { color:var(--med); } .t-ins { color:var(--ins); } .t-inf { color:var(--inf); }
  .dot { width:.7rem; height:.7rem; border-radius:50%; display:inline-block; }
  .dot.vert { background:var(--ok); } .dot.orange { background:var(--warn); }
  .foot { margin-top:2rem; padding-top:.9rem; border-top:1px solid var(--line); color:var(--muted); font-size:.82rem; }
  @media print {
    :root { --paper:#fff; --surface:#fff; --ink:#111; --muted:#444; --line:#bbb; --brand:#800020; --accent:#800020; }
    body { padding:0; font-size:10px; }
    section, tr { break-inside:avoid; }
  }
</style>
<div class="sheet">
  <p class="eyebrow">Laboratoire El Allali · Programme éditorial</p>
  <h1>Ce que le laboratoire publiera, de septembre 2026 à juillet 2027</h1>
  <p class="lede">${total} publications déjà cadrées, réparties en quatre packs. Chaque publication est livrée en quatre visuels — carré français et arabe pour le fil d'actualité, story verticale française et arabe — avec sa légende rédigée dans les deux langues.</p>

  <p class="cadre"><b>Comment ça marche :</b> le pack de lancement couvre septembre et octobre. Ensuite, un pack tous les trois mois, commandé quand le laboratoire le souhaite — aucun engagement. Les titres ci-dessous sont arrêtés à l'avance : le laboratoire sait ce qu'il achète avant de commander. Ils restent ajustables selon l'actualité du laboratoire, et une <b>annonce express</b> peut s'intercaler à tout moment (fermeture, nouvelle analyse, recrutement).</p>

  <div class="legende">
    <span><b style="color:var(--med)">MÉDICAL</b> éducation santé, toujours sourcée</span>
    <span><b style="color:var(--ins)">INSTRUCTIF</b> comment bien se préparer</span>
    <span><b style="color:var(--inf)">INFORMATIF</b> services et vie du laboratoire</span>
    <span><span class="dot vert"></span> publiable tel quel</span>
    <span><span class="dot orange"></span> relecture conseillée avant publication</span>
  </div>

${sections}

  <p class="foot">Chaque publication a été relue sous l'angle juridique (réglementation marocaine sur la communication des laboratoires) et rédactionnel avant d'entrer dans ce programme : pas de prix, pas de promotion, pas de témoignage de patient, pas de superlatif, source citée pour tout contenu d'éducation santé, et mention « sur prescription médicale » dès qu'un examen est nommé. Les dates des jours fériés et des fêtes religieuses sont indicatives et seront confirmées avant publication.</p>
</div>`;

const out = path.join(ROOT, "docs", "programme-editorial.html");
fs.writeFileSync(out, html, "utf8");
console.log(`OK  ${path.relative(ROOT, out)} — ${trimestres.length} packs, ${total} publications`);
trimestres.forEach((t) => console.log(`    ${t.libelle} (${t.periode}) : ${t.posts.length}`));
