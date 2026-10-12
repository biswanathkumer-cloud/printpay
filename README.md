# PrintPay FINAL v13

Counter Payment Only. Customer files stay in the browser; D1 stores order/report data only.

## Fixed in v13
- Automatic D1 schema bootstrap on first request (fixes `no such table: settings`).
- Owner login accepts the current `ADMIN_INITIAL_PASSWORD` and resynchronizes the owner hash if the secret was changed.
- Counter button text is only `Counter Payment`.
- Removed the online-payment/Razorpay/UPI/R2 explanatory line from the customer screen.
- Added a permanent PrintPay SVG logo and favicon; replaced the shield/emoji branding.
- Added owner-configurable delivery amount.

## Cloudflare Workers Builds
- Build command: None
- Deploy command: `npx wrangler deploy`
- Root directory: `/`
- Worker name: `printpay`

## Required runtime secrets
Add in Worker Settings → Variables and Secrets (Production):
- `ADMIN_INITIAL_PASSWORD` — your owner password
- `SESSION_SECRET` — a separate long random secret

Do not put either secret in GitHub.
