# PrintPay FINAL v12

Counter Payment Only. No Razorpay, no online payment, no R2 file storage.

## Cloudflare Workers Builds
- Build command: None
- Deploy command: `npx wrangler deploy`
- Root directory: `/`
- Worker name: `printpay` (must match the Cloudflare Worker)

D1 is bound to the existing `printpay-db` database. Durable Objects use the SQLite migration required for the Free plan.

After the Worker deploys, add these runtime secrets in Worker Settings -> Variables and Secrets:
- `ADMIN_INITIAL_PASSWORD`
- `SESSION_SECRET`

Do not put those values in GitHub or Build variables.
