# PrintPay Production — Colorful Cloudflare Build

## Included
- Mobile + desktop customer portal
- Multiple image/PDF selection
- Image/PDF preview and page counting
- B&W / color print mode
- Brightness / contrast / sharpness-style cleanup controls
- Image to PDF and multiple files to one PDF
- Razorpay online payment flow with server verification
- Cash Counter pending-order flow
- Owner login
- D1 order storage
- Owner order dashboard
- Owner pricing / delivery / QR settings
- Printable customer QR
- Browser Print / Save PDF
- PWA manifest

## IMPORTANT
This build keeps payment secrets server-side. Do NOT put Razorpay secret values in HTML/JS.

## Cloudflare setup
1. Create a D1 database named `printpay-db`.
2. Create an R2 bucket named `printpay-files`.
3. Put their IDs/names into `wrangler.toml`.
4. Run:
   npx wrangler d1 execute printpay-db --remote --file=./schema.sql
5. Set Worker secrets:
   ADMIN_INITIAL_PASSWORD
   SESSION_SECRET
   RAZORPAY_KEY_ID
   RAZORPAY_KEY_SECRET
   RAZORPAY_WEBHOOK_SECRET
6. Deploy:
   npx wrangler deploy

## Razorpay webhook
After deployment, set Razorpay webhook URL to:
https://YOUR-WORKER-DOMAIN/api/razorpay/webhook

Use the same webhook secret in Cloudflare:
RAZORPAY_WEBHOOK_SECRET

## Owner
Open:
https://YOUR-WORKER-DOMAIN/owner.html

The initial owner username is:
owner

The password is the value of ADMIN_INITIAL_PASSWORD.

## QR
Owner can paste a public image URL in Owner Settings. The customer portal displays it and provides a Print QR button.

## Notes
- Browser printing uses the customer's available printer / OS print dialog.
- Fully silent automatic Wi-Fi printing from a normal browser is not guaranteed; that requires a local print bridge or native printer integration.
- Razorpay settlement timing is controlled by Razorpay/bank rules; the website verifies payment but cannot itself force bank settlement.
