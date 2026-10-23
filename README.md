# PrintPay — Manual Counter Print / Optional A4 Photo Editor

## Current workflow
- No automatic printer bridge.
- Customer uploads image/PDF and chooses B&W or Colour per file.
- Every image/PDF has Preview / Crop; PDFs support page navigation.
- A4 Photo Editor is OPTIONAL. Customer can select uploaded images, place/drag them on a 300-DPI A4 canvas, save one or more A4 sheets, and the remaining files stay separate.
- A4 sheets are counted separately in the estimate.
- Customer can choose Counter Payment or direct Owner UPI payment (PhonePe / Google Pay / Paytm); UPI is not a payment gateway.
- Owner clicks Payment Received.
- Before upload, each selected image is exported as a processed JPEG; each PDF page is rendered and rebuilt into a new PDF. B&W files are converted to grayscale pixels (not just tagged as B&W), while Colour files keep their colour.
- Owner sees the processed files grouped into B&W and Colour.
- Owner can Preview, Open & Print, Save, or Delete files.
- Files are held temporarily in the existing Durable Object for up to 24 hours and are not stored in R2. Owner can delete them sooner.
- Customer browser polls payment status and attempts the Bengali voice message after Owner marks Payment Received; Owner Login opening never triggers voice. Bengali voice depends on browser/device voice support or internet TTS and browser audio permission.

## Pricing
Owner settings now include:
- B&W price per page
- Colour price per page
- B&W A4 Photo Sheet price
- Colour A4 Photo Sheet price
- delivery / global discount / quantity fallback fields
- Bengali voice on/off and custom message with `{amount}`

Default new A4 Photo Sheet prices: B&W ₹10, Colour ₹30. These are owner-editable.

## Removed
- Private Card Studio from Owner panel.
- Customer-facing A4 Page Arrangement selector.
- Automatic printer bridge / automatic print.
- Owner login instructional password text.
- Long Manual Print System explanatory note.

## Security
- Owner API endpoints remain protected by the existing owner session.
- `ADMIN_INITIAL_PASSWORD` remains the required Cloudflare Worker secret; no default password is embedded.


V27.2 update: PWA installation and mobile Share Target are intentionally disabled. Customer can still use Browse, Drag & Drop, and Ctrl+V/Paste from supported browser file sources.

## Owner panel
- Separate tabs: Report, Pricing, Payment, QR Code, Voice.
- Settings save through the authenticated Owner API and D1.
- Order IDs use the short `PP-xxxxx-XXX` style.

## Verification notes
- `node --check public/app.js` and `node --check worker.js` pass.
- Inline Owner JavaScript syntax passes `node --check`.
- HTML IDs checked for duplicates; none found.
- ZIP integrity is checked before delivery.
- A live Cloudflare Worker/D1 deployment, real printer, real payment, browser voice output, and end-to-end PDF output could not be verified from this local build environment. Test those in the deployed site before production use.

## Deploy
1. Replace the GitHub repository files with the full contents of this ZIP (keep the root layout: `worker.js`, `wrangler.toml`, `schema.sql`, `public/`).
2. Confirm Cloudflare Worker secret `ADMIN_INITIAL_PASSWORD` is configured. There is no embedded default password.
3. Deploy with the existing Cloudflare/GitHub deployment setup (`npx wrangler deploy`).
4. After deployment, test one two-page PDF in B&W and Colour, preview and save each from Owner, mark Payment Received, test Bengali voice with customer page open, and verify settings survive refresh.
