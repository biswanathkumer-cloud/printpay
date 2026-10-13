PRINTPAY WEB-ONLY

GitHub-এ শুধু এই 2টি file upload করুন:
1) worker.js
2) wrangler.toml

public folder, desktop software, PrintPayDesktop.py, websocket, Durable Object, R2 — কিছুই লাগবে না।

Cloudflare D1:
- Binding: DB
- Database: printpay-db
- Database ID: f9e35aaa-b29c-425b-84d9-e67d83b40962

Worker Variables & Secrets:
- ADMIN_INITIAL_PASSWORD = আপনার Owner password
- SESSION_SECRET = একটি লম্বা random secret (optional but recommended)

Build command: ফাঁকা / None
Deploy command: npx wrangler deploy

Workflow:
Customer browser -> files browser memory-তে -> order -> Owner browser-এ order -> cash payment -> Owner Payment Received -> customer browser print dialog.

No desktop software. No R2. No online payment. No customer file storage.

Important: Browser নিজে থেকে Windows printer-এ silent print করতে পারে না; payment-এর পরে browser print dialog খুলবে।
