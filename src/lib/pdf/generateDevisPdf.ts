export interface GenerateDevisPdfOptions {
  bilans: Array<{
    name: string;
    price: number;
    composition?: Array<{ name: string; price: number }>;
  }>;
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

// ── Palette M3 ───────────────────────────────────────────────────────────────
const C = {
  headerBg:     [145,   0,  47] as const, // #91002F
  primary:      [181,   0,  61] as const, // #B5003D
  primaryHot:   [227,   0,  79] as const, // #E3004F
  primaryDeep:  [ 80,   0,  25] as const,
  surfaceLow:   [255, 240, 240] as const, // #FFF0F0
  surfaceMid:   [255, 230, 233] as const,
  surfaceHi:    [255, 218, 220] as const, // #FFDADC
  outline:      [230, 188, 191] as const, // #E6BCBF
  textPrimary:  [ 40,  23,  24] as const, // #281718
  textVariant:  [ 92,  63,  66] as const, // #5C3F42
  textMuted:    [140, 100, 105] as const,
  textGreyed:   [170, 145, 148] as const, // doublon
  white:        [255, 255, 255] as const,
  successGreen: [  5, 150, 105] as const, // #059669
  warningAmber: [217, 119,   6] as const, // #D97706
  successBg:    [220, 245, 232] as const,
  warningBg:    [254, 240, 215] as const,
};

type Doc = import('jspdf').jsPDF;
const set = {
  fill: ([r, g, b]: readonly number[], doc: Doc) => doc.setFillColor(r, g, b),
  draw: ([r, g, b]: readonly number[], doc: Doc) => doc.setDrawColor(r, g, b),
  text: ([r, g, b]: readonly number[], doc: Doc) => doc.setTextColor(r, g, b),
};

// URLs liens cliquables
const URLS = {
  home:     'https://www.laboelallali.com',
  analyses: 'https://www.laboelallali.com/fr/analyses',
  rdv:      'https://www.laboelallali.com/fr/appointment',
  glabo:    'https://www.laboelallali.com/fr/glabo',
  contact:  'https://www.laboelallali.com/fr/contact',
  tel:      'tel:0528843384',
  whatsapp: 'https://wa.me/212654079592',
  email:    'mailto:laboelallali@gmail.com',
};

export async function generateDevisPdf(opts: GenerateDevisPdfOptions): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const QRCode = (await import('qrcode')).default;
  const {
    bilans, analyses, totalCost, currencyLabel,
    maxJeune, maxDRR, sampleTypes,
    patientName, patientPhone,
  } = opts;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });

  const W = 210, H = 297, mg = 14;
  const contentW = W - mg * 2;
  const HEADER_H = 24;
  const FOOTER_H = 44;
  const CONTENT_TOP = HEADER_H + 6;
  const CONTENT_BOTTOM = H - FOOTER_H - 5;

  const today = new Date().toLocaleDateString('fr-MA', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  // ── Logo (utilise logo-footer.png qui est "L blanc sur carré rouge") ──────
  let logoDataUrl: string | null = null;
  try {
    await new Promise<void>((res, rej) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const px = 160;
        const cv = document.createElement('canvas');
        cv.width = px; cv.height = px;
        cv.getContext('2d')!.drawImage(img, 0, 0, px, px);
        logoDataUrl = cv.toDataURL('image/png');
        res();
      };
      img.onerror = rej;
      img.src = '/images/icons/logo-footer.png';
    });
  } catch { /* skip */ }

  // ── QR Code ────────────────────────────────────────────────────────────────
  const QR_TARGET = URLS.home;
  let qrDataUrl = '';
  try {
    qrDataUrl = await QRCode.toDataURL(QR_TARGET, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 320,
      color: { dark: '#FFFFFF', light: '#E3004F' },
    });
  } catch { /* skip */ }

  // ══════════════════════════════════════════════════════════════════════════
  // Icônes dessinées
  // ══════════════════════════════════════════════════════════════════════════
  const drawClockIcon = (cx: number, cy: number, r: number, color: readonly number[]) => {
    set.draw(color, doc); doc.setLineWidth(0.5);
    doc.circle(cx, cy, r);
    doc.setLineWidth(0.7);
    doc.line(cx, cy, cx, cy - r * 0.55);
    doc.line(cx, cy, cx + r * 0.45, cy);
  };

  const drawHourglassIcon = (cx: number, cy: number, r: number, color: readonly number[]) => {
    set.draw(color, doc); doc.setLineWidth(0.5);
    doc.line(cx - r, cy - r, cx + r, cy - r);
    doc.line(cx - r, cy + r, cx + r, cy + r);
    doc.line(cx - r, cy - r, cx + r, cy + r);
    doc.line(cx + r, cy - r, cx - r, cy + r);
  };

  const drawCheckIcon = (cx: number, cy: number, r: number, color: readonly number[]) => {
    set.draw(color, doc); doc.setLineWidth(0.8);
    doc.line(cx - r * 0.6, cy, cx - r * 0.1, cy + r * 0.55);
    doc.line(cx - r * 0.1, cy + r * 0.55, cx + r * 0.7, cy - r * 0.5);
  };

  const drawCardIcon = (cx: number, cy: number, r: number, color: readonly number[]) => {
    set.draw(color, doc); doc.setLineWidth(0.5);
    doc.roundedRect(cx - r * 0.9, cy - r * 0.65, r * 1.8, r * 1.3, 0.5, 0.5);
    doc.line(cx - r * 0.5, cy + 0.05, cx + r * 0.6, cy + 0.05);
    doc.line(cx - r * 0.5, cy + r * 0.35, cx + r * 0.4, cy + r * 0.35);
  };

  const drawPaperIcon = (cx: number, cy: number, r: number, color: readonly number[]) => {
    set.draw(color, doc); doc.setLineWidth(0.5);
    doc.roundedRect(cx - r * 0.7, cy - r, r * 1.4, r * 2, 0.5, 0.5);
    doc.line(cx - r * 0.4, cy - r * 0.4, cx + r * 0.4, cy - r * 0.4);
    doc.line(cx - r * 0.4, cy, cx + r * 0.4, cy);
    doc.line(cx - r * 0.4, cy + r * 0.4, cx + r * 0.2, cy + r * 0.4);
  };

  const drawShieldIcon = (cx: number, cy: number, r: number, color: readonly number[]) => {
    set.draw(color, doc); doc.setLineWidth(0.5);
    doc.line(cx - r * 0.8, cy - r * 0.7, cx + r * 0.8, cy - r * 0.7);
    doc.line(cx - r * 0.8, cy - r * 0.7, cx - r * 0.8, cy + r * 0.2);
    doc.line(cx + r * 0.8, cy - r * 0.7, cx + r * 0.8, cy + r * 0.2);
    doc.line(cx - r * 0.8, cy + r * 0.2, cx, cy + r);
    doc.line(cx + r * 0.8, cy + r * 0.2, cx, cy + r);
    doc.setLineWidth(0.7);
    doc.line(cx, cy - r * 0.35, cx, cy + r * 0.3);
    doc.line(cx - r * 0.3, cy - r * 0.05, cx + r * 0.3, cy - r * 0.05);
  };

  const drawDropletIcon = (cx: number, cy: number, r: number, color: readonly number[]) => {
    set.fill(color, doc);
    doc.circle(cx, cy + r * 0.25, r * 0.7, 'F');
    doc.triangle(cx - r * 0.7, cy + r * 0.2, cx + r * 0.7, cy + r * 0.2, cx, cy - r, 'F');
  };

  // ══════════════════════════════════════════════════════════════════════════
  // HEADER
  // ══════════════════════════════════════════════════════════════════════════
  const drawHeader = () => {
    set.fill(C.surfaceLow, doc); doc.rect(0, 0, W, HEADER_H, 'F');

    // Logo (L blanc sur carré rouge — utilisé directement, sans fond supplémentaire)
    if (logoDataUrl) {
      doc.addImage(logoDataUrl, 'PNG', mg, 5, 14, 14);
    } else {
      set.fill(C.primary, doc); doc.roundedRect(mg, 5, 14, 14, 3, 3, 'F');
      set.text(C.white, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
      doc.text('L', mg + 7, 15, { align: 'center' });
    }

    set.text(C.primaryDeep, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text('Laboratoire El Allali', mg + 18, 12);
    set.text(C.textVariant, doc); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    doc.text('Dossier de santé personnalisé', mg + 18, 17.5);

    if (patientName || patientPhone) {
      const pillW = 78;
      const pillH = 16;
      const pillX = W - mg - pillW;
      const pillY = (HEADER_H - pillH) / 2;
      set.fill(C.surfaceHi, doc); doc.roundedRect(pillX, pillY, pillW, pillH, 4, 4, 'F');
      if (patientName) {
        set.text(C.primaryDeep, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
        doc.text(patientName, pillX + 5, pillY + 6.5);
      }
      if (patientPhone) {
        set.text(C.textVariant, doc); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
        doc.text(patientPhone, pillX + 5, pillY + 12);
      }
      set.text(C.textMuted, doc); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
      doc.text(today, pillX + pillW - 4, pillY + 12, { align: 'right' });
    } else {
      set.text(C.textVariant, doc); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      doc.text(today, W - mg, HEADER_H / 2 + 1.5, { align: 'right' });
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // FOOTER (cliquable, sans caractères Unicode hors Latin-1)
  // ══════════════════════════════════════════════════════════════════════════
  const drawRichFooter = () => {
    const fY = H - FOOTER_H;
    set.fill(C.headerBg, doc); doc.rect(0, fY, W, FOOTER_H, 'F');

    const padX = mg;
    const colGap = 6;
    const colW = (W - padX * 2 - colGap * 2) / 3;
    const c1X = padX;
    const c2X = padX + colW + colGap;
    const c3X = padX + (colW + colGap) * 2;
    const topY = fY + 4;

    const labelColor: readonly number[] = [255, 200, 210];
    const valueColor: readonly number[] = [255, 245, 246];

    // ── COL 1 — CONTACT ──────────────────────────────────────────────────────
    set.text(labelColor, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
    doc.text('CONTACT', c1X, topY);

    set.text(valueColor, doc); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.8);
    const addrLines = doc.splitTextToSize('61 Bis, Rue de Marrakech, Agadir', colW) as string[];
    let ly = topY + 3.8;
    addrLines.forEach(l => { doc.text(l, c1X, ly); ly += 3.4; });
    ly += 0.5;

    // Tél (cliquable)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
    doc.text('Tél.', c1X, ly);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    const telValue = '0528 84 33 84';
    doc.text(telValue, c1X + 7, ly);
    const telW = doc.getTextWidth(telValue);
    doc.link(c1X + 7, ly - 3, telW, 4, { url: URLS.tel });
    ly += 4;

    // WhatsApp (cliquable)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
    doc.text('WhatsApp', c1X, ly);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    const waValue = '0654 07 95 92';
    doc.text(waValue, c1X + 15, ly);
    const waW = doc.getTextWidth(waValue);
    doc.link(c1X + 15, ly - 3, waW, 4, { url: URLS.whatsapp });
    ly += 4;

    // Email (cliquable)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
    doc.text('Email', c1X, ly);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    const emValue = 'laboelallali@gmail.com';
    doc.text(emValue, c1X + 9, ly);
    const emW = doc.getTextWidth(emValue);
    doc.link(c1X + 9, ly - 3, emW, 4, { url: URLS.email });

    // ── COL 2 — HORAIRES + LIENS (layout tabulaire propre) ───────────────────
    set.text(labelColor, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
    doc.text('HORAIRES', c2X, topY);

    set.text(valueColor, doc); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.8);
    // colonnes fixes : label à c2X, ':' à c2X+18, value à c2X+22
    const labelX = c2X;
    const colonX = c2X + 18;
    const valueX = c2X + 22;
    let hY = topY + 3.8;
    doc.text('Lun - Ven', labelX, hY);
    doc.text(':', colonX, hY);
    doc.text('7h30 - 18h30', valueX, hY);
    hY += 3.5;
    doc.text('Samedi', labelX, hY);
    doc.text(':', colonX, hY);
    doc.text('7h30 - 13h00', valueX, hY);
    hY += 5.5;

    set.text(labelColor, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
    doc.text('LIENS RAPIDES', c2X, hY);
    hY += 3.8;

    // Liens rapides : tracer chaque mot avec son doc.link individuel
    set.text(valueColor, doc); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.8);
    const drawLinks = (links: Array<{ text: string; url: string }>, yPos: number) => {
      let lx = c2X;
      links.forEach((lnk, i) => {
        const txt = lnk.text;
        doc.text(txt, lx, yPos);
        const w = doc.getTextWidth(txt);
        doc.link(lx, yPos - 3, w, 4, { url: lnk.url });
        lx += w;
        if (i < links.length - 1) {
          const sep = '  ·  ';
          doc.text(sep, lx, yPos);
          lx += doc.getTextWidth(sep);
        }
      });
    };

    drawLinks([
      { text: 'Accueil',   url: URLS.home },
      { text: 'Analyses',  url: URLS.analyses },
      { text: 'RDV',       url: URLS.rdv },
    ], hY);
    hY += 3.5;
    drawLinks([
      { text: 'GLABO à domicile', url: URLS.glabo },
      { text: 'Contact',          url: URLS.contact },
    ], hY);

    // ── COL 3 — APPLICATION ──────────────────────────────────────────────────
    set.text(labelColor, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
    doc.text('APPLICATION', c3X, topY);

    set.text(valueColor, doc); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.8);
    const ctaMsg = doc.splitTextToSize(
      'Vos résultats, devis et RDV depuis votre téléphone.',
      colW
    ) as string[];
    let cY = topY + 3.8;
    ctaMsg.forEach(l => { doc.text(l, c3X, cY); cY += 3.4; });
    cY += 1.5;

    // Bouton CTA pilule blanche
    const btnW = Math.min(colW, 58);
    const btnH = 10.5;
    set.fill(C.white, doc); doc.roundedRect(c3X, cY, btnW, btnH, 5.2, 5.2, 'F');
    set.text(C.primary, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
    doc.text("Télécharger l'app", c3X + btnW / 2, cY + 4.5, { align: 'center' });
    set.text([170, 60, 90], doc); doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8);
    doc.text('www.laboelallali.com', c3X + btnW / 2, cY + 8, { align: 'center' });
    doc.link(c3X, cY, btnW, btnH, { url: URLS.home });

    // Hairline + copyright (espace resserré avec le bouton)
    const sepY = fY + FOOTER_H - 6;
    set.fill([255, 255, 255], doc);
    doc.rect(padX, sepY, W - padX * 2, 0.15, 'F');
    set.text([255, 200, 210], doc); doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
    const year = new Date().getFullYear();
    doc.text(
      `(c) ${year}   Laboratoire El Allali   ·   Tous droits réservés`,
      W / 2, fY + FOOTER_H - 2.5, { align: 'center' }
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
  // 1) BLOC RÉSUMÉ — 2 colonnes : prix gauche / badges droite
  // ══════════════════════════════════════════════════════════════════════════
  const summaryH = 54;
  ensureSpace(summaryH + 4);

  set.fill(C.surfaceLow, doc);
  doc.roundedRect(mg, y, contentW, summaryH, 4, 4, 'F');

  // === Colonne gauche (60%) : prix énorme ===
  const leftColW = contentW * 0.58;
  const leftPad = 10;
  set.text(C.textMuted, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
  doc.text('VOTRE DEVIS', mg + leftPad, y + 11);

  set.text(C.primaryHot, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(34);
  doc.text(
    `${totalCost.toLocaleString('fr-MA')} ${currencyLabel}`,
    mg + leftPad, y + 32
  );

  set.text(C.textVariant, doc); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.text(`${bilans.length + analyses.length} analyse${(bilans.length + analyses.length) > 1 ? 's' : ''} sélectionnée${(bilans.length + analyses.length) > 1 ? 's' : ''}`, mg + leftPad, y + 42);

  // === Séparateur vertical doux ===
  set.fill(C.surfaceMid, doc);
  doc.rect(mg + leftColW, y + 8, 0.3, summaryH - 16, 'F');

  // === Colonne droite (40%) : badges empilés ===
  const rightX = mg + leftColW + 5;
  const rightW = contentW - leftColW - 10;
  const badgeH = 17;
  const badgeGap = 4;
  const badge1Y = y + (summaryH - badgeH * 2 - badgeGap) / 2;
  const badge2Y = badge1Y + badgeH + badgeGap;

  // Badge Délai
  set.fill(C.successBg, doc);
  doc.roundedRect(rightX, badge1Y, rightW, badgeH, 3, 3, 'F');
  drawClockIcon(rightX + 7, badge1Y + badgeH / 2, 3.2, C.successGreen);
  set.text(C.successGreen, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
  doc.text('DÉLAI', rightX + 14, badge1Y + 6.5);
  set.text(C.textPrimary, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
  doc.text(
    maxDRR === 0 ? 'Jour même' : `${maxDRR} jour${maxDRR > 1 ? 's' : ''}`,
    rightX + 14, badge1Y + 13
  );

  // Badge Jeûne
  if (maxJeune > 0) {
    set.fill(C.warningBg, doc);
    doc.roundedRect(rightX, badge2Y, rightW, badgeH, 3, 3, 'F');
    drawHourglassIcon(rightX + 7, badge2Y + badgeH / 2, 3, C.warningAmber);
    set.text(C.warningAmber, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
    doc.text('JEÛNE', rightX + 14, badge2Y + 6.5);
    set.text(C.textPrimary, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text(`${maxJeune} heures`, rightX + 14, badge2Y + 13);
  } else {
    set.fill(C.successBg, doc);
    doc.roundedRect(rightX, badge2Y, rightW, badgeH, 3, 3, 'F');
    drawCheckIcon(rightX + 7, badge2Y + badgeH / 2, 3, C.successGreen);
    set.text(C.successGreen, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
    doc.text('JEÛNE', rightX + 14, badge2Y + 6.5);
    set.text(C.textPrimary, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text('Non requis', rightX + 14, badge2Y + 13);
  }

  y += summaryH + 8;

  // ══════════════════════════════════════════════════════════════════════════
  // 2) GRILLE 2 COLONNES — Prélèvements / Documents (sous le résumé)
  // ══════════════════════════════════════════════════════════════════════════
  const docs = [
    { icon: 'card', title: "Carte d'Identité (CIN)", desc: "Format physique ou numérique." },
    { icon: 'paper', title: "Ordonnance médicale", desc: "Si disponible, sinon réalisable ultérieurement." },
    { icon: 'shield', title: "Carte Mutuelle / Assurance", desc: "Indispensable pour le tiers payant." },
  ] as const;

  const colW = (contentW - 8) / 2;
  const leftX = mg;
  const rightX2 = mg + colW + 8;

  const samplePillH = 9;
  const samplesPerRow = Math.max(1, Math.floor((colW - 8) / 42));
  const sampleRows = Math.ceil(sampleTypes.length / samplesPerRow);
  const samplesContentH = sampleTypes.length > 0
    ? 14 + sampleRows * (samplePillH + 4)
    : 14;
  const docItemH = 14;
  const docsContentH = 14 + docs.length * docItemH + 4;
  const gridH = Math.max(samplesContentH, docsContentH);

  ensureSpace(gridH + 4);

  // Prélèvements
  set.fill(C.surfaceLow, doc);
  doc.roundedRect(leftX, y, colW, gridH, 3, 3, 'F');
  set.text(C.textVariant, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
  doc.text('PRÉLÈVEMENTS', leftX + 5, y + 7);

  if (sampleTypes.length > 0) {
    let pX = leftX + 5;
    let pY = y + 13;
    sampleTypes.forEach(s => {
      const lbl = s.toUpperCase();
      const tw = lbl.length * 1.9 + 16;
      if (pX + tw > leftX + colW - 5) { pX = leftX + 5; pY += samplePillH + 4; }
      set.fill(C.surfaceHi, doc);
      doc.roundedRect(pX, pY, tw, samplePillH, 4.5, 4.5, 'F');
      drawDropletIcon(pX + 5, pY + samplePillH / 2, 1.8, C.primary);
      set.text(C.primaryDeep, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
      doc.text(lbl, pX + 9, pY + samplePillH / 2 + 1.5);
      pX += tw + 4;
    });
  } else {
    set.text(C.textMuted, doc); doc.setFont('helvetica', 'italic'); doc.setFontSize(9);
    doc.text('Aucune information de prélèvement.', leftX + 5, y + 16);
  }

  // Documents
  set.fill(C.surfaceLow, doc);
  doc.roundedRect(rightX2, y, colW, gridH, 3, 3, 'F');
  set.text(C.textVariant, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
  doc.text('DOCUMENTS À APPORTER', rightX2 + 5, y + 7);

  let dY = y + 12;
  docs.forEach(d => {
    const iconCx = rightX2 + 8.5;
    const iconCy = dY + 5;
    set.fill(C.surfaceHi, doc); doc.circle(iconCx, iconCy, 3.6, 'F');
    if (d.icon === 'card') drawCardIcon(iconCx, iconCy, 2.3, C.primaryDeep);
    else if (d.icon === 'paper') drawPaperIcon(iconCx, iconCy, 2.3, C.primaryDeep);
    else drawShieldIcon(iconCx, iconCy, 2.3, C.primaryDeep);

    set.text(C.textPrimary, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
    doc.text(d.title, rightX2 + 14.5, dY + 4.5);
    set.text(C.textVariant, doc); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text(d.desc, rightX2 + 14.5, dY + 9);
    dY += docItemH;
  });

  y += gridH + 8;

  // ══════════════════════════════════════════════════════════════════════════
  // 3) TABLEAU ANALYSES + Composition avec prix + détection doublons
  // ══════════════════════════════════════════════════════════════════════════
  ensureSpace(12);
  set.text(C.textVariant, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
  doc.text('DÉTAIL DE VOS ANALYSES', mg, y + 4);
  const cnt = bilans.length + analyses.length;
  set.text(C.textMuted, doc); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  doc.text(`${cnt} élément${cnt > 1 ? 's' : ''}`, W - mg, y + 4, { align: 'right' });
  y += 6;

  // Hairline sous le titre
  set.fill(C.surfaceMid, doc);
  doc.rect(mg, y, contentW, 0.3, 'F');
  y += 4;

  const normKey = (s: string) => s.replace(/\s+/g, '').toLowerCase();
  // Pour chaque analyse vue, on retient le nom du bilan (ou "analyse individuelle") qui l'a apportée en premier
  const firstSourceByKey = new Map<string, string>();

  // Helper : barre horizontale au milieu du texte (strikethrough)
  const drawStrikethrough = (
    textRightX: number, textBaselineY: number, textW: number, color: readonly number[]
  ) => {
    set.draw(color, doc); doc.setLineWidth(0.35);
    doc.line(textRightX - textW, textBaselineY - 1.2, textRightX, textBaselineY - 1.2);
  };

  // Bilans
  if (bilans.length > 0) {
    ensureSpace(7);
    set.text(C.primary, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
    doc.text('BILANS', mg, y + 4);
    y += 7;

    bilans.forEach(bilan => {
      const comp = bilan.composition ?? [];
      const headerH = 8;
      const innerPad = 3.5;
      const lineH = 5.5;
      const blockH = comp.length > 0
        ? comp.length * lineH + innerPad * 2
        : 7;
      const totalBilanH = headerH + blockH + 4;

      // Keep-together
      if (y + totalBilanH > CONTENT_BOTTOM) {
        const pageContentH = CONTENT_BOTTOM - CONTENT_TOP;
        if (totalBilanH <= pageContentH) newPage();
      }

      // Header bilan (nom + prix)
      set.text(C.textPrimary, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
      const tn = bilan.name.length > 48 ? bilan.name.slice(0, 46) + '…' : bilan.name;
      doc.text(tn, mg, y + 5.5);
      set.text(C.primaryHot, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
      doc.text(
        `${bilan.price.toLocaleString('fr-MA')} ${currencyLabel}`,
        W - mg, y + 5.5, { align: 'right' }
      );
      y += headerH;

      // Composition list
      if (comp.length > 0) {
        comp.forEach(a => {
          const key = normKey(a.name);
          const sourceBilanName = firstSourceByKey.get(key);
          const isDuplicate = sourceBilanName !== undefined;
          if (!isDuplicate) firstSourceByKey.set(key, bilan.name);

          const nameColor = isDuplicate ? C.textGreyed : C.textPrimary;
          const priceColor = isDuplicate ? C.textGreyed : C.textVariant;
          const fontStyle: 'italic' | 'normal' = isDuplicate ? 'italic' : 'normal';

          // Puce
          set.fill(isDuplicate ? C.textGreyed : C.primary, doc);
          doc.circle(mg + 6, y + innerPad + 1.5, 0.8, 'F');

          // Nom
          set.text(nameColor, doc); doc.setFont('helvetica', fontStyle); doc.setFontSize(10);
          const aname = a.name.length > 50 ? a.name.slice(0, 48) + '…' : a.name;
          doc.text(aname, mg + 9.5, y + innerPad + 2.5);

          // Tag avec nom du bilan source si doublon
          if (isDuplicate && sourceBilanName) {
            const nameW = doc.getTextWidth(aname);
            set.text(C.textGreyed, doc); doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5);
            const tag = `(déjà incluse dans ${sourceBilanName})`;
            doc.text(tag, mg + 9.5 + nameW + 2, y + innerPad + 2.5);
          }

          // Prix (barré si doublon)
          set.text(priceColor, doc); doc.setFont('helvetica', fontStyle); doc.setFontSize(10);
          const priceText = `${a.price.toLocaleString('fr-MA')} ${currencyLabel}`;
          const priceY = y + innerPad + 2.5;
          doc.text(priceText, W - mg, priceY, { align: 'right' });
          if (isDuplicate) {
            const priceW = doc.getTextWidth(priceText);
            drawStrikethrough(W - mg, priceY, priceW, C.textGreyed);
          }

          y += lineH;
        });
        y += innerPad * 2 - lineH * 0 + 1;
      } else {
        set.text(C.textMuted, doc); doc.setFont('helvetica', 'italic'); doc.setFontSize(9);
        doc.text('Composition détaillée disponible au laboratoire.', mg + 9.5, y + 4);
        y += 7;
      }
      y += 3;
    });
    y += 2;
  }

  // Analyses individuelles
  if (analyses.length > 0) {
    ensureSpace(8);
    set.text(C.primary, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
    doc.text('ANALYSES INDIVIDUELLES', mg, y + 4);
    y += 7;

    analyses.forEach(a => {
      ensureSpace(8);
      const key = normKey(a.name);
      const sourceBilanName = firstSourceByKey.get(key);
      const isDuplicate = sourceBilanName !== undefined;
      if (!isDuplicate) firstSourceByKey.set(key, a.name);

      const nameColor = isDuplicate ? C.textGreyed : C.textPrimary;
      const priceColor = isDuplicate ? C.textGreyed : C.primaryHot;
      const fontStyle: 'italic' | 'normal' = isDuplicate ? 'italic' : 'normal';

      set.text(nameColor, doc); doc.setFont('helvetica', fontStyle); doc.setFontSize(11);
      const tn = a.name.length > 50 ? a.name.slice(0, 48) + '…' : a.name;
      doc.text(tn, mg, y + 5);

      if (isDuplicate && sourceBilanName) {
        const nameW = doc.getTextWidth(tn);
        set.text(C.textGreyed, doc); doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5);
        doc.text(`(déjà incluse dans ${sourceBilanName})`, mg + nameW + 2, y + 5);
      }

      set.text(priceColor, doc); doc.setFont('helvetica', isDuplicate ? 'italic' : 'bold'); doc.setFontSize(11);
      const priceText = `${a.price.toLocaleString('fr-MA')} ${currencyLabel}`;
      doc.text(priceText, W - mg, y + 5, { align: 'right' });
      if (isDuplicate) {
        const priceW = doc.getTextWidth(priceText);
        drawStrikethrough(W - mg, y + 5, priceW, C.textGreyed);
      }
      set.fill(C.surfaceMid, doc);
      doc.rect(mg, y + 7, contentW, 0.25, 'F');
      y += 8;
    });
    y += 2;
  }

  // Note 20 MAD en bas du tableau
  ensureSpace(8);
  set.text(C.textMuted, doc); doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5);
  doc.text(
    `+ 20 ${currencyLabel} de frais de prélèvement (comptés une seule fois)`,
    mg, y + 4
  );
  y += 9;

  // ══════════════════════════════════════════════════════════════════════════
  // 4) ENCART MARKETING — QR Code cliquable
  // ══════════════════════════════════════════════════════════════════════════
  const promoH = 56;
  ensureSpace(promoH + 4);

  const promoY = y;
  set.fill(C.primaryHot, doc); doc.roundedRect(mg, promoY, contentW, promoH, 4, 4, 'F');
  set.fill(C.primary, doc); doc.roundedRect(mg, promoY + promoH - 14, contentW, 14, 4, 4, 'F');
  set.fill(C.primaryHot, doc); doc.rect(mg, promoY + 4, contentW, promoH - 18, 'F');

  const qrSize = 36;
  const qrX = W - mg - qrSize - 5;
  const qrY = promoY + (promoH - qrSize) / 2;
  if (qrDataUrl) doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

  const txX = mg + 8;
  set.text(C.white, doc); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
  doc.text('VOTRE PARCOURS DE SANTÉ', txX, promoY + 9);

  doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
  const titleLines = doc.splitTextToSize(
    "Simplifiez votre parcours avec notre application",
    contentW - qrSize - 24
  ) as string[];
  titleLines.forEach((l, i) => doc.text(l, txX, promoY + 17 + i * 6));

  const subtitleY = promoY + 17 + titleLines.length * 6 + 2;
  set.text([255, 220, 225], doc); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  doc.text(
    'Prélèvement à domicile · Résultats en temps réel · Historique médical',
    txX, subtitleY
  );

  set.text([255, 220, 225], doc); doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8);
  const qrCaption = doc.splitTextToSize(
    "Scannez ce QR Code pour télécharger l'appli ou prendre RDV",
    qrSize + 8
  ) as string[];
  qrCaption.forEach((l, i) => {
    doc.text(l, qrX + qrSize / 2, promoY + promoH - 6 + i * 3, { align: 'center' });
  });

  doc.link(mg, promoY, contentW, promoH, { url: URLS.home });

  y += promoH + 4;

  drawRichFooter();

  // ══════════════════════════════════════════════════════════════════════════
  // SAUVEGARDE / TÉLÉCHARGEMENT & PARTAGE
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

  // Helper moderne et propre pour déclencher le téléchargement direct sans ouvrir de page blanche sur iOS Safari
  const triggerDirectDownload = () => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Délai court pour s'assurer que le navigateur a initié le téléchargement avant de révoquer l'URL
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 250);
  };

  if (isMobile) {
    // 1. Toujours télécharger le fichier en premier
    triggerDirectDownload();

    // 2. Si le partage est supporté sur mobile, proposer également de le partager
    if (nav?.canShare && nav.canShare({ files: [file] }) && nav.share) {
      try {
        await nav.share({
          files: [file],
          title: 'Devis Laboratoire El Allali',
          text: 'Voici votre fiche de préparation.',
        });
      } catch (error) {
        // Ignorer l'erreur AbortError (lorsque l'utilisateur annule le partage)
      }
    }
  } else {
    // Sur desktop, utiliser le téléchargement direct propre (évite les failles de doc.save() sur Safari)
    triggerDirectDownload();
  }
}
