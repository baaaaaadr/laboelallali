/**
 * The two e-mails of an application (« Emploi & Stage », 08/10/2026):
 *  - the ALERT to the lab (French — the staff's language), with everything
 *    needed to decide whether to look further, and the link to the admin tab;
 *  - the ACKNOWLEDGEMENT to the candidate, in the language of the page he used.
 *
 * Both go through `renderAlertEmail`, which escapes every value itself: pass
 * RAW strings here (escaping twice shows « L&#39;Allali » in the inbox).
 * The candidate's own words (name, city…) are untrusted input: they only ever
 * appear as escaped table values, and the acknowledgement quotes nothing but
 * his first name — so the form cannot be used to send a crafted message to a
 * third party under the lab's name.
 */
import { renderAlertEmail } from "../email/mailer";
import { ageOn, ApplicationForm, Kind, withoutControls } from "./applicationRules";

export const KIND_FR: Record<Kind, string> = {
  observation: "Stage d'observation",
  preembauche: "Stage pré-embauche",
  emploi: "Candidature à un poste",
  spontanee: "Candidature spontanée",
};
const KIND_AR: Record<Kind, string> = {
  observation: "تدريب استطلاعي",
  preembauche: "تدريب ما قبل التوظيف",
  emploi: "ترشيح لمنصب شغل",
  spontanee: "ترشيح تلقائي",
};
export const POSITION_FR: Record<string, string> = {
  technicien: "Technicien(ne) de laboratoire",
  prelevement: "Prélèvement (infirmier·ère, préleveur)",
  accueil: "Accueil et secrétariat",
  coursier: "Coursier",
  entretien: "Entretien",
  biologiste: "Biologiste",
  autre: "Autre",
};
const POSITION_AR: Record<string, string> = {
  technicien: "تقني(ة) مختبر",
  prelevement: "أخذ العينات (ممرض·ة)",
  accueil: "الاستقبال والسكرتارية",
  coursier: "ساعي",
  entretien: "النظافة",
  biologiste: "بيولوجي(ة)",
  autre: "أخرى",
};
const SCHOOL_FR: Record<string, string> = {
  college_lycee: "collège / lycée",
  universite: "université / école supérieure",
  formation_pro: "formation professionnelle",
};
const DURATION_FR: Record<string, string> = {
  "1_semaine": "1 semaine",
  "2_semaines": "2 semaines",
  "1_mois": "1 mois",
  "2_mois": "2 mois",
  "3_mois_plus": "3 mois ou plus",
};
const DIPLOMA_FR: Record<string, string> = {
  aucun: "Sans diplôme",
  niveau_bac: "Niveau bac",
  bac: "Baccalauréat",
  bac2: "Bac+2 (DTS, BTS, DUT…)",
  licence: "Licence (bac+3)",
  master: "Master (bac+5)",
  doctorat: "Doctorat, pharmacie, médecine",
  autre: "Autre",
};
const EXPERIENCE_FR: Record<string, string> = {
  debutant: "Débutant(e)",
  moins_1: "Moins d'un an",
  "1_3": "1 à 3 ans",
  plus_3: "Plus de 3 ans",
};
const VEHICLE_FR: Record<string, string> = { aucun: "aucun", moto: "moto / scooter", voiture: "voiture" };
const LANGUAGE_FR: Record<string, string> = {
  arabe: "arabe",
  amazighe: "amazighe",
  francais: "français",
  anglais: "anglais",
  espagnol: "espagnol",
};
const SOURCE_FR: Record<string, string> = {
  bouche_a_oreille: "Bouche-à-oreille",
  facebook: "Facebook",
  instagram: "Instagram",
  google: "Google",
  ecole: "École / centre de formation",
  affiche: "Affiche au laboratoire",
  autre: "Autre",
};

/** "2026-10-08" → "08/10/2026". */
export function frDay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** One line, no control characters — an e-mail SUBJECT is a header. */
const oneLine = (s: string): string => withoutControls(s).replace(/\s+/g, " ").trim();

export function positionLabel(f: Pick<ApplicationForm, "position" | "positionOther">, lang: "fr" | "ar" = "fr"): string {
  if (!f.position) return "";
  if (f.position === "autre" && f.positionOther) return f.positionOther;
  return (lang === "ar" ? POSITION_AR : POSITION_FR)[f.position] || f.position;
}

/** What the candidate asked for, in one phrase: type, then position. */
export function requestSummary(f: ApplicationForm, lang: "fr" | "ar" = "fr"): string {
  const kind = (lang === "ar" ? KIND_AR : KIND_FR)[f.kind];
  const pos = positionLabel(f, lang);
  return pos ? `${kind} — ${pos}` : kind;
}

/** The staff alert: subject + HTML. */
export function renderStaffAlert(
  f: ApplicationForm,
  opts: { ref: string; nowMs: number; when: string; adminUrl: string; files: { cv: boolean; letter: boolean } }
): { subject: string; html: string } {
  const age = ageOn(f.dateOfBirth, new Date(opts.nowMs));
  const pieces = [opts.files.cv ? "CV" : "", opts.files.letter ? "lettre" : ""].filter(Boolean).join(" + ") || "—";
  const internship = f.kind === "observation" || f.kind === "preembauche";
  const dates = [f.startDate && `du ${frDay(f.startDate)}`, f.endDate && `au ${frDay(f.endDate)}`].filter(Boolean).join(" ");
  const rows: Array<[string, string]> = [
    ["Nom", `${f.lastName} ${f.firstName}`],
    ["Âge", age !== null ? `${age} ans (né(e) le ${frDay(f.dateOfBirth)})` : frDay(f.dateOfBirth)],
    ["Demande", requestSummary(f)],
  ];
  if (f.kind === "observation" && f.schoolLevel) rows.push(["Scolarité", SCHOOL_FR[f.schoolLevel] || f.schoolLevel]);
  if (internship) {
    rows.push(["Durée souhaitée", [DURATION_FR[f.duration] || f.duration, dates].filter(Boolean).join(", ")]);
  } else {
    rows.push([
      "Disponibilité",
      f.availability === "date" && f.availableFrom ? `à partir du ${frDay(f.availableFrom)}` : "immédiate",
    ]);
  }
  rows.push(
    ["Ville", f.district ? `${f.city} (${f.district})` : f.city],
    ["Téléphone", f.phone],
    ["E-mail", f.email || "—"],
    [
      "Diplôme",
      [DIPLOMA_FR[f.diplomaLevel] || f.diplomaLevel, f.diplomaTitle, f.diplomaYear ? String(f.diplomaYear) : "", f.school]
        .filter(Boolean)
        .join(" — "),
    ],
    ["Expérience", [EXPERIENCE_FR[f.experience] || f.experience, f.lastEmployer].filter(Boolean).join(" — ")],
    ["Permis / véhicule", `permis : ${f.license ? "oui" : "non"} — véhicule : ${VEHICLE_FR[f.vehicle] || f.vehicle}`],
    ["Langues", [...f.languages.map((l) => LANGUAGE_FR[l] || l), f.languagesOther].filter(Boolean).join(", ")],
  );
  if (f.source) rows.push(["Nous a connus par", SOURCE_FR[f.source] || f.source]);
  rows.push(
    ["Pièces jointes", pieces],
    ["Reçue le", opts.when],
    ["Référence", opts.ref],
    // Bare URL: rows are escaped, so an <a> would show literally; mail clients
    // auto-link a plain URL.
    ["Espace admin", opts.adminUrl],
  );
  return {
    subject: oneLine(`Nouvelle candidature — ${requestSummary(f)} — ${f.firstName} ${f.lastName}`),
    html: renderAlertEmail({
      title: "Nouvelle candidature",
      lead: "Une candidature vient d'arriver par la page « Emploi & Stage » de l'application.",
      rows,
      todo:
        "À faire : ouvrir l'onglet « Candidatures » de l'espace admin pour lire le CV et donner une suite " +
        "(à étudier, entretien, retenu, refusé).",
      footer:
        "Les candidatures et leurs fichiers sont effacés automatiquement 6 mois après leur envoi. " +
        "Les pièces jointes ne voyagent pas par e-mail : elles s'ouvrent dans l'espace admin.",
    }),
  };
}

/** The acknowledgement to the candidate, in the page's language. */
export function renderAck(
  f: ApplicationForm,
  lang: "fr" | "ar",
  opts: { ref: string; when: string }
): { subject: string; html: string } {
  // Only his first name is quoted (cut short): nothing else he typed reaches
  // the recipient — see the header comment.
  const name = f.firstName.slice(0, 30);
  if (lang === "ar") {
    return {
      subject: "مختبر العلالي — توصلنا بترشيحكم",
      html: renderAlertEmail({
        rtl: true,
        title: "توصلنا بترشيحكم",
        lead: `مرحبًا ${name}، شكرًا على اهتمامكم بمختبر العلالي. توصلنا بترشيحكم: ${requestSummary(f, "ar")}.`,
        rows: [
          ["المرجع", opts.ref],
          ["تاريخ الإرسال", opts.when.replace(" à ", " - ")],
        ],
        todo: "ندرس كل ترشيح بعناية. إذا كان ملفكم يتوافق مع احتياجاتنا، سنتصل بكم عبر الهاتف.",
        footer:
          "نحتفظ بمعلوماتكم ستة أشهر على الأكثر ثم نحذفها. لحذفها قبل ذلك، أو إذا لم تكونوا أنتم من أرسل هذا الترشيح، " +
          "يكفي الرد على هذه الرسالة. — مختبر العلالي للتحاليل الطبية، أكادير",
      }),
    };
  }
  return {
    subject: "Laboratoire El Allali — Votre candidature est bien arrivée",
    html: renderAlertEmail({
      title: "Votre candidature est bien arrivée",
      lead: `Bonjour ${name}, merci de l'intérêt que vous portez au Laboratoire El Allali. Nous avons bien reçu votre candidature : ${requestSummary(f)}.`,
      rows: [
        ["Référence", opts.ref],
        ["Envoyée le", opts.when],
      ],
      todo:
        "Nous étudions chaque candidature avec attention. Si votre profil correspond à nos besoins, " +
        "nous vous contacterons par téléphone.",
      footer:
        "Vos informations sont conservées 6 mois au plus, puis effacées. Pour les faire effacer plus tôt, " +
        "ou si vous n'êtes pas à l'origine de cette candidature, répondez simplement à cet e-mail. " +
        "— Laboratoire El Allali, Agadir",
    }),
  };
}
