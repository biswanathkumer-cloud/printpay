# PrintPay — Manual Counter Print / Optional A4 Photo Editor

## Current workflow
- No automatic printer bridge.
- Customer uploads image/PDF and chooses B&W or Colour per file.
- Every image/PDF has Preview / Crop; PDFs support page navigation.
- A4 Photo Editor is OPTIONAL. Customer can select uploaded images, place/drag them on a 300-DPI A4 canvas, save one or more A4 sheets, and the remaining files stay separate.
- A4 sheets are counted separately in the estimate.
- Customer pays only at the shop counter.
- Owner clicks Payment Received.
- Owner sees temporary files grouped into B&W and Colour.
- Owner can Preview, Open & Print, Save, or Delete files.
- Files are held temporarily in the existing Durable Object and are not stored in R2.
- Customer browser receives payment status and speaks the Bengali voice message; Owner Login opening never triggers voice.

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
