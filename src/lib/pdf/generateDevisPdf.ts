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

// ── Palette M3 (alignée maquette) ────────────────────────────────────────────
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

const set = {
  fill: ([r, g, b]: readonly number[], doc: any) => doc.setFillColor(r, g, b),
  draw: ([r, g, b]: readonly number[], doc: any) => doc.setDrawColor(r, g, b),
  text: ([r, g, b]: readonly number[], doc: any) => doc.setTextColor(r, g, b),
};

export async function generateDevisPdf(opts: GenerateDevisPdfOptions): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const {
    bilans, analyses, totalCost, currencyLabel,
    maxJeune, maxDRR, sampleTypes, specialInstructions,
    patientName, patientPhone,
  } = opts;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });

  const W = 210, H = 297, mg = 14;
  const contentW = W - mg * 2;
  const HEADER_H = 26;
  const FOOTER_H = 32;
  const CONTENT_TOP = HEADER_H + 8;
  const CONTENT_BOTTOM = H - FOOTER_H - 6;

  const today = new Date().toLocaleDateString('fr-MA', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  // ── Logo (chargé une fois) ─────────────────────────────────────────────────
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

  // ── HEADER ─────────────────────────────────────────────────────────────────
  const drawHeader = () => {
    set.fill(C.headerBg, doc); doc.rect(0, 0, W, HEADER_H, 'F');
    // Badge logo blanc à gauche
    set.fill(C.white, doc); doc.roundedRect(mg, 6, 14, 14, 2.5, 2.5, 'F');
    if (logoDataUrl) {
      doc.addImage(logoDataUrl, 'PNG', mg + 1.5, 7.5, 11, 11);
    } else {
      set.text(C.primary, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
      doc.text('L', mg + 7, 16, { align: 'center' });
    }
    set.text(C.white, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text('Laboratoire El Allali', mg + 18, 13);
    set.text([255, 220, 225], doc); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    doc.text('Fiche de devis & préparation', mg + 18, 19);
    set.text([255, 200, 210], doc); doc.setFontSize(8.5);
    doc.text(today, W - mg, 16, { align: 'right' });
  };

  // ── FOOTER MARKETING ───────────────────────────────────────────────────────
  const drawMarketingFooter = () => {
    const fY = H - FOOTER_H;
    set.fill(C.headerBg, doc); doc.rect(0, fY, W, FOOTER_H, 'F');

    // Message wrapping
    set.text(C.white, doc); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    const msg = 'Installez notre application pour recevoir vos résultats, télécharger vos devis, prendre RDV et demander un prélèvement à domicile.';
    const msgLines = doc.splitTextToSize(msg, W - 30) as string[];
    msgLines.slice(0, 2).forEach((line, i) => {
      doc.text(line, W / 2, fY + 7 + i * 4.5, { align: 'center' });
    });

    // CTA pilule blanche
    const btnW = 78, btnH = 12, btnX = (W - btnW) / 2, btnY = fY + 17;
    set.fill(C.white, doc); doc.roundedRect(btnX, btnY, btnW, btnH, 6, 6, 'F');
    set.text(C.primary, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text('Téléchargez notre application', W / 2, btnY + 5.5, { align: 'center' });
    set.text([170, 60, 90], doc); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    doc.text('www.laboelallali.com', W / 2, btnY + 9.5, { align: 'center' });
  };

  let y = CONTENT_TOP;
  drawHeader();

  const newPage = () => {
    drawMarketingFooter();
    doc.addPage();
    drawHeader();
    y = CONTENT_TOP;
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > CONTENT_BOTTOM) newPage();
  };

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 1 — Vue d'ensemble
  // ══════════════════════════════════════════════════════════════════════════

  // ── Bloc Patient (border-left épaisse, pas de fond) ────────────────────────
  const patientH = 26;
  ensureSpace(patientH + 4);
  set.fill(C.primary, doc); doc.rect(mg, y, 1.6, patientH, 'F');
  set.text(C.primary, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
  doc.text('Patient', mg + 5, y + 7);

  set.text(C.textVariant, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
  doc.text('Nom :', mg + 5, y + 14.5);
  set.text(C.textPrimary, doc); doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
  doc.text(patientName ?? '—', mg + 18, y + 14.5);

  set.text(C.textVariant, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
  doc.text('Téléphone :', mg + 5, y + 22);
  set.text(C.textPrimary, doc); doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
  doc.text(patientPhone ?? '—', mg + 25, y + 22);

  y += patientH + 4;

  // ── Intro courte ───────────────────────────────────────────────────────────
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
  y += 10;

  // Body bordé
  const drawSectionLabel = (label: string) => {
    ensureSpace(8);
    set.fill(C.surfaceLow, doc); doc.rect(mg, y, contentW, 6, 'F');
    set.text(C.textVariant, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.text(label, mg + 4, y + 4.2);
    y += 6;
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
    drawSectionLabel('BILANS');
    bilans.forEach(b => drawItemRow(b.name, b.price));
  }
  if (analyses.length > 0) {
    drawSectionLabel('ANALYSES INDIVIDUELLES');
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

  // Carte gauche : Délai
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

  // Carte droite : Jeûne (ou pas de jeûne)
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

  y += cardH + 6;

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 2 — Détails techniques
  // ══════════════════════════════════════════════════════════════════════════
  newPage();

  // Titre section + note
  if (bilans.length > 0) {
    ensureSpace(16);
    set.text(C.textPrimary, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
    doc.text('DÉTAIL DE VOS BILANS', mg, y + 6);

    const noteLines = doc.splitTextToSize(
      'Les analyses appartenant à plusieurs bilans ne sont facturées qu\'une seule fois.',
      80
    ) as string[];
    set.text(C.textVariant, doc); doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5);
    noteLines.forEach((line, i) => {
      doc.text(line, W - mg, y + 4 + i * 3.5, { align: 'right' });
    });

    y += 9;
    set.draw(C.outline, doc); doc.setLineWidth(0.25);
    doc.line(mg, y, W - mg, y);
    y += 5;

    bilans.forEach(bilan => {
      const comp = bilan.compositionNames ?? [];
      // header bilan
      ensureSpace(11);
      set.fill(C.primary, doc); doc.roundedRect(mg, y, contentW, 9.5, 2, 2, 'F');
      set.text(C.white, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
      const bilanName = bilan.name.length > 60 ? bilan.name.slice(0, 58) + '…' : bilan.name;
      doc.text(bilanName, mg + 4, y + 6.5);
      y += 9.5;

      // bloc composition (indenté légèrement)
      if (comp.length > 0) {
        const innerPad = 4;
        const lineH = 6;
        const blockH = comp.length * lineH + innerPad * 2;
        ensureSpace(blockH + 4);
        set.fill(C.surfaceLow, doc);
        doc.roundedRect(mg + 4, y, contentW - 8, blockH, 1.5, 1.5, 'F');
        set.draw(C.outline, doc); doc.setLineWidth(0.2);
        doc.roundedRect(mg + 4, y, contentW - 8, blockH, 1.5, 1.5);

        let lY = y + innerPad + 3.5;
        comp.forEach(name => {
          ensureSpace(lineH);
          set.fill(C.primary, doc); doc.circle(mg + 9, lY - 1.2, 0.9, 'F');
          set.text(C.textPrimary, doc); doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5);
          const trunc = name.length > 60 ? name.slice(0, 58) + '…' : name;
          doc.text(trunc, mg + 12.5, lY);
          lY += lineH;
        });
        y += blockH;
      } else {
        ensureSpace(8);
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
      // petit cercle accent à gauche du label
      set.fill(C.primary, doc); doc.circle(tx + 4, ty + pillH / 2, 1.3, 'F');
      set.text(C.textPrimary, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
      doc.text(label, tx + 7, ty + pillH / 2 + 1.5);
      tx += tw + 3;
    });
    y = ty + pillH + 6;
  }

  // ── Documents à préparer ───────────────────────────────────────────────────
  ensureSpace(16);
  set.text(C.textPrimary, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
  doc.text('DOCUMENTS À PRÉPARER', mg, y + 6);
  y += 8;
  set.draw(C.outline, doc); doc.setLineWidth(0.25);
  doc.line(mg, y, W - mg, y);
  y += 5;

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
    const titleH = 5;
    const descLines = doc.splitTextToSize(d.desc, contentW - 22) as string[];
    return { ...d, descLines, h: Math.max(docItemMin, titleH + descLines.length * 4 + 3) };
  });
  const blockH = docPad * 2 + docRows.reduce((acc, r) => acc + r.h, 0) + 2 * (docRows.length - 1);
  ensureSpace(blockH + 4);

  // Carte conteneur
  set.fill(C.surfaceLow, doc); doc.roundedRect(mg, y, contentW, blockH, 3, 3, 'F');
  set.draw(C.outline, doc); doc.setLineWidth(0.25);
  doc.roundedRect(mg, y, contentW, blockH, 3, 3);

  let docY = y + docPad;
  docRows.forEach((r, idx) => {
    // cercle icône
    const iconCx = mg + 8;
    const iconCy = docY + 4;
    set.fill(C.surfaceHi, doc); doc.circle(iconCx, iconCy, 3.5, 'F');
    set.text(C.primary, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
    doc.text(r.icon, iconCx, iconCy + 1.2, { align: 'center' });

    // titre
    set.text(C.textPrimary, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5);
    doc.text(r.title, mg + 14, docY + 4);

    // description
    set.text(C.textVariant, doc); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text(r.descLines, mg + 14, docY + 8.5);

    docY += r.h + (idx < docRows.length - 1 ? 2 : 0);
  });

  y += blockH + 4;

  drawMarketingFooter();

  // ══════════════════════════════════════════════════════════════════════════
  // SAUVEGARDE — Web Share API sur mobile, doc.save() en fallback
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
