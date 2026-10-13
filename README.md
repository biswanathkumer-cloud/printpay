# PrintPay FINAL v15 — Counter Payment / Multi-file / Print Cleanup

This release fixes the Cloudflare Worker owner-login Response error and keeps Counter Payment workflow intact.

## Fixed
- Owner login `Response` status bug fixed (`Set-Cookie` is now passed as response headers, not as the status argument).
- Counter Payment order creation remains D1-backed and cash-only.
- Multiple file selection can be added repeatedly; no application-level file-count cap.
- Image and PDF input supported.
- Global crop, scale, brightness, contrast, B&W cleanup, and sharpening controls applied when building the print PDF.
- Files remain in the customer browser; file contents are not stored in D1/R2.
- Existing owner report, payment approval, Direct Print relay, and Print Station flow preserved.

## Deploy
Build command: None
Deploy command: `npx wrangler deploy`
Root directory: `/`

Keep the Production secrets `ADMIN_INITIAL_PASSWORD` and `SESSION_SECRET` configured in Cloudflare Worker Variables & Secrets.
