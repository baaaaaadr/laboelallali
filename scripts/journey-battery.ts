/**
 * Batterie de vérification du parcours patient — le contenu réellement envoyé.
 *
 * Lancée par `node scripts/test-journey.js` (qui compile ce fichier avec
 * esbuild : le dépôt n'a aucun lanceur de tests, voir CLAUDE.md § Testing).
 *
 * Ce qu'elle couvre, pour les 18 cas de `journey-cases.ts` :
 *  1. l'**e-mail du laboratoire** — objet et HTML, le seul document que le
 *     personnel lise réellement (rien dans l'application ne consulte
 *     `appointmentRequests`) ;
 *  2. le **document Firestore** — dont les valeurs de `status` et `type` sont
 *     contractuelles depuis le lancement ;
 *  3. le **message WhatsApp** ;
 *  4. la **carte des groupes** de `/test-rdv2` — qu'aucune section ne se
 *     retrouve orpheline le jour où quelqu'un en ajoutera une.
 *
 * Elle ne remplace pas le pilote navigateur (`scripts/test-journey-ui.js`) :
 * celui-ci vérifie ce que le patient VOIT, celle-ci ce que le laboratoire
 * REÇOIT. Les deux ont déjà divergé.
 */
import { CASES, JOURNEY_CASES, LEGACY_CASES } from './journey-cases';
import { buildAppointmentEmail } from '../src/lib/email/appointmentEmail';
import { buildWhatsAppMessage, MAX_WA_CHARS } from '../src/lib/journey/buildWhatsAppMessage';
import {
  JOURNEY_GROUP_ORDER,
  JOURNEY_GROUP_SECTIONS,
  groupOfSection,
} from '../src/lib/journey/groups';

const LAB_MAIL = 'laboelallali@gmail.com';

let passed = 0;
const failures: string[] = [];

function check(context: string, label: string, ok: boolean, detail = ''): void {
  if (ok) {
    passed++;
    return;
  }
  failures.push(`${context}\n    → ${label}${detail ? `\n      ${detail}` : ''}`);
}

function contains(context: string, label: string, haystack: string, needle: string): void {
  check(context, label, haystack.includes(needle), `attendu dans la sortie : ${JSON.stringify(needle)}`);
}

function absent(context: string, label: string, haystack: string, needle: string): void {
  check(context, label, !haystack.includes(needle), `ne devait PAS apparaître : ${JSON.stringify(needle)}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1 · E-MAIL DU LABORATOIRE
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── E-mail du laboratoire ────────────────────────────────────────');

for (const c of CASES) {
  const { subject, html, replyTo } = buildAppointmentEmail(c.payload, LAB_MAIL);
  const ctx = `  ${c.name}`;
  const p = c.payload;
  const isJourney = p.source === 'journey';

  // -- invariants valables pour TOUS les cas ---------------------------------
  absent(ctx, 'aucune balise <script> non échappée', html, '<script>');
  absent(ctx, 'aucun "undefined" dans le corps', html, 'undefined');
  absent(ctx, 'aucun "[object Object]"', html, '[object Object]');
  absent(ctx, "aucun tiret suivi de rien dans l'objet", subject, ' -  ');
  check(ctx, "l'objet porte le nom du patient", subject.includes(String(p.nom).slice(0, 8)));
  check(
    ctx,
    'préfixe d\'objet conservé (des filtres de boîte mail s\'appuient dessus)',
    subject.startsWith('Nouveau RDV WEB — ') || subject.startsWith('Nouveau Rendez-vous WEB : '),
    `objet obtenu : ${subject}`
  );
  check(
    ctx,
    'replyTo = e-mail du patient, sinon celui du laboratoire',
    replyTo === (p.email && String(p.email).includes('@') ? p.email : LAB_MAIL),
    `replyTo obtenu : ${replyTo}`
  );

  // -- créneau ---------------------------------------------------------------
  if (isJourney && p.wantsAppointment === false) {
    contains(ctx, 'le corps annonce clairement qu\'aucun créneau n\'est demandé', html, "Aucun pour l'instant");
    absent(ctx, 'pas de "Date souhaitée :" vide', html, '<strong>Date souhaitée :</strong> </p>');
    contains(ctx, "l'objet dit « réponse seulement » au lieu d'un blanc", subject, 'réponse seulement');
  } else if (p.date_souhaitee) {
    contains(ctx, 'la date demandée apparaît', html, p.date_souhaitee);
    contains(ctx, "l'heure demandée apparaît", html, p.heure_souhaitee);
    contains(ctx, "l'objet porte la date", subject, p.date_souhaitee);
  }

  // -- devis -----------------------------------------------------------------
  if (p.cartTotals) {
    contains(ctx, 'le total estimé figure dans le corps', html, 'TOTAL ESTIMÉ');
    contains(ctx, "le montant figure dans l'objet", subject, `DEVIS ${p.cartTotals.total} DH`);
    contains(ctx, 'la réserve « Estimation » accompagne le montant', html, 'Estimation — tarif à confirmer');
  } else if (Array.isArray(p.analyses) && p.analyses.length > 0) {
    // Composition de bilan non résolue : les lignes partent, le montant NON.
    contains(ctx, 'les lignes partent quand même (le personnel voit quoi chiffrer)', html, 'Analyses demandées');
    absent(ctx, 'AUCUN total : il serait sous-évalué', html, 'TOTAL ESTIMÉ');
    absent(ctx, "aucun montant dans l'objet non plus", subject, 'DEVIS');
  }

  // -- lieu de prélèvement ---------------------------------------------------
  if (p.isHomeService) {
    contains(ctx, 'le bloc « Lieu de prélèvement » est présent', html, 'Lieu de prélèvement');
    if (p.adresse && String(p.adresse).trim()) {
      contains(ctx, "l'adresse atteint le laboratoire", html, '<strong>Adresse :</strong>');
      absent(ctx, 'pas de fausse alerte « adresse non renseignée »', html, 'Adresse non renseignée');
    } else if (isJourney && p.wantsAppointment === false) {
      contains(ctx, 'note calme : adresse non encore demandée', html, 'Adresse non demandée pour l\'instant');
      absent(ctx, "PAS d'alerte rouge — le patient n'a rien oublié", html, 'Adresse non renseignée');
    } else {
      contains(ctx, 'alerte rouge : adresse vraiment manquante', html, 'Adresse non renseignée');
    }
  } else {
    absent(ctx, 'pas de bloc lieu pour un rendez-vous au laboratoire', html, 'Lieu de prélèvement');
  }

  // -- ce qui distingue le parcours des deux anciennes pages -----------------
  if (isJourney) {
    absent(ctx, 'le parcours ne répète pas « Service à domicile »', html, 'Service à domicile');
    absent(ctx, "le parcours ne répète pas « Type d'analyse »", html, "Type d'analyse");
    if (p.locale) contains(ctx, 'la langue du patient est annoncée', html, 'Langue du patient');
  } else {
    contains(ctx, "l'ancienne page garde « Type d'analyse »", html, "Type d'analyse");
    contains(ctx, "l'ancienne page garde « Service à domicile »", html, 'Service à domicile');
    absent(ctx, "l'ancienne page n'annonce pas de langue", html, 'Langue du patient');
  }
}

// -- vérifications ciblées, cas par cas ---------------------------------------
{
  const byName = (n: string) => CASES.find((c) => c.name.startsWith(n))!;

  const travail = byName('E ·');
  const mailTravail = buildAppointmentEmail(travail.payload, LAB_MAIL);
  contains('  E · lieu de travail', 'le libellé exact du lieu', mailTravail.html, 'Lieu de travail');
  absent('  E · lieu de travail', 'jamais « Domicile du patient » pour un bureau', mailTravail.html, 'Domicile du patient');
  contains('  E · lieu de travail', "l'objet permet de trier depuis la boîte", mailTravail.subject, 'LIEU DE TRAVAIL');

  const arabe = byName('H ·');
  const mailArabe = buildAppointmentEmail(arabe.payload, LAB_MAIL);
  contains('  H · arabophone', 'la langue est signalée au personnel', mailArabe.html, 'Langue du patient :</strong> Arabe');
  contains('  H · arabophone', 'le libellé du lieu reste FRANÇAIS', mailArabe.html, 'Domicile du patient');
  absent('  H · arabophone', 'aucun libellé arabe dans la boîte française', mailArabe.html, 'المنزل');

  const inj = byName('K ·');
  const mailInj = buildAppointmentEmail(inj.payload, LAB_MAIL);
  contains('  K · injection', 'la balise script est neutralisée', mailInj.html, '&lt;script&gt;');
  contains('  K · injection', "la balise img aussi", mailInj.html, '&lt;img src=x onerror=alert(1)&gt;');
  // ⚠ Chercher la chaîne « onerror=alert » ne prouve RIEN : elle survit,
  // inerte, à l'intérieur de `&lt;img …&gt;`. Ce qui compte est qu'aucune
  // BALISE ne se soit ouverte. Le gabarit de l'e-mail n'en contient
  // lui-même aucune de ces deux-là, donc zéro est la bonne attente.
  check('  K · injection', 'aucune balise <img> ouverte',
    (mailInj.html.match(/<img/g) || []).length === 0);
  check('  K · injection', 'aucune balise <script> ouverte',
    (mailInj.html.match(/<script/g) || []).length === 0);
  absent('  K · injection', 'aucune fermeture de div injectée', mailInj.html, '</div><script>');
  contains('  K · injection', "l'adresse multiligne garde ses retours", mailInj.html, '<br>');
  contains('  K · injection', "les apostrophes du nom sont échappées", mailInj.html, 'O&#39;Brien &amp; fils');

  const gros = byName('L ·');
  const mailGros = buildAppointmentEmail(gros.payload, LAB_MAIL);
  contains('  L · 70 lignes', 'le reste est annoncé', mailGros.html, '… et 10 autre(s) analyse(s)');
  check(
    '  L · 70 lignes',
    'exactement 60 lignes de tableau',
    (mailGros.html.match(/<td style="padding: 6px 0; border-bottom: 1px solid #eee;">/g) || []).length === 60
  );

  const wa = byName('M ·');
  const mailWa = buildAppointmentEmail(wa.payload, LAB_MAIL);
  contains('  M · WhatsApp', "l'arrivée par WhatsApp est signalée", mailWa.html, 'Reçu aussi sur WhatsApp');

  const sansMail = byName('N ·');
  const mailSansMail = buildAppointmentEmail(sansMail.payload, LAB_MAIL);
  absent('  N · sans e-mail', "pas de ligne Email vide", mailSansMail.html, 'mailto:');
  check('  N · sans e-mail', 'replyTo retombe sur le laboratoire', mailSansMail.replyTo === LAB_MAIL);

  const mixte = byName('J ·');
  const mailMixte = buildAppointmentEmail(mixte.payload, LAB_MAIL);
  contains('  J · ordonnance + catalogue', "l'avertissement ne dément pas le total affiché", mailMixte.html, 'ne couvre QUE les analyses choisies');
  absent('  J · ordonnance + catalogue', "pas de « rien n'a pu être chiffré » sous un devis de 335 DH", mailMixte.html, "Rien n'a pu être chiffré");

  const texte = byName('C ·');
  const mailTexte = buildAppointmentEmail(texte.payload, LAB_MAIL);
  contains('  C · texte libre', 'là, « rien de chiffrable » est exact', mailTexte.html, "Rien n'a pu être chiffré");
  contains('  C · texte libre', 'les retours à la ligne du patient survivent', mailTexte.html, 'thyroïde');
}

// ─────────────────────────────────────────────────────────────────────────────
// 2 · DOCUMENT FIRESTORE
// ─────────────────────────────────────────────────────────────────────────────
console.log('── Document appointmentRequests ─────────────────────────────────');

const VALID_STATUS = new Set([
  'new_appointment_request',
  'whatsapp_appointment_request',
  'new_home_service_request',
  'whatsapp_home_service_request',
]);
const VALID_TYPE = new Set(['lab_appointment', 'home_service_appointment']);

for (const c of JOURNEY_CASES) {
  const ctx = `  ${c.name}`;
  const d = c.doc;
  check(ctx, 'statut contractuel', VALID_STATUS.has(String(d.status)), `statut obtenu : ${d.status}`);
  check(ctx, 'type contractuel', VALID_TYPE.has(String(d.type)), `type obtenu : ${d.type}`);
  check(
    ctx,
    'aucun `undefined` (Firestore lève à addDoc)',
    !Object.values(d).some((v) => v === undefined),
    `champs undefined : ${Object.keys(d).filter((k) => d[k] === undefined).join(', ')}`
  );
  check(ctx, 'wantsAppointment est écrit explicitement', typeof d.wantsAppointment === 'boolean');
  // Une date que le patient n'a jamais choisie ne doit jamais atteindre la
  // base : `useLabSchedule` sème `selectedDate` au montage, et le document
  // portait donc un créneau fantôme. Corrigé dans `useJourneySubmission`.
  if (d.wantsAppointment === false) {
    check(ctx, 'aucune date fantôme quand aucun créneau n\'est voulu',
      d.desiredDate === '' && d.desiredTime === '',
      `desiredDate=${JSON.stringify(d.desiredDate)} desiredTime=${JSON.stringify(d.desiredTime)}`);
  }
  check(
    ctx,
    'le lieu « travail » compte comme service à domicile',
    c.snapshot.samplingPlace === 'laboratoire'
      ? d.type === 'lab_appointment'
      : d.type === 'home_service_appointment'
  );
  if (!c.snapshot.cartTotals) {
    check(ctx, 'aucun panier chiffré quand le devis est incomplet', d.cart === null);
  } else {
    check(ctx, 'le panier chiffré est marqué « estimation »', Boolean((d.cart as { estimated?: boolean })?.estimated));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3 · MESSAGE WHATSAPP
// ─────────────────────────────────────────────────────────────────────────────
console.log('── Message WhatsApp ─────────────────────────────────────────────');

for (const c of JOURNEY_CASES) {
  const ctx = `  ${c.name}`;
  const msg = buildWhatsAppMessage(c.snapshot);
  const ar = c.snapshot.lang === 'ar';

  check(ctx, `longueur sous le plafond (${msg.length}/${MAX_WA_CHARS})`, msg.length <= MAX_WA_CHARS);
  absent(ctx, 'aucun "undefined"', msg, 'undefined');
  absent(ctx, 'aucune clé i18n brute', msg, 'journey.');
  contains(ctx, 'le nom du patient est présent', msg, c.snapshot.nom);
  contains(ctx, 'le téléphone est présent', msg, c.snapshot.telephone);

  if (c.snapshot.wantsAppointment) {
    contains(ctx, 'la date demandée apparaît', msg, c.snapshot.desiredDate);
    contains(ctx, "l'heure demandée apparaît", msg, c.snapshot.desiredTime);
  } else {
    // Le défaut que le lot « réponse d'abord » a corrigé : « Date souhaitée :  à  ».
    absent(ctx, 'pas de ligne « Date souhaitée » vide', msg, ar ? 'التاريخ المطلوب' : 'Date souhaitée');
    contains(
      ctx,
      "le message dit pourquoi il n'y a pas de créneau",
      msg,
      ar ? 'لم أحدد بعد موعدًا' : "Je n'ai pas encore choisi de créneau"
    );
  }

  if (c.snapshot.samplingPlace !== 'laboratoire' && c.snapshot.adresse) {
    contains(ctx, "l'adresse voyage aussi par WhatsApp", msg, c.snapshot.adresse.split('\n')[0]);
  }
  if (c.snapshot.cartTotals) {
    contains(
      ctx,
      'le total est annoncé avec sa réserve',
      msg,
      ar ? 'تقدير، الثمن يُؤكَّد بالمختبر' : 'estimation, tarif à confirmer au laboratoire'
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4 · CARTE DES GROUPES (/test-rdv2)
// ─────────────────────────────────────────────────────────────────────────────
console.log('── Regroupement en 4 blocs ──────────────────────────────────────');
{
  const ctx = '  groups.ts';
  check(ctx, 'exactement 4 groupes — la demande du Dr Aziz', JOURNEY_GROUP_ORDER.length === 4,
    `obtenu : ${JOURNEY_GROUP_ORDER.length}`);

  // Les sections produites par `useJourneySections`, hors `answer` (hors
  // accordéon) et `__files` (pseudo-section de dépendance).
  const REAL_SECTIONS = [
    'prescription', 'cart', 'want', 'place', 'when', 'channel', 'identity', 'access',
  ];
  for (const id of REAL_SECTIONS) {
    check(ctx, `la section « ${id} » appartient à un groupe`, groupOfSection(id) !== null,
      'une section orpheline n\'est affichée NULLE PART sur /test-rdv2');
  }
  check(ctx, '`answer` reste hors accordéon', groupOfSection('answer') === null);

  const placed = JOURNEY_GROUP_ORDER.flatMap((g) => JOURNEY_GROUP_SECTIONS[g]);
  check(ctx, 'aucune section placée deux fois', new Set(placed).size === placed.length);
  check(ctx, 'les 8 sections sont couvertes', placed.length === REAL_SECTIONS.length,
    `placées : ${placed.length}, attendues : ${REAL_SECTIONS.length}`);

  // L'ordre porte l'intention : les deux cas fréquents doivent avoir fini
  // AVANT le bloc rendez-vous.
  check(ctx, 'le contact vient avant le rendez-vous',
    JOURNEY_GROUP_ORDER.indexOf('contact') < JOURNEY_GROUP_ORDER.indexOf('rendezvous'),
    "sinon les deux cas fréquents traversent un bloc dont ils n'ont pas besoin");
  check(ctx, 'le facultatif est en dernier',
    JOURNEY_GROUP_ORDER[JOURNEY_GROUP_ORDER.length - 1] === 'plus');
  check(ctx, "l'identité et le canal sont réunis",
    JOURNEY_GROUP_SECTIONS.contact.includes('identity') && JOURNEY_GROUP_SECTIONS.contact.includes('channel'));
  check(ctx, 'le lieu et la date sont réunis',
    JOURNEY_GROUP_SECTIONS.rendezvous.includes('place') && JOURNEY_GROUP_SECTIONS.rendezvous.includes('when'));
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n─────────────────────────────────────────────────────────────────');
console.log(`${passed} vérifications passées, ${failures.length} en échec.`);
console.log(`Cas couverts : ${JOURNEY_CASES.length} du parcours + ${LEGACY_CASES.length} des anciennes pages.`);
if (failures.length > 0) {
  console.log('\nÉCHECS :');
  for (const f of failures) console.log(`\n  ✗ ${f}`);
  process.exit(1);
}
console.log('Tout est vert.');
