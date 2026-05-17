export interface GenerateDevisPdfOptions {
  bilans: Array<{ name: string; price: number; compositionNames?: string[] }>;
  analyses: Array<{ name: string; price: number }>;
  totalCost: number;
  currencyLabel: string;
  maxJeune: number;
  maxDRR: number;
  sampleTypes: string[];
  specialInstructions: string[];
  patientName?: string;
  patientPhone?: string;
}

const C = {
  headerBg:     [145,   0,  47] as const, // #91002F
  primary:      [181,   0,  61] as const, // #B5003D
  primaryHot:   [227,   0,  79] as const, // #E3004F
  surfaceLow:   [255, 240, 240] as const, // #FFF0F0
  surfaceMid:   [255, 233, 233] as const, // #FFE9E9
  surfaceHi:    [255, 225, 227] as const, // #FFE1E3
  outline:      [230, 188, 191] as const, // #E6BCBF
  textPrimary:  [ 40,  23,  24] as const, // #281718
  textVariant:  [ 92,  63,  66] as const, // #5C3F42
  textMuted:    [140, 100, 105] as const,
  white:        [255, 255, 255] as const,
  successGreen: [  5, 150, 105] as const, // #059669
  warningAmber: [217, 119,   6] as const, // #D97706
};

type Doc = import('jspdf').jsPDF;
const set = {
  fill: ([r, g, b]: readonly number[], doc: Doc) => doc.setFillColor(r, g, b),
  draw: ([r, g, b]: readonly number[], doc: Doc) => doc.setDrawColor(r, g, b),
  text: ([r, g, b]: readonly number[], doc: Doc) => doc.setTextColor(r, g, b),
};

export async function generateDevisPdf(opts: GenerateDevisPdfOptions): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const {
    bilans, analyses, totalCost, currencyLabel,
    maxJeune, maxDRR, sampleTypes,
    patientName, patientPhone,
  } = opts;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });

  const W = 210, H = 297, mg = 14;
  const contentW = W - mg * 2;
  const HEADER_H = 28;
  const FOOTER_H = 50;
  const CONTENT_TOP = HEADER_H + 8;
  const CONTENT_BOTTOM = H - FOOTER_H - 5;

  const today = new Date().toLocaleDateString('fr-MA', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  // ── Logo ────────────────────────────────────────────────────────────────────
  let logoDataUrl: string | null = null;
  try {
    await new Promise<void>((res, rej) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const px = 128;
        const cv = document.createElement('canvas');
        cv.width = px; cv.height = px;
        cv.getContext('2d')!.drawImage(img, 0, 0, px, px);
        logoDataUrl = cv.toDataURL('image/png');
        res();
      };
      img.onerror = rej;
      img.src = '/images/icons/logo-header.png';
    });
  } catch { /* skip logo */ }

  // ── HEADER (patient à droite) ──────────────────────────────────────────────
  const drawHeader = () => {
    set.fill(C.headerBg, doc); doc.rect(0, 0, W, HEADER_H, 'F');

    // Badge logo blanc à gauche
    set.fill(C.white, doc); doc.roundedRect(mg, 7, 14, 14, 2.5, 2.5, 'F');
    if (logoDataUrl) {
      doc.addImage(logoDataUrl, 'PNG', mg + 1.5, 8.5, 11, 11);
    } else {
      set.text(C.primary, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
      doc.text('L', mg + 7, 17, { align: 'center' });
    }
    set.text(C.white, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text('Laboratoire El Allali', mg + 18, 14);
    set.text([255, 220, 225], doc); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    doc.text('Fiche de devis & préparation', mg + 18, 20);

    // Bloc patient à droite (nom, téléphone, date)
    const rightX = W - mg;
    if (patientName) {
      set.text(C.white, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
      doc.text(patientName, rightX, 12, { align: 'right' });
    }
    if (patientPhone) {
      set.text([255, 220, 225], doc); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      doc.text(`Tél. ${patientPhone}`, rightX, 17.5, { align: 'right' });
    }
    set.text([255, 200, 210], doc); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text(today, rightX, 23, { align: 'right' });
  };

  // ── FOOTER condensé style site ─────────────────────────────────────────────
  const drawRichFooter = () => {
    const fY = H - FOOTER_H;
    set.fill(C.headerBg, doc); doc.rect(0, fY, W, FOOTER_H, 'F');

    const padX = mg;
    const colW = (W - padX * 2 - 8) / 3;
    const c1X = padX;
    const c2X = padX + colW + 4;
    const c3X = padX + (colW + 4) * 2;
    const topY = fY + 5;

    const labelColor: readonly number[] = [255, 200, 210];
    const valueColor: readonly number[] = [255, 245, 246];

    // ── Colonne 1 — CONTACT ──────────────────────────────────────────────────
    set.text(labelColor, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
    doc.text('CONTACT', c1X, topY);

    let lineY = topY + 4;
    set.text(valueColor, doc); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.8);

    const addrLines = doc.splitTextToSize('61 Bis, Rue de Marrakech, Agadir', colW) as string[];
    addrLines.forEach(l => { doc.text(l, c1X, lineY); lineY += 3.3; });

    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
    doc.text('Tél.', c1X, lineY + 1);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text('0528 84 33 84', c1X + 7, lineY + 1);
    lineY += 4;

    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
    doc.text('WhatsApp', c1X, lineY + 1);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text('0654 07 95 92', c1X + 15, lineY + 1);
    lineY += 4;

    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
    doc.text('Email', c1X, lineY + 1);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    doc.text('laboelallali@gmail.com', c1X + 9, lineY + 1);

    // ── Colonne 2 — HORAIRES + LIENS ─────────────────────────────────────────
    set.text(labelColor, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
    doc.text('HORAIRES', c2X, topY);

    set.text(valueColor, doc); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.8);
    doc.text('Lun – Ven : 7h30 → 18h30', c2X, topY + 4);
    doc.text('Samedi : 7h30 → 13h00', c2X, topY + 7.5);

    set.text(labelColor, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
    doc.text('LIENS RAPIDES', c2X, topY + 13);

    set.text(valueColor, doc); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.8);
    doc.text('Accueil  ·  Analyses  ·  RDV', c2X, topY + 17);
    doc.text('GLABO à domicile  ·  Contact', c2X, topY + 20.5);

    // ── Colonne 3 — APPLICATION ──────────────────────────────────────────────
    set.text(labelColor, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
    doc.text('APPLICATION', c3X, topY);

    set.text(valueColor, doc); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.8);
    const ctaMsg = doc.splitTextToSize(
      'Résultats, devis, RDV et prélèvement à domicile depuis votre téléphone.',
      colW
    ) as string[];
    ctaMsg.forEach((l, i) => { doc.text(l, c3X, topY + 4 + i * 3.3); });

    // Bouton CTA pilule blanche
    const btnY = topY + 4 + ctaMsg.length * 3.3 + 1;
    const btnW = Math.min(colW, 55);
    const btnH = 10;
    set.fill(C.white, doc); doc.roundedRect(c3X, btnY, btnW, btnH, 5, 5, 'F');
    set.text(C.primary, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    doc.text('Téléchargez notre app', c3X + btnW / 2, btnY + 4.5, { align: 'center' });
    set.text([170, 60, 90], doc); doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8);
    doc.text('www.laboelallali.com', c3X + btnW / 2, btnY + 7.8, { align: 'center' });

    // Séparateur + copyright
    set.draw([255, 255, 255], doc); doc.setLineWidth(0.15);
    doc.setLineDashPattern([], 0);
    const sepY = fY + FOOTER_H - 7;
    set.fill([255, 255, 255], doc);
    doc.rect(padX, sepY, W - padX * 2, 0.15, 'F');
    set.text([255, 200, 210], doc); doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
    const year = new Date().getFullYear();
    doc.text(
      `© ${year}  Laboratoire El Allali  ·  Tous droits réservés`,
      W / 2, fY + FOOTER_H - 3, { align: 'center' }
    );
  };

  let y = CONTENT_TOP;
  drawHeader();

  const newPage = () => {
    drawRichFooter();
    doc.addPage();
    drawHeader();
    y = CONTENT_TOP;
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > CONTENT_BOTTOM) newPage();
  };

  // ══════════════════════════════════════════════════════════════════════════
  // CONTENU (flux continu, auto-pagination naturelle)
  // ══════════════════════════════════════════════════════════════════════════

  // ── Intro ──────────────────────────────────────────────────────────────────
  const intro =
    "Bonjour, voici votre devis personnalisé. Présentez-le lors de votre passage au laboratoire — il regroupe vos analyses, leur tarif, le délai de rendu et la préparation à effectuer.";
  const introLines = doc.splitTextToSize(intro, contentW) as string[];
  ensureSpace(introLines.length * 4.5 + 4);
  set.text(C.textVariant, doc); doc.setFont('helvetica', 'italic'); doc.setFontSize(10);
  doc.text(introLines, mg, y + 3);
  y += introLines.length * 4.5 + 6;

  // ── Section MON DEVIS ──────────────────────────────────────────────────────
  const itemCount = bilans.length + analyses.length;
  ensureSpace(14);
  set.fill(C.primaryHot, doc); doc.roundedRect(mg, y, contentW, 10, 1.5, 1.5, 'F');
  set.text(C.white, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
  doc.text('MON DEVIS', mg + 5, y + 6.8);
  doc.text(
    `${itemCount} analyse${itemCount > 1 ? 's' : ''}`,
    W - mg - 5, y + 6.8, { align: 'right' }
  );
  y += 11;

  // Sous-titre de groupe (distinct des rangées)
  const drawGroupHeader = (label: string) => {
    ensureSpace(9);
    // bande primary avec léger gradient effet (fond surfaceMid + accent gauche)
    set.fill(C.surfaceMid, doc); doc.rect(mg, y, contentW, 7, 'F');
    set.fill(C.primary, doc); doc.rect(mg, y, 2, 7, 'F');
    set.text(C.primary, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text(label, mg + 5.5, y + 5);
    y += 7;
  };

  const drawItemRow = (name: string, price: number) => {
    ensureSpace(11);
    const trunc = name.length > 50 ? name.slice(0, 48) + '…' : name;
    set.text(C.textPrimary, doc); doc.setFont('helvetica', 'normal'); doc.setFontSize(12);
    doc.text(trunc, mg + 4, y + 7);
    set.text(C.primaryHot, doc); doc.setFont('helvetica', 'bold');
    doc.text(`${price.toLocaleString('fr-MA')} ${currencyLabel}`, W - mg - 4, y + 7, { align: 'right' });
    set.draw(C.outline, doc); doc.setLineWidth(0.2);
    doc.line(mg + 2, y + 10, W - mg - 2, y + 10);
    y += 10;
  };

  if (bilans.length > 0) {
    drawGroupHeader('BILANS');
    bilans.forEach(b => drawItemRow(b.name, b.price));
  }
  if (analyses.length > 0) {
    drawGroupHeader('ANALYSES INDIVIDUELLES');
    analyses.forEach(a => drawItemRow(a.name, a.price));
  }
  y += 4;

  // ── Carte Pricing ──────────────────────────────────────────────────────────
  const pricingH = 36;
  ensureSpace(pricingH + 4);
  set.fill(C.surfaceMid, doc); doc.roundedRect(mg, y, contentW, pricingH, 3, 3, 'F');
  set.text(C.textVariant, doc); doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
  doc.text('Sous-total', mg + 6, y + 9);
  doc.text(
    `${(totalCost - 20).toLocaleString('fr-MA')} ${currencyLabel}`,
    W - mg - 6, y + 9, { align: 'right' }
  );
  doc.text('Frais de prélèvement', mg + 6, y + 17);
  doc.text(`20 ${currencyLabel}`, W - mg - 6, y + 17, { align: 'right' });
  set.draw(C.primaryHot, doc); doc.setLineWidth(0.6);
  doc.line(mg + 4, y + 21, W - mg - 4, y + 21);
  set.text(C.textPrimary, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
  doc.text('TOTAL', mg + 6, y + 31);
  set.text(C.primaryHot, doc); doc.setFontSize(22);
  doc.text(
    `${totalCost.toLocaleString('fr-MA')} ${currencyLabel}`,
    W - mg - 6, y + 31, { align: 'right' }
  );
  y += pricingH + 6;

  // ── Grille 2 cartes (Délai / Jeûne) ────────────────────────────────────────
  const cardW = (contentW - 6) / 2;
  const cardH = 22;
  ensureSpace(cardH + 4);

  set.fill(C.white, doc); doc.roundedRect(mg, y, cardW, cardH, 2, 2, 'F');
  set.fill(C.successGreen, doc); doc.rect(mg, y, 1.6, cardH, 'F');
  set.draw(C.outline, doc); doc.setLineWidth(0.2);
  doc.roundedRect(mg, y, cardW, cardH, 2, 2);
  set.text(C.successGreen, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
  doc.text('Délai de rendu', mg + 5, y + 8);
  set.text(C.textVariant, doc); doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
  doc.text(
    maxDRR === 0 ? 'Résultats disponibles le jour même.' : `Résultats sous ${maxDRR} jour(s).`,
    mg + 5, y + 16
  );

  const rX = mg + cardW + 6;
  set.fill(C.white, doc); doc.roundedRect(rX, y, cardW, cardH, 2, 2, 'F');
  if (maxJeune > 0) {
    set.fill(C.warningAmber, doc); doc.rect(rX, y, 1.6, cardH, 'F');
    set.draw(C.outline, doc); doc.setLineWidth(0.2);
    doc.roundedRect(rX, y, cardW, cardH, 2, 2);
    set.text(C.warningAmber, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text(`Jeûne strict ${maxJeune}h requis`, rX + 5, y + 8);
    set.text(C.textVariant, doc); doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
    doc.text('Avant votre prise de sang.', rX + 5, y + 16);
  } else {
    set.fill(C.successGreen, doc); doc.rect(rX, y, 1.6, cardH, 'F');
    set.draw(C.outline, doc); doc.setLineWidth(0.2);
    doc.roundedRect(rX, y, cardW, cardH, 2, 2);
    set.text(C.successGreen, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text('Aucun jeûne requis', rX + 5, y + 8);
    set.text(C.textVariant, doc); doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
    doc.text('Aucune préparation spécifique.', rX + 5, y + 16);
  }
  y += cardH + 10;

  // ══════════════════════════════════════════════════════════════════════════
  // DÉTAIL DE VOS BILANS — flux continu (pas de saut de page forcé)
  // ══════════════════════════════════════════════════════════════════════════
  if (bilans.length > 0) {
    // Hauteur estimée du bloc d'en-tête (titre + note + séparateur)
    const noteLines = doc.splitTextToSize(
      "Les analyses appartenant à plusieurs bilans ne sont facturées qu'une seule fois.",
      contentW
    ) as string[];
    const headerBlockH = 9 + noteLines.length * 3.5 + 5;
    ensureSpace(headerBlockH);

    // Titre
    set.text(C.textPrimary, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
    doc.text('DÉTAIL DE VOS BILANS', mg, y + 6);
    y += 9;

    // Note italique sous le titre, AU-DESSUS du séparateur
    set.text(C.textMuted, doc); doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5);
    noteLines.forEach((line, i) => {
      doc.text(line, mg, y + i * 3.5);
    });
    y += noteLines.length * 3.5 + 2;

    // Séparateur (sous la note)
    set.draw(C.outline, doc); doc.setLineWidth(0.25);
    doc.line(mg, y, W - mg, y);
    y += 5;

    // Bilans avec keep-together (titre + composition sur la même page)
    bilans.forEach(bilan => {
      const comp = bilan.compositionNames ?? [];
      const headerH = 9.5;
      const innerPad = 4;
      const lineH = 6;
      const blockH = comp.length > 0
        ? comp.length * lineH + innerPad * 2
        : 8;
      const totalBilanH = headerH + blockH + 5;

      // Saut de page anticipé si tout ne tient pas
      if (y + totalBilanH > CONTENT_BOTTOM) {
        // Si le bilan entier dépasse même une page entière, on accepte un split
        const pageContentH = CONTENT_BOTTOM - CONTENT_TOP;
        if (totalBilanH <= pageContentH) {
          newPage();
        }
      }

      // Header bilan
      set.fill(C.primary, doc); doc.roundedRect(mg, y, contentW, headerH, 2, 2, 'F');
      set.text(C.white, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
      const bilanName = bilan.name.length > 60 ? bilan.name.slice(0, 58) + '…' : bilan.name;
      doc.text(bilanName, mg + 4, y + 6.5);
      y += headerH;

      // Bloc composition
      if (comp.length > 0) {
        set.fill(C.surfaceLow, doc);
        doc.roundedRect(mg + 4, y, contentW - 8, blockH, 1.5, 1.5, 'F');
        set.draw(C.outline, doc); doc.setLineWidth(0.2);
        doc.roundedRect(mg + 4, y, contentW - 8, blockH, 1.5, 1.5);

        let lY = y + innerPad + 3.5;
        comp.forEach(name => {
          set.fill(C.primary, doc); doc.circle(mg + 9, lY - 1.2, 0.9, 'F');
          set.text(C.textPrimary, doc); doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5);
          const trunc = name.length > 60 ? name.slice(0, 58) + '…' : name;
          doc.text(trunc, mg + 12.5, lY);
          lY += lineH;
        });
        y += blockH;
      } else {
        set.text(C.textMuted, doc); doc.setFont('helvetica', 'italic'); doc.setFontSize(9.5);
        doc.text('Composition détaillée disponible au laboratoire.', mg + 8, y + 4);
        y += 8;
      }
      y += 5;
    });
    y += 2;
  }

  // ── Type de prélèvements ───────────────────────────────────────────────────
  if (sampleTypes.length > 0) {
    ensureSpace(18);
    set.text(C.textVariant, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.text('TYPE DE PRÉLÈVEMENTS', mg, y + 5);
    y += 8;

    let tx = mg, ty = y;
    const pillH = 8;
    sampleTypes.forEach(s => {
      const label = s.toUpperCase().slice(0, 16);
      const tw = label.length * 2.3 + 12;
      if (tx + tw > W - mg) { tx = mg; ty += pillH + 3; }
      set.fill(C.surfaceHi, doc); doc.roundedRect(tx, ty, tw, pillH, 4, 4, 'F');
      set.draw(C.outline, doc); doc.setLineWidth(0.2);
      doc.roundedRect(tx, ty, tw, pillH, 4, 4);
      set.fill(C.primary, doc); doc.circle(tx + 4, ty + pillH / 2, 1.3, 'F');
      set.text(C.textPrimary, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
      doc.text(label, tx + 7, ty + pillH / 2 + 1.5);
      tx += tw + 3;
    });
    y = ty + pillH + 6;
  }

  // ── Documents à préparer ───────────────────────────────────────────────────
  const docs: Array<{ title: string; desc: string; icon: string }> = [
    {
      title: "Carte d'Identité Nationale (CIN)",
      desc: "Format physique ou sur téléphone.",
      icon: 'ID',
    },
    {
      title: "Ordonnance médicale",
      desc: "Si disponible. Une ordonnance peut être faite chez un médecin ultérieurement pour votre remboursement.",
      icon: 'Rx',
    },
    {
      title: "Carte de Mutuelle / Assurance",
      desc: "Très importante en cas de tiers payant (ex : MCM, IAM, etc.).",
      icon: '+',
    },
  ];

  const docPad = 5;
  const docItemMin = 14;
  const docRows = docs.map(d => {
    const descLines = doc.splitTextToSize(d.desc, contentW - 22) as string[];
    return { ...d, descLines, h: Math.max(docItemMin, 5 + descLines.length * 4 + 3) };
  });
  const docBlockH = docPad * 2 + docRows.reduce((acc, r) => acc + r.h, 0) + 2 * (docRows.length - 1);

  // Keep-together pour titre + bloc
  ensureSpace(12 + docBlockH);
  set.text(C.textPrimary, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
  doc.text('DOCUMENTS À PRÉPARER', mg, y + 6);
  y += 9;
  set.draw(C.outline, doc); doc.setLineWidth(0.25);
  doc.line(mg, y, W - mg, y);
  y += 5;

  set.fill(C.surfaceLow, doc); doc.roundedRect(mg, y, contentW, docBlockH, 3, 3, 'F');
  set.draw(C.outline, doc); doc.setLineWidth(0.25);
  doc.roundedRect(mg, y, contentW, docBlockH, 3, 3);

  let docY = y + docPad;
  docRows.forEach((r, idx) => {
    const iconCx = mg + 8;
    const iconCy = docY + 4;
    set.fill(C.surfaceHi, doc); doc.circle(iconCx, iconCy, 3.5, 'F');
    set.text(C.primary, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
    doc.text(r.icon, iconCx, iconCy + 1.2, { align: 'center' });

    set.text(C.textPrimary, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5);
    doc.text(r.title, mg + 14, docY + 4);

    set.text(C.textVariant, doc); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text(r.descLines, mg + 14, docY + 8.5);

    docY += r.h + (idx < docRows.length - 1 ? 2 : 0);
  });

  y += docBlockH + 4;

  drawRichFooter();

  // ══════════════════════════════════════════════════════════════════════════
  // SAUVEGARDE
  // ══════════════════════════════════════════════════════════════════════════
  const fileName = `devis-labo-${new Date().toISOString().slice(0, 10)}.pdf`;
  const blob = doc.output('blob');
  const file = new File([blob], fileName, { type: 'application/pdf' });

  const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & {
    canShare?: (data: { files?: File[] }) => boolean;
    share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>;
  }) : null;

  const isMobile = typeof navigator !== 'undefined' &&
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

  if (isMobile && nav?.canShare && nav.canShare({ files: [file] }) && nav.share) {
    try {
      await nav.share({
        files: [file],
        title: 'Devis Laboratoire El Allali',
        text: 'Voici votre fiche de préparation.',
      });
    } catch (error) {
      const err = error as { name?: string };
      if (err?.name !== 'AbortError') {
        doc.save(fileName);
      }
    }
  } else {
    doc.save(fileName);
  }
}
