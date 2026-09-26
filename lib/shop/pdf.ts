/**
 * PDF documents for the Shop tab (estimate, invoice, lien acknowledgment +
 * credit disclosure, shop sign), drawn with pdf-lib's standard fonts so they
 * work in serverless functions without font files.
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type PDFImage } from 'pdf-lib';
import { formatCents } from './money';
import { formatDate, formatDateTime } from './dates';
import { methodLabel } from './rules';
import type { AcknowledgmentDoc, DocLine, EstimateDoc, ShopIdentity } from './documents';
import type { InvoiceSnapshot, ShopSettings } from './types';
import { docLine } from './documents';

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 46;
const INK = rgb(0.07, 0.09, 0.15);
const MUTED = rgb(0.42, 0.45, 0.5);
const RULE = rgb(0.85, 0.87, 0.9);
const ACCENT = rgb(0.86, 0.15, 0.15);

// pdf-lib's standard fonts use WinAnsi encoding; swap anything else for a safe equivalent.
const WINANSI_EXTRA = new Set([0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178]);
function clean(input: string | null | undefined): string {
  let out = '';
  for (const ch of String(input ?? '')) {
    const c = ch.codePointAt(0)!;
    if (c === 0x2212) out += '-';
    else if (c === 0x00a0 || c === 0x202f || c === 0x2009) out += ' ';
    else if (c === 0x2192) out += '->';
    else if (c === 0x2713 || c === 0x2714) out += 'x';
    else if (c === 10 || c === 13) out += ' ';
    else if ((c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || WINANSI_EXTRA.has(c)) out += ch;
    else out += '?';
  }
  return out;
}

class Writer {
  doc: PDFDocument;
  font: PDFFont;
  bold: PDFFont;
  page!: PDFPage;
  y = 0;
  pages: PDFPage[] = [];
  footer: string;

  constructor(doc: PDFDocument, font: PDFFont, bold: PDFFont, footer: string) {
    this.doc = doc;
    this.font = font;
    this.bold = bold;
    this.footer = footer;
    this.newPage();
  }

  newPage() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.pages.push(this.page);
    this.y = PAGE_H - MARGIN;
  }

  ensure(space: number) {
    if (this.y - space < MARGIN + 18) this.newPage();
  }

  wrap(text: string, font: PDFFont, size: number, width: number): string[] {
    const lines: string[] = [];
    for (const para of String(text ?? '').split('\n').map(clean)) {
      const words = para.split(' ');
      let line = '';
      for (const w of words) {
        const next = line ? `${line} ${w}` : w;
        if (font.widthOfTextAtSize(next, size) <= width) line = next;
        else {
          if (line) lines.push(line);
          line = w;
          while (font.widthOfTextAtSize(line, size) > width && line.length > 1) {
            let cut = line.length - 1;
            while (cut > 1 && font.widthOfTextAtSize(line.slice(0, cut), size) > width) cut--;
            lines.push(line.slice(0, cut));
            line = line.slice(cut);
          }
        }
      }
      lines.push(line);
    }
    return lines;
  }

  /** Paragraph at the current y, wrapped to width. */
  text(text: string, opts: { x?: number; size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; width?: number; lineGap?: number } = {}) {
    const size = opts.size ?? 9.5;
    const font = opts.font ?? this.font;
    const x = opts.x ?? MARGIN;
    const width = opts.width ?? PAGE_W - MARGIN - x;
    const lh = size * (opts.lineGap ?? 1.35);
    for (const line of this.wrap(text, font, size, width)) {
      this.ensure(lh);
      this.page.drawText(line, { x, y: this.y - size, size, font, color: opts.color ?? INK });
      this.y -= lh;
    }
  }

  /** A table row of wrapped columns; returns nothing, advances y by the tallest cell. */
  row(cells: { text: string; x: number; width: number; align?: 'left' | 'right'; font?: PDFFont; size?: number; color?: ReturnType<typeof rgb> }[], opts: { gapAfter?: number } = {}) {
    const prepared = cells.map(c => {
      const size = c.size ?? 9;
      const font = c.font ?? this.font;
      return { ...c, size, font, lines: this.wrap(c.text, font, size, c.width) };
    });
    const height = Math.max(...prepared.map(c => c.lines.length * c.size * 1.3));
    this.ensure(height + 4);
    for (const c of prepared) {
      c.lines.forEach((line, i) => {
        const w = c.font.widthOfTextAtSize(line, c.size);
        const x = c.align === 'right' ? c.x + c.width - w : c.x;
        this.page.drawText(line, { x, y: this.y - c.size - i * c.size * 1.3, size: c.size, font: c.font, color: c.color ?? INK });
      });
    }
    this.y -= height + (opts.gapAfter ?? 4);
  }

  rule(thickness = 0.6, color = RULE) {
    this.ensure(6);
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: PAGE_W - MARGIN, y: this.y }, thickness, color });
    this.y -= 6;
  }

  gap(h: number) {
    this.y -= h;
  }

  finish() {
    this.pages.forEach((p, i) => {
      const label = clean(`${this.footer}   ·   Page ${i + 1} of ${this.pages.length}`);
      p.drawText(label, { x: MARGIN, y: 24, size: 7.5, font: this.font, color: MUTED });
    });
  }
}

async function start(footer: string) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  return { doc, w: new Writer(doc, font, bold, footer) };
}

function header(w: Writer, shop: ShopIdentity, title: string, metaLines: string[]) {
  const top = w.y;
  const leftW = 320;
  w.text(shop.name, { size: 15, font: w.bold, width: leftW });
  const contact = [shop.address, [shop.phone, shop.website].filter(Boolean).join(' · '), shop.email, shop.hst_number ? `HST ${shop.hst_number}` : null].filter(Boolean) as string[];
  for (const line of contact) w.text(line, { size: 8.5, color: MUTED, width: leftW });
  const leftBottom = w.y;
  // Right-aligned title block
  let ry = top;
  const drawRight = (text: string, size: number, font: PDFFont, color = INK) => {
    const t = clean(text);
    const width = font.widthOfTextAtSize(t, size);
    w.page.drawText(t, { x: PAGE_W - MARGIN - width, y: ry - size, size, font, color });
    ry -= size * 1.4;
  };
  drawRight(title, 17, w.bold);
  for (const m of metaLines) drawRight(m, 8.5, w.font, MUTED);
  w.y = Math.min(leftBottom, ry) - 4;
  w.page.drawLine({ start: { x: MARGIN, y: w.y }, end: { x: PAGE_W - MARGIN, y: w.y }, thickness: 1.6, color: INK });
  w.gap(10);
}

function infoColumns(w: Writer, cols: { label: string; lines: string[] }[]) {
  const colW = (PAGE_W - MARGIN * 2 - 16 * (cols.length - 1)) / cols.length;
  const labelCells = cols.map((c, i) => ({ text: c.label.toUpperCase(), x: MARGIN + i * (colW + 16), width: colW, size: 7, color: MUTED, font: w.bold }));
  w.row(labelCells, { gapAfter: 2 });
  const maxLines = Math.max(...cols.map(c => c.lines.filter(Boolean).length));
  for (let i = 0; i < maxLines; i++) {
    w.row(cols.map((c, ci) => ({ text: c.lines.filter(Boolean)[i] ?? '', x: MARGIN + ci * (colW + 16), width: colW, size: 9, color: i === 0 ? INK : MUTED })), { gapAfter: 1 });
  }
  w.gap(8);
}

const COL = { desc: MARGIN, descW: 300, qty: MARGIN + 310, qtyW: 50, rate: MARGIN + 366, rateW: 70, amt: MARGIN + 442, amtW: PAGE_W - MARGIN * 2 - 442 };

function linesTable(w: Writer, lines: DocLine[]) {
  w.row([
    { text: 'DESCRIPTION', x: COL.desc, width: COL.descW, size: 7, font: w.bold, color: MUTED },
    { text: 'QTY / HRS', x: COL.qty, width: COL.qtyW, size: 7, font: w.bold, color: MUTED, align: 'right' },
    { text: 'RATE', x: COL.rate, width: COL.rateW, size: 7, font: w.bold, color: MUTED, align: 'right' },
    { text: 'AMOUNT', x: COL.amt, width: COL.amtW, size: 7, font: w.bold, color: MUTED, align: 'right' },
  ], { gapAfter: 2 });
  w.rule();
  for (const l of lines) {
    const desc = l.detail ? `${l.description}` : l.description;
    w.row([
      { text: desc + (l.added ? '  (added work, approved on a revised estimate)' : ''), x: COL.desc, width: COL.descW, size: 9, font: w.font },
      { text: l.qty, x: COL.qty, width: COL.qtyW, align: 'right', size: 9 },
      { text: l.rate, x: COL.rate, width: COL.rateW, align: 'right', size: 9 },
      { text: formatCents(l.amount_cents), x: COL.amt, width: COL.amtW, align: 'right', size: 9 },
    ], { gapAfter: l.detail ? 0 : 3 });
    if (l.detail) w.row([{ text: l.detail, x: COL.desc, width: COL.descW, size: 7.8, color: MUTED }], { gapAfter: 3 });
  }
  w.rule();
}

function totalsBlock(w: Writer, rows: { label: string; value: string; strong?: boolean }[]) {
  const x = PAGE_W - MARGIN - 220;
  for (const r of rows) {
    w.row([
      { text: r.label, x, width: 130, size: r.strong ? 11 : 9, font: r.strong ? w.bold : w.font },
      { text: r.value, x: x + 130, width: 90, size: r.strong ? 11 : 9, font: r.strong ? w.bold : w.font, align: 'right' },
    ], { gapAfter: 2 });
  }
  w.gap(6);
}

function legal(w: Writer, label: string, text: string) {
  w.text(`${label} ${text}`, { size: 8, color: MUTED });
  w.gap(2);
}

// ── Estimate ────────────────────────────────────────────────────────────────

export async function estimatePdf(doc: EstimateDoc): Promise<Buffer> {
  const { doc: pdf, w } = await start(`${doc.shop.name}  ·  ${doc.title.toLowerCase()} ${doc.number_label}`);
  header(w, doc.shop, doc.title, [
    doc.number_label,
    doc.date_label ? `Date: ${formatDate(doc.date_label)}` : 'Draft',
    doc.valid_until ? `Valid until ${formatDate(doc.valid_until)}` : '',
  ].filter(Boolean));
  infoColumns(w, [
    { label: 'Customer', lines: [doc.customer.name, doc.customer.phone ?? '', doc.customer.email ?? ''] },
    { label: 'Vehicle', lines: [doc.vehicle.description, doc.vehicle.vin ? `VIN ${doc.vehicle.vin}` : 'VIN not recorded', `Plate ${doc.vehicle.plate ?? '—'}`, `Odometer ${doc.vehicle.odometer != null ? doc.vehicle.odometer.toLocaleString('en-CA') + ' km' : '—'}`] },
    { label: 'Work requested', lines: [doc.work_requested, doc.ready_by ? `Ready by ${formatDate(doc.ready_by)}` : ''] },
  ]);
  linesTable(w, doc.lines);
  totalsBlock(w, [
    { label: 'Labour', value: formatCents(doc.totals.labour_cents) },
    { label: 'Subtotal', value: formatCents(doc.totals.subtotal_cents) },
    { label: `${doc.tax_label} ${(doc.tax_rate_bps / 100).toFixed(doc.tax_rate_bps % 100 ? 2 : 0)}%`, value: formatCents(doc.totals.tax_cents) },
    { label: 'Estimated total', value: formatCents(doc.totals.total_cents), strong: true },
  ]);
  if (doc.declined.length) legal(w, 'Recommended, declined for now:', doc.declined.map(d => `${d.description} (${formatCents(d.amount_cents)})`).join('; '));
  w.text(doc.ten_percent_statement, { size: 9, font: w.bold });
  w.gap(3);
  legal(w, '', doc.estimate_fee_statement);
  legal(w, '', doc.parts_statement);
  if (doc.other_charges) legal(w, 'Other charges:', doc.other_charges);
  if (doc.notes) legal(w, 'Notes:', doc.notes);
  w.gap(24);
  w.ensure(40);
  const lineY = w.y;
  w.page.drawLine({ start: { x: MARGIN, y: lineY }, end: { x: MARGIN + 250, y: lineY }, thickness: 0.8, color: INK });
  w.page.drawLine({ start: { x: MARGIN + 290, y: lineY }, end: { x: PAGE_W - MARGIN, y: lineY }, thickness: 0.8, color: INK });
  w.gap(4);
  w.row([
    { text: 'Customer approval (signature, or a recorded phone approval)', x: MARGIN, width: 250, size: 7.5, color: MUTED },
    { text: 'Date and time', x: MARGIN + 290, width: 200, size: 7.5, color: MUTED },
  ]);
  w.finish();
  return Buffer.from(await pdf.save());
}

// ── Invoice ─────────────────────────────────────────────────────────────────

export async function invoicePdf(s: InvoiceSnapshot, opts: { paid_cents?: number; void_reason?: string | null } = {}): Promise<Buffer> {
  const { doc: pdf, w } = await start(`${s.shop.name}  ·  invoice ${s.number_label}  ·  RO-${s.ro_number}`);
  header(w, s.shop, opts.void_reason ? 'INVOICE (VOID)' : 'INVOICE', [s.number_label, `Date: ${formatDate(s.issued_on)}`, `RO-${s.ro_number}`]);
  infoColumns(w, [
    { label: 'Customer', lines: [s.customer.name, s.customer.phone ?? '', s.customer.email ?? '', s.customer.address ?? ''] },
    { label: 'Vehicle', lines: [s.vehicle.description, s.vehicle.vin ? `VIN ${s.vehicle.vin}` : 'VIN not recorded', `Plate ${s.vehicle.plate ?? '—'}`, `Odometer in ${fmtNum(s.vehicle.odometer_in)} / out ${fmtKm(s.vehicle.odometer_out)}`] },
    { label: 'Dates', lines: [`Approved: ${s.dates.authorized ? formatDateTime(s.dates.authorized) : '—'}`, `Completed: ${s.dates.completed ? formatDate(s.dates.completed) : '—'}`, `Returned: ${s.dates.returned ? formatDate(s.dates.returned) : 'at pickup'}`] },
  ]);
  w.text(`Work requested: ${s.work_requested}`, { size: 8.5, color: MUTED });
  w.gap(6);
  linesTable(w, s.lines.map(docLine));
  const rows: { label: string; value: string; strong?: boolean }[] = [
    { label: 'Labour', value: formatCents(s.totals.labour_cents) },
    { label: 'Parts', value: formatCents(s.totals.parts_cents) },
  ];
  if (s.totals.supplies_cents) rows.push({ label: 'Shop supplies', value: formatCents(s.totals.supplies_cents) });
  rows.push(
    { label: 'Subtotal', value: formatCents(s.totals.subtotal_cents) },
    { label: `${s.totals.tax_label} ${(s.totals.tax_rate_bps / 100).toFixed(s.totals.tax_rate_bps % 100 ? 2 : 0)}%`, value: formatCents(s.totals.tax_cents) },
    { label: 'Total', value: formatCents(s.totals.total_cents), strong: true },
  );
  if (opts.paid_cents) {
    rows.push({ label: 'Paid', value: formatCents(opts.paid_cents) }, { label: 'Balance due', value: formatCents(s.totals.total_cents - opts.paid_cents), strong: true });
  }
  totalsBlock(w, rows);
  if (opts.void_reason) { w.text(`VOID: ${opts.void_reason}`, { size: 10, font: w.bold, color: ACCENT }); w.gap(4); }
  if (s.declined.length) legal(w, 'Recommended, declined for now:', s.declined.map(d => d.description).join('; '));
  if (s.estimate) legal(w, 'Estimate:', `${s.estimate.label}, ${formatCents(s.estimate.total_cents)}.`);
  if (s.authorization) legal(w, 'Approved:', `${methodLabel(s.authorization.method)} by ${s.authorization.by}${s.authorization.phone && s.authorization.method === 'phone' ? ` at ${s.authorization.phone}` : ''}, ${formatDateTime(s.authorization.when)}${s.authorization.taken_by ? `; taken by ${s.authorization.taken_by}` : ''}.`);
  if (s.estimate_fee_note) legal(w, 'Estimate fee:', s.estimate_fee_note);
  if (s.parts_returned != null) legal(w, 'Replaced parts:', s.parts_returned ? 'returned to you in a clean container.' : 'you told us when approving that you don’t want them back.');
  legal(w, 'Payment:', `${s.payment_terms}. ${s.payment_methods}.`);
  if (s.kind === 'repair') {
    legal(w, 'Warranty:', s.warranty_text);
    if (s.warranty_extra) legal(w, 'Our warranty:', s.warranty_extra);
  }
  w.gap(4);
  w.ensure(60);
  w.text(s.statutory_statement, { size: 7.8, color: INK, lineGap: 1.3 });
  w.finish();
  return Buffer.from(await pdf.save());
}

function fmtKm(v: number | null | undefined) {
  return v == null ? '—' : `${v.toLocaleString('en-CA')} km`;
}

function fmtNum(v: number | null | undefined) {
  return v == null ? '—' : v.toLocaleString('en-CA');
}

// ── Lien acknowledgment + credit disclosure ────────────────────────────────

export async function acknowledgmentPdf(a: AcknowledgmentDoc, signaturePng: Buffer | null): Promise<Buffer> {
  const { doc: pdf, w } = await start(`${a.shop.name}  ·  acknowledgment of indebtedness  ·  ${a.invoice_label}`);
  header(w, a.shop, 'ACKNOWLEDGMENT', [`Invoice ${a.invoice_label}`, `Released ${formatDate(a.released_on)}`]);
  w.text('Acknowledgment of indebtedness and payment agreement', { size: 12, font: w.bold });
  w.gap(6);
  w.text(`I, ${a.signer_name} (${a.signer_capacity.toLowerCase()}), ${a.lien_text.replace(/^I acknowledge/, 'acknowledge')}`, { size: 9.5 });
  w.gap(6);
  infoColumns(w, [
    { label: 'Vehicle', lines: [a.vehicle.description, a.vehicle.vin ? `VIN ${a.vehicle.vin}` : 'VIN not recorded', `Plate ${a.vehicle.plate ?? '—'}${a.vehicle.color ? ` · ${a.vehicle.color}` : ''}`] },
    { label: 'Amounts', lines: [`Invoice total ${formatCents(a.invoice_total_cents)}`, `Paid today ${formatCents(a.down_payment_cents)}`, `Owing ${formatCents(a.owing_cents)}`] },
  ]);
  w.text(a.terms_text, { size: 9.5 });
  w.gap(6);
  w.row([
    { text: 'DUE', x: MARGIN, width: 150, size: 7, font: w.bold, color: MUTED },
    { text: 'AMOUNT', x: MARGIN + 160, width: 100, size: 7, font: w.bold, color: MUTED, align: 'right' },
  ]);
  w.rule();
  for (const item of a.schedule) {
    w.row([{ text: formatDate(item.due), x: MARGIN, width: 150, size: 9 }, { text: formatCents(item.amount_cents), x: MARGIN + 160, width: 100, size: 9, align: 'right' }], { gapAfter: 1 });
  }
  w.gap(18);
  w.ensure(90);
  if (signaturePng) {
    try {
      const img: PDFImage = await pdf.embedPng(signaturePng);
      const scale = Math.min(200 / img.width, 60 / img.height, 1);
      w.page.drawImage(img, { x: MARGIN, y: w.y - img.height * scale, width: img.width * scale, height: img.height * scale });
      w.gap(img.height * scale + 2);
    } catch { /* unreadable signature image: leave the line for a wet signature */ }
  } else {
    w.gap(30);
  }
  const lineY = w.y;
  w.page.drawLine({ start: { x: MARGIN, y: lineY }, end: { x: MARGIN + 250, y: lineY }, thickness: 0.8, color: INK });
  w.page.drawLine({ start: { x: MARGIN + 290, y: lineY }, end: { x: PAGE_W - MARGIN, y: lineY }, thickness: 0.8, color: INK });
  w.gap(4);
  w.row([
    { text: `Signature of ${a.signer_name}`, x: MARGIN, width: 250, size: 7.5, color: MUTED },
    { text: `Date: ${a.signed_at ? formatDateTime(a.signed_at) : ''}`, x: MARGIN + 290, width: 200, size: 7.5, color: MUTED },
  ]);

  if (a.credit_disclosure) {
    const cd = a.credit_disclosure;
    w.newPage();
    header(w, a.shop, 'CREDIT DISCLOSURE', [`Invoice ${a.invoice_label}`, 'Consumer Protection Act, 2002, Part VII']);
    w.text('Initial disclosure statement for a supplier credit agreement', { size: 12, font: w.bold });
    w.gap(8);
    const rows: [string, string][] = [
      ['Creditor', `${a.shop.name}${a.shop.address ? `, ${a.shop.address}` : ''}`],
      ['Borrower', a.customer_name],
      ['Amount owing (amount financed)', formatCents(cd.amount_financed_cents)],
      ['Annual percentage rate', cd.apr_text],
      ['Cost of borrowing', formatCents(cd.cost_of_borrowing_cents)],
      ['Total of all payments', formatCents(cd.total_of_payments_cents)],
      ['Number of payments', String(cd.payments.length)],
      ['First payment', cd.payments[0] ? `${formatCents(cd.payments[0].amount_cents)} on ${formatDate(cd.payments[0].due)}` : '—'],
      ['Last payment', cd.payments.length ? `${formatCents(cd.payments[cd.payments.length - 1].amount_cents)} on ${formatDate(cd.payments[cd.payments.length - 1].due)}` : '—'],
      ['Paying early', cd.prepayment_text],
      ['If a payment is missed', cd.default_text],
      ['Security', 'The repairer’s lien on the vehicle under the Repair and Storage Liens Act. No other security is taken.'],
    ];
    for (const [k, v] of rows) {
      w.row([{ text: k, x: MARGIN, width: 170, size: 9, font: w.bold }, { text: v, x: MARGIN + 180, width: PAGE_W - MARGIN * 2 - 180, size: 9 }], { gapAfter: 5 });
    }
    w.gap(10);
    w.text('The full payment schedule is on the acknowledgment page. Keep this statement with your copy of the agreement.', { size: 8.5, color: MUTED });
  }
  w.finish();
  return Buffer.from(await pdf.save());
}

// ── Shop sign (O. Reg. 17/05, s. 50) ────────────────────────────────────────

export async function shopSignPdf(settings: ShopSettings, shopName: string): Promise<Buffer> {
  const { doc: pdf, w } = await start(`${shopName}  ·  Consumer Protection Act, 2002 and O. Reg. 17/05, s. 50`);
  w.text(shopName, { size: 16, font: w.bold, color: MUTED });
  w.gap(4);
  w.text('Your rights when we repair your vehicle', { size: 26, font: w.bold, lineGap: 1.15 });
  w.gap(14);
  const labour = `We charge ${formatCents(settings.labour_rate_cents)} per hour of labour.${settings.flat_rate_policy ? ` ${settings.flat_rate_policy}` : ''}${settings.diagnostic_policy ? ` ${settings.diagnostic_policy}` : ''}`;
  const items: [string, string][] = [
    ['A written estimate', 'You have the right to a written estimate before we do any work. We can work without one only if you decline it and approve the most you will pay, and we will never charge more than that amount.'],
    ['The estimate fee', settings.estimate_fee_cents > 0
      ? `We charge ${formatCents(settings.estimate_fee_cents)} to prepare an estimate. We will tell you before we start, and we don’t charge it if you approve the work and we do it (except when we can’t reach you and must reassemble your vehicle to free a bay).`
      : 'We don’t charge for estimates.'],
    ['No more than 10% over', 'We will not charge more than 10% above the estimate you approve, and we won’t do any work you haven’t approved.'],
    ['How we charge for labour', labour],
    ['Parts commissions', settings.parts_commission_policy],
    ['Other charges', settings.other_charges || 'We don’t charge for storage, pick-up, delivery or loaner vehicles.'],
    ['Your old parts', 'Replaced parts are available to you. Tell us when you approve the work if you don’t want them. Exceptions: parts we didn’t charge you for, and parts replaced under a warranty that must go back to the manufacturer or distributor.'],
    ['Warranty', 'New and reconditioned parts and the labour to install them are warranted for at least 90 days or 5,000 km, whichever comes first.'],
  ];
  for (const [title, body] of items) {
    w.ensure(60);
    w.text(title, { size: 14, font: w.bold });
    w.gap(2);
    w.text(body, { size: 11.5, lineGap: 1.4 });
    w.gap(12);
  }
  w.finish();
  return Buffer.from(await pdf.save());
}
