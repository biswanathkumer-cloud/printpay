# PrintPay V25 — Manual Owner Printing

- Automatic Print Bridge removed completely.
- Customer uploads are stored only temporarily in Durable Object storage until owner deletes them or 24 hours expires. No R2.
- Customer selects B&W/Colour per file.
- Owner logs in, marks Payment Received, previews each file with a clear B&W/Colour badge, opens it and prints manually.
- Owner can delete individual files or all files after printing.
- Owner login works with ADMIN_INITIAL_PASSWORD if configured; otherwise default initial password is `1234`. Set `ADMIN_INITIAL_PASSWORD` to your preferred password before production use.
- Settings are saved in D1.
- Logout is red and placed at the top-right.
- QR poster is redesigned for customer understanding.
