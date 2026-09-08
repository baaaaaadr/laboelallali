import type { CartView } from '@/lib/cart/cartView';
import type { PreparationRules } from '@/hooks/usePreparationRules';
import {
  TRANSMISSION_MODES,
  WANT_TO_KNOW_KEYS,
  type JourneyCartLine,
  type JourneyCartTotals,
  type JourneyFormSnapshot,
  type JourneyPreparation,
  type TransmissionMode,
  type WantToKnowKey,
} from './types';

/**
 * Transformations PURES : instantané du formulaire → document Firestore,
 * charge utile de `/api/send-appointment`. Aucun accès réseau, aucun hook,
 * testable isolément.
 *
 * ⚠ Les quatre valeurs de `status` et les deux de `type` sont CONTRACTUELLES :
 * le suivi du laboratoire s'appuie dessus depuis le lancement. Le "lieu de
 * travail" compte comme un service à domicile, exactement comme le fait /glabo
 * aujourd'hui. Ne jamais les renommer.
 *
 * ⚠ Firestore refuse `undefined` et lève à `addDoc` : chaque champ optionnel
 * passe par `?? null`.
 *
 * ⚠ Le panier est DÉNORMALISÉ volontairement (5 champs par ligne). Les prix
 * changent ; le personnel doit voir ce qui a été annoncé au patient ce jour-là.
 * Stocker les `CartItem` bruts — des `AnalyseItem` complets avec leurs tags et
 * descriptions FR+AR — rendrait un panier de 30 lignes illisible et énorme.
 */

/** Extrait les lignes du panier sous la forme envoyée au laboratoire. */
export function cartLinesFrom(cartView: CartView): JourneyCartLine[] {
  return cartView.lines.map((line): JourneyCartLine => {
    const nameAr =
      line.cartItem.type === 'analyse'
        ? line.cartItem.item.Nom_Patient_AR
        : line.cartItem.item.Nom_Bilan_AR;
    return {
      code: line.cartItem.item.id,
      name: line.displayName,
      nameAr: nameAr || '',
      price: line.effectivePrice,
      type: line.type,
    };
  });
}

export function cartTotalsFrom(cartView: CartView): JourneyCartTotals {
  return {
    uniqueAnalysesCount: cartView.uniqueAnalysesCount,
    itemsTotal: cartView.itemsTotal,
    samplingFee: cartView.samplingFee,
    total: cartView.total,
  };
}

export function preparationFrom(preparation: PreparationRules): JourneyPreparation {
  return {
    maxJeune: preparation.maxJeune,
    maxDRR: preparation.maxDRR,
    sampleTypes: preparation.sampleTypes,
    patientPreparation: preparation.patientPreparation,
    technicalInstructions: preparation.technicalInstructions,
  };
}

export function activeTransmissionModes(
  transmission: Record<TransmissionMode, boolean>
): TransmissionMode[] {
  return TRANSMISSION_MODES.filter((m) => transmission[m]);
}

export function activeWants(want: Record<WantToKnowKey, boolean>): WantToKnowKey[] {
  return WANT_TO_KNOW_KEYS.filter((k) => want[k]);
}

/** Le libellé français figé du type de demande, tel qu'affiché dans l'e-mail. */
export function typeAnalyseLabel(place: JourneyFormSnapshot['samplingPlace']): string {
  if (place === 'domicile') return 'Prélèvement à Domicile';
  if (place === 'travail') return 'Prélèvement sur le lieu de travail';
  return 'Rendez-vous Laboratoire';
}

/** Le document écrit dans `appointmentRequests`. */
export function buildFirestoreDoc(
  snapshot: JourneyFormSnapshot,
  viaWhatsApp: boolean
): Record<string, unknown> {
  const isHome = snapshot.samplingPlace !== 'laboratoire';
  const type = isHome ? 'home_service_appointment' : 'lab_appointment';
  const status = isHome
    ? viaWhatsApp
      ? 'whatsapp_home_service_request'
      : 'new_home_service_request'
    : viaWhatsApp
      ? 'whatsapp_appointment_request'
      : 'new_appointment_request';

  return {
    // -- champs historiques, identiques à ceux des deux anciennes pages --------
    name: snapshot.nom,
    phone: snapshot.telephone,
    email: snapshot.email || null,
    desiredDate: snapshot.desiredDate,
    desiredTime: snapshot.desiredTime,
    comments: snapshot.freeText || '',
    prescriptionImageUrls: snapshot.ordonnanceUrls,
    address: isHome ? snapshot.adresse : null,
    locationType: isHome ? snapshot.samplingPlace : null,
    accessInstructions: snapshot.instructionsAcces || null,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    status,
    type,

    // -- nouveaux champs, purement additifs -----------------------------------
    source: 'journey',
    journeyVersion: 1,
    variant: snapshot.variant,
    uid: snapshot.uid,
    locale: snapshot.lang,
    samplingPlace: snapshot.samplingPlace,
    hasPrescription: snapshot.hasPrescription ?? null,
    transmissionModes: activeTransmissionModes(snapshot.transmission),
    requestText: snapshot.freeText || '',
    wantToKnow: activeWants(snapshot.wantToKnow),
    replyChannel: snapshot.replyChannel,
    needsHumanAnswer: snapshot.needsHumanAnswer,
    sentViaWhatsApp: viaWhatsApp,
    cart:
      snapshot.cartTotals && snapshot.cartLines.length > 0
        ? { items: snapshot.cartLines, ...snapshot.cartTotals, estimated: true }
        : null,
    preparation: snapshot.preparation ?? null,
  };
}

/**
 * La charge utile POSTée à `/api/send-appointment`.
 *
 * Les clés historiques sont conservées telles quelles — les deux anciennes pages
 * les envoient encore — et les nouvelles sont toutes optionnelles côté route, de
 * sorte que leurs e-mails restent identiques au bit près.
 *
 * ⚠ Les valeurs partent en CLÉ BRUTE (`wantToKnow`, `replyChannel`,
 * `hasPrescription`, `lieuPrelevement`). Passer par `t()` mettrait de l'arabe
 * dans la boîte française du laboratoire — c'est déjà arrivé.
 */
export function buildEmailPayload(
  snapshot: JourneyFormSnapshot,
  viaWhatsApp: boolean
): Record<string, unknown> {
  const isHome = snapshot.samplingPlace !== 'laboratoire';

  // ⚠ On n'essaie PLUS de deviner le prénom. Les deux anciennes pages coupaient
  // au premier espace (`prenom = parts[0]`, `nom = le reste`), puis l'e-mail
  // réaffichait « nom prénom » : le laboratoire lisait donc le nom du patient
  // dans un ORDRE DIFFÉRENT de celui du message WhatsApp de la même demande.
  // Le découpage est de toute façon un pari sur les noms composés marocains.
  // Le parcours envoie le nom TEL QUE SAISI, et laisse `prenom` vide.
  return {
    // -- contrat existant -----------------------------------------------------
    nom: snapshot.nom,
    prenom: '',
    telephone: snapshot.telephone,
    email: snapshot.email,
    date_souhaitee: snapshot.desiredDate,
    heure_souhaitee: snapshot.desiredTime,
    type_analyse: typeAnalyseLabel(snapshot.samplingPlace),
    commentaires: snapshot.freeText,
    ordonnanceUrls: snapshot.ordonnanceUrls,
    isHomeService: isHome,
    adresse: isHome ? snapshot.adresse : '',
    lieuPrelevement: isHome ? snapshot.samplingPlace : '',
    instructionsAcces: snapshot.instructionsAcces,

    // -- ajouts du parcours ---------------------------------------------------
    source: 'journey',
    hasPrescription: snapshot.hasPrescription ?? '',
    transmissionModes: activeTransmissionModes(snapshot.transmission),
    analyses: snapshot.cartLines,
    cartTotals: snapshot.cartTotals,
    preparation: snapshot.preparation,
    wantToKnow: activeWants(snapshot.wantToKnow),
    replyChannel: snapshot.replyChannel,
    needsHumanAnswer: snapshot.needsHumanAnswer,
    sentViaWhatsApp: viaWhatsApp,
    locale: snapshot.lang,
  };
}
