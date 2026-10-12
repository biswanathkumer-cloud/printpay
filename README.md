# PrintPay FINAL v8 — Counter Payment + Storage-Free Direct Print

This build fixes the Cloudflare Durable Objects deployment error:
`In order to use Durable Objects with a free plan, you must create a namespace using a new_sqlite_classes migration.`

## Workers Builds settings
- Build command: None
- Deploy command: `node deploy.mjs`
- Root directory: `/`

## What this build uses
- D1: only order/report data
- Durable Object (SQLite-backed): temporary WebSocket relay for customer-to-shop direct print
- Assets: website files
- R2: NOT used
- Razorpay/online payment: NOT used

## Important secrets
Add these under Worker Runtime Variables & Secrets after the Worker is deployed as real Worker code:
- `ADMIN_INITIAL_PASSWORD`
- `SESSION_SECRET`

## D1
`deploy.mjs` automatically finds the existing D1 database named `printpay-db` and generates the real database binding before deploy.

## Direct print
The customer's browser keeps the page open while waiting for payment and printing. After the owner marks the cash order as Paid, the browser creates the PDF locally and sends it through the Durable Object WebSocket relay to the shop desktop agent. The desktop agent holds the PDF only temporarily while printing and deletes it afterwards.

No customer PDF/image is stored permanently in R2 or D1.


IMPORTANT DEPLOYMENT NOTE
=========================
This build intentionally does NOT declare secrets.required, because Workers Builds cannot deploy a Worker when runtime secrets have not yet been created. Cloudflare documents that secrets.required makes wrangler deploy fail if the secrets are missing. After the first successful deployment, add these two runtime secrets on the actual Worker (Settings -> Variables and Secrets -> Add -> Secret):
- ADMIN_INITIAL_PASSWORD
- SESSION_SECRET
Then deploy/redeploy the Worker. Do not put these passwords into the Git repository or source code.


DEPLOYMENT FIX v10
==================
This version removes Wrangler required-secret validation so Workers Builds can complete the first deployment even when runtime secrets have not yet been created. The Worker itself safely skips owner initialization until ADMIN_INITIAL_PASSWORD exists, so the public customer site can load.

After the first successful deploy, open the actual Worker (printpay) -> Settings -> Variables and Secrets -> Add -> Secret and create:
ADMIN_INITIAL_PASSWORD = your chosen owner login password
SESSION_SECRET = a separate long random secret
Then click Deploy. The first request after ADMIN_INITIAL_PASSWORD is set creates the owner account if it does not already exist.

Do not put these values into GitHub or this ZIP.
