# Shop tab

A service desk for auto repair shops: key drop-off log, board with bays, job files,
estimates with part-source memory, approvals, invoices, payments, repair liens and
payment plans, the supplier-invoice pile, HST/P&L reports and QuickBooks exports.
Built around Ontario's repair rules (CPA 2002 Part VI, O. Reg. 17/05, the Repair and
Storage Liens Act, CPA Part VII for instalment plans).

## Turning it on

The tab is feature-flagged per site, like Marketing.

1. Run `migrations/094_shop.sql` (tables, RLS, numbering function, private `shop-files` bucket).
2. Enable a site: `UPDATE sites SET shop_enabled = true WHERE id = '<site id>';`
3. In the site's admin: Shop → Settings. Fill in the legal name, address, phone and HST
   number (estimates can't be sent without them), bays, staff and suppliers, then print
   the counter sign.
4. Set a PIN under "Bay phones and tablets". On the shop phone/tablet, open `/shop-tech`
   and sign in once with the shop code and PIN.

## Environment

| Variable | Needed for |
| --- | --- |
| `AI_BUILDER_API_KEY` | Reading supplier invoices and turning voice notes into diagnosis text and draft lines. Without it, photos and notes are saved as-is for manual entry. |
| `SHOP_AI_MODEL` | Optional model override (default `claude-opus-5`). |
| `OPENAI_API_KEY`, `SHOP_TRANSCRIBE_MODEL` | Optional server-side transcription when the browser can't transcribe live (Chrome, Edge and Safari can). |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | Texting estimate and pay links. Without them, "Text" opens the phone's messages app with the link filled in. |
| `SHOP_TECH_JWT_SECRET` | Optional; signs bay-device sessions (falls back to `MEMBER_JWT_SECRET`, then the service key). |
| Stripe Connect / PayPal on the site | "Pay online" on invoices. E-transfer instructions show when an e-transfer email is set. |

## What stays manual

- **PPSR registration and discharge.** Ontario's registry has no public API. Keystone
  collects what the registration asks for, shows the deadline on My desk, and stores the
  registration number, expiry and discharge.
- **QuickBooks.** Exports (QBO CSV imports and a Desktop IIF file), not a live sync, which
  would need an Intuit developer app.
- **Online payments** are recorded when the customer lands back from Stripe or PayPal (same
  as bookings). If they close the window before that, the money is safe in the shop's
  account; record it on the invoice by hand.

## Code map

- `actions/` enforce the rules server-side (written estimate before approval, approval
  records, revised estimates for extra work, the 10% cap, lien validity, plan paperwork).
- `rules.ts`, `money.ts`, `documents.ts`, `board.ts` are client-safe and shared by the UI,
  PDFs (`pdf.ts`) and the customer page (`/shop-doc/<token>` on the shop's own domain).
- UI lives in `app/components/shop`; routes in `app/api/shop`.

## Tests

`npm run test:shop` checks the money math and the rules. The legal wording is a
best-effort reading of the statutes; have a paralegal confirm it before relying on it.
