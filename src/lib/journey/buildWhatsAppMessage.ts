import { activeWants } from './buildSubmission';
import type { JourneyFormSnapshot, ReplyChannel, WantToKnowKey } from './types';

/**
 * Message WhatsApp pré-rempli.
 *
 * ⚠ Littéraux FR/AR en dur, PAS de `t()`. Ce n'est pas un oubli : le
 * commentaire de `rendez-vous/page.tsx` l'explique — appeler `t()` depuis un
 * gestionnaire asynchrone expose à une course sur le chargement des namespaces,
 * et le patient se retrouve avec un message truffé de clés brutes.
 *
 * ⚠ Plafond de longueur AVANT encodage. iOS tronque ou refuse silencieusement
 * les URL `wa.me?text=` trop longues : on limite la liste d'analyses et on
 * annonce ce qui n'est pas listé plutôt que de laisser WhatsApp couper au hasard.
 */
export const MAX_WA_CHARS = 1800;
const MAX_LISTED_ANALYSES = 15;

const WANT_FR: Record<WantToKnowKey, string> = {
  prix: 'le prix',
  delai: 'le délai des résultats',
  jeune: "s'il faut être à jeun",
  explication: 'une explication de mes analyses',
};
const WANT_AR: Record<WantToKnowKey, string> = {
  prix: 'الثمن',
  delai: 'مدة النتائج',
  jeune: 'هل يجب أن أكون صائمًا',
  explication: 'شرح لتحاليلي',
};

const CHANNEL_FR: Record<ReplyChannel, string> = {
  whatsapp: 'WhatsApp',
  email: 'e-mail',
  call: 'appel téléphonique',
  sms: 'SMS',
};
const CHANNEL_AR: Record<ReplyChannel, string> = {
  whatsapp: 'واتساب',
  email: 'البريد الإلكتروني',
  call: 'مكالمة هاتفية',
  sms: 'رسالة نصية',
};

const PLACE_FR = {
  laboratoire: 'au laboratoire',
  domicile: 'à mon domicile',
  travail: 'sur mon lieu de travail',
} as const;
const PLACE_AR = {
  laboratoire: 'بالمختبر',
  domicile: 'في منزلي',
  travail: 'في مقر عملي',
} as const;

export function buildWhatsAppMessage(snapshot: JourneyFormSnapshot): string {
  const ar = snapshot.lang === 'ar';
  const L: string[] = [];
  const push = (line: string) => L.push(line);

  push(ar ? 'السلام عليكم،' : 'Bonjour,');
  push('');
  push(ar ? 'أرغب في تنظيم تحاليلي :' : 'Je souhaite organiser mes analyses :');
  push('');
  push(`${ar ? 'الاسم' : 'Nom'} : ${snapshot.nom}`);
  push(`${ar ? 'الهاتف' : 'Téléphone'} : ${snapshot.telephone}`);
  if (snapshot.email) push(`${ar ? 'البريد' : 'E-mail'} : ${snapshot.email}`);
  push('');

  if (snapshot.hasPrescription) {
    const yes = snapshot.hasPrescription === 'yes';
    push(
      `${ar ? 'وصفة طبية' : 'Ordonnance'} : ${ar ? (yes ? 'نعم' : 'لا') : yes ? 'Oui' : 'Non'}`
    );
  }
  if (snapshot.freeText.trim()) {
    push(`${ar ? 'طلبي' : 'Ma demande'} : ${snapshot.freeText.trim()}`);
  }

  if (snapshot.cartLines.length > 0) {
    push('');
    push(ar ? 'التحاليل المطلوبة :' : 'Analyses souhaitées :');
    const listed = snapshot.cartLines.slice(0, MAX_LISTED_ANALYSES);
    listed.forEach((line) => {
      const name = ar && line.nameAr ? line.nameAr : line.name;
      push(`- ${name}${line.price > 0 ? ` (${line.price} ${ar ? 'درهم' : 'DH'})` : ''}`);
    });
    const rest = snapshot.cartLines.length - listed.length;
    if (rest > 0) {
      push(ar ? `… و${rest} تحاليل أخرى` : `… et ${rest} autre(s) analyse(s)`);
    }
    if (snapshot.cartTotals) {
      push(
        ar
          ? `المجموع التقديري : ${snapshot.cartTotals.total} درهم (تقدير، الثمن يُؤكَّد بالمختبر)`
          : `Total estimé : ${snapshot.cartTotals.total} DH (estimation, tarif à confirmer au laboratoire)`
      );
    }
    if (snapshot.preparation) {
      const { maxJeune, maxDRR } = snapshot.preparation;
      const jeune = ar
        ? maxJeune > 0
          ? `على الريق : ${maxJeune} ساعة`
          : 'لا حاجة للصيام'
        : maxJeune > 0
          ? `Jeûne : ${maxJeune} h`
          : 'Aucun jeûne obligatoire';
      const delai = ar
        ? maxDRR > 0
          ? `النتائج خلال ${maxDRR} يوم`
          : 'النتائج في نفس اليوم'
        : maxDRR > 0
          ? `Résultats sous ${maxDRR} jour(s)`
          : 'Résultats le jour même';
      push(`${jeune} — ${delai}`);
    }
  }

  const wants = activeWants(snapshot.wantToKnow);
  if (wants.length > 0) {
    push('');
    push(
      `${ar ? 'أرغب في معرفة' : 'Je souhaite connaître'} : ${wants
        .map((k) => (ar ? WANT_AR[k] : WANT_FR[k]))
        .join(ar ? '، ' : ', ')}`
    );
  }

  push('');
  push(
    `${ar ? 'مكان أخذ العينة' : 'Lieu du prélèvement'} : ${
      ar ? PLACE_AR[snapshot.samplingPlace] : PLACE_FR[snapshot.samplingPlace]
    }`
  );
  if (snapshot.samplingPlace !== 'laboratoire') {
    if (snapshot.adresse) push(`${ar ? 'العنوان' : 'Adresse'} : ${snapshot.adresse}`);
    if (snapshot.instructionsAcces) {
      push(`${ar ? 'الوصول' : 'Accès'} : ${snapshot.instructionsAcces}`);
    }
  }
  push(
    `${ar ? 'التاريخ المطلوب' : 'Date souhaitée'} : ${snapshot.desiredDate} ${
      ar ? 'على الساعة' : 'à'
    } ${snapshot.desiredTime}`
  );
  push(
    `${ar ? 'أفضل أن يتم الاتصال بي عبر' : 'Je préfère être recontacté(e) par'} : ${
      ar ? CHANNEL_AR[snapshot.replyChannel] : CHANNEL_FR[snapshot.replyChannel]
    }`
  );

  if (snapshot.ordonnanceUrls.length > 0) {
    push('');
    push(ar ? 'الوصفة الطبية :' : 'Ordonnance :');
    snapshot.ordonnanceUrls.forEach((url, i) => push(`${i + 1} : ${url}`));
  }

  push('');
  push(ar ? 'شكرًا.' : 'Merci.');

  let message = L.join('\n');
  if (message.length > MAX_WA_CHARS) {
    // Coupe proprement sur une fin de ligne plutôt qu'au milieu d'un mot.
    const cut = message.slice(0, MAX_WA_CHARS).lastIndexOf('\n');
    message =
      message.slice(0, cut > 0 ? cut : MAX_WA_CHARS) +
      (ar ? '\n… (تابع الطلب في التطبيق)' : '\n… (suite de la demande dans l’application)');
  }
  return message;
}

/** Le lien `wa.me` complet vers le numéro du laboratoire. */
export function buildWhatsAppLink(whatsappId: string, snapshot: JourneyFormSnapshot): string {
  return `https://wa.me/${whatsappId}?text=${encodeURIComponent(buildWhatsAppMessage(snapshot))}`;
}
