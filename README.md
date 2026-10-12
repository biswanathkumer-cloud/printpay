# PrintPay FINAL — Counter Payment + Direct Print (NO R2)

This package fixes the Cloudflare error `binding DB of type d1 must have a valid database_id specified` without requiring you to manually copy a D1 UUID into the code.

## Cloudflare Workers Builds
Use:
- Build command: None
- Deploy command: `node deploy.mjs`
- Root directory: `/`

`deploy.mjs` asks Wrangler for the existing D1 database named `printpay-db`, reads its real ID, generates a temporary Wrangler config, and deploys it. Cloudflare's Wrangler supports D1 resource discovery and D1 bindings require the database ID for a configured binding.

The Workers Build API token must have enough D1 permission to list the database. If `npx wrangler d1 list --json` is denied, add D1 Read permission to the Build API token.

## Runtime secrets
In Worker Settings > Variables and Secrets add:
- `ADMIN_INITIAL_PASSWORD`
- `SESSION_SECRET`

## D1 schema
After the Worker deploys for the first time, run the included `schema.sql` against the remote `printpay-db` database if the tables do not already exist:
`npx wrangler d1 execute printpay-db --remote --file=./schema.sql`

## No R2
There is no R2 binding and no customer-file cloud storage. Customer files stay in the browser until the print transfer finishes.

## Counter-only flow
Customer uploads files -> browser calculates print amount -> customer creates cash order -> owner logs in and clicks Payment Received -> browser sends the temporary print PDF through the Durable Object relay to the shop desktop agent -> agent prints -> temporary local file is deleted -> D1 keeps only report/order information.
