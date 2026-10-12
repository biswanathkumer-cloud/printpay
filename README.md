# PrintPay FINAL — Counter Payment + Direct Print (NO R2)

This version intentionally has **no R2 bucket and no permanent customer-file storage**.

## Flow
1. Customer scans QR/link and opens the mobile portal.
2. Customer selects image/PDF files. Files stay in the customer's browser memory.
3. Customer enters name/mobile and selects B&W/Colour, paper and copies.
4. Order amount is calculated from D1 settings.
5. Customer creates a **Counter Cash** order.
6. Owner logs into `/owner.html` with the owner password and clicks **Payment Received**.
7. Customer browser generates the print-ready PDF locally.
8. Customer browser sends the PDF through a temporary WebSocket relay (Durable Object) directly to the shop Print Agent. The relay does not save the file to R2/D1.
9. Windows Print Agent keeps the PDF only in a temporary local file while printing, then deletes it.
10. D1 keeps only the order/report data: date/time, name, mobile, pages, copies, mode, amount, payment and status.

## Cloudflare setup
- `wrangler.toml` needs the real D1 `database_id`.
- No R2 binding is required.
- Required runtime secrets: `ADMIN_INITIAL_PASSWORD`, `SESSION_SECRET`.
- Deploy command: `npx wrangler deploy`
- Build command: None
- Root directory: `/`

## Desktop Print Agent
On the shop Windows PC:
```bash
pip install -r requirements-desktop.txt
set PRINTPAY_URL=https://YOUR-WORKER-URL
set PRINTPAY_DESKTOP_KEY=YOUR_KEY_FROM_OWNER_SETTINGS
python desktop_agent.py
```

The agent uses the Windows registered PDF `print` verb. For fully silent printing, the shop PC should have a PDF reader installed that supports the Print shell verb. The temporary PDF is deleted after the print command is sent.

## Important
Because there is no cloud file storage, the customer's browser page must remain open until printing finishes. If the customer closes/reloads the page before the direct print is sent, the local files are gone and the order report remains but the files cannot be recovered.

## Customer print-page protection
After Counter Payment is marked received, the customer page automatically enters a print-monitor state. It keeps the page active, requests a screen Wake Lock where supported, polls order status, reconnects the print channel when the tab becomes visible again, and warns before accidental tab/window closing until the shop print agent reports PRINTED. The browser cannot be forced by a website to remain open or suppress the browser's own close controls; this protection is the maximum reliable browser-side behavior.
