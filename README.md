# PrintPay — FINAL Web/Mobile Counter Print

## Included
- Mobile + desktop browser only
- Multiple image/PDF upload
- File-by-file B&W / Colour selection
- Image/PDF page counting
- Preview for every uploaded file
- Touch/mouse crop box with draggable margin/corner handles + 3x3 guide lines
- Brightness, contrast, scale, sharpness and extra B&W cleanup
- A4 merge layout: 1 / 2 / 4 / 6 / 9 images per A4
- Copies/quantity repeats the actual generated print pages
- Separate B&W and Colour calculation, PDF generation and print dialogs
- D1 stores order/report data only; uploaded files are not stored
- Counter payment only; no Razorpay/UPI/online payment
- Bengali counter-payment announcement on the customer browser after Owner presses Payment Received
- Owner date-wise report with B&W pages, Colour pages, A4 sheets, copies and amount
- Owner pricing for B&W/Colour A4 layouts
- Owner B&W/Colour printer-name reference fields

## Important browser printer limitation
A normal browser cannot enumerate Windows printers, silently select a particular printer, or prevent the user from changing the printer/paper/quality in the system Print Dialog. The configured B&W/Colour printer names are therefore reference settings only.

The current web-only build deliberately has no desktop/native print bridge. For a hard rule such as “B&W always goes to Printer A, Colour always goes to Printer B and the customer cannot select another printer”, a local Windows/native print bridge is technically required.

## Cloudflare
- Build command: none
- Deploy command: `npx wrangler deploy`
- D1 binding: `DB`
- Assets binding: `ASSETS`
- Secret: `ADMIN_INITIAL_PASSWORD`
- Optional secret: `SESSION_SECRET`


## V23 — Locked printer printing
- Customer browser no longer opens the printer dialog after payment.
- Customer creates separate temporary B&W and Colour PDFs and uploads them only after payment is marked PAID.
- Shop Windows PC runs `install_bridge.bat` once and then `start_bridge.bat`.
- Owner Login gets the actual Windows printer list through the local bridge and saves one B&W printer and one Colour printer.
- The bridge sends B&W jobs only to the configured B&W printer and Colour jobs only to the configured Colour printer.
- Temporary PDF files are deleted after successful printing; no R2 is used.
- The bridge uses SumatraPDF 3.6.1 x64 for silent PDF printing.
- Browser-only printing cannot do this; a local print bridge is required because normal web pages cannot directly enumerate/select local printers.


V24 changes: compact A4 arrangement inside the file area; 5/10/12 images per A4 pricing; PDF page-by-page preview navigation with crop controls; PDF crop applies to all pages of that PDF; stronger per-file Preview buttons/thumbnails; smaller Owner Login card; Bengali voice slowed to 0.52 and waits for installed Bengali voice; Owner printer list refreshes automatically after login.

Printer mapping: run install_bridge.bat on the shop Windows PC, enter the Worker URL and the same Bridge Key generated in Owner Settings, then run start_bridge.bat. In Owner > Automatic Printer Control, click Printer List Refresh, select the exact Windows B&W and Colour printer names, click Save Bridge Mapping, then Test B&W/Test Colour. Customer never sees a printer selector.
