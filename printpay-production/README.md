# PrintPay Final - Counter Payment + QR Upload + Desktop Auto Print

## Flow
1. Customer scans `/poster.html` QR and opens the customer upload page.
2. Customer selects image/PDF files. PDF page count is detected automatically.
3. Customer chooses B&W/Colour and copies. Price = pages × copies × applicable quantity tier, then global discount and delivery are applied.
4. Customer clicks **Counter Payment**. Order and source files are saved in D1/R2.
5. Owner opens `/owner.html`, logs in, and clicks **Payment Received** for that order.
6. Customer page detects PAID automatically, creates the final print PDF and uploads it.
7. The Windows Desktop Agent polls for READY jobs and sends the final PDF to the default printer. Copies are printed automatically.

## Quantity pricing
Owner can set the per-page rate for `1+`, `5+`, `10+`, and `25+` copies. The highest matching non-zero tier is used. If a tier is 0, the normal B&W/Colour base price is used.

## Desktop printing
- Keep `/desktop.html` available for monitoring.
- Run `desktop_agent.py` on the shop Windows PC with Python 3.10+.
- Set `PRINTPAY_URL` to the deployed site URL.
- Set `PRINTPAY_DESKTOP_KEY` to the same Desktop Print Key saved in Owner settings.
- The PC must have a default PDF printer/application associated with the Windows `print` action.

## Cloudflare
Set D1 and R2 IDs in `wrangler.toml`, run the schema on D1, and configure the `ADMIN_INITIAL_PASSWORD` secret. `SESSION_SECRET` is recommended.
