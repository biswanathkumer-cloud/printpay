# PrintPay V27 — Manual Print + Private Owner Card Studio

## Added
- Private **Card Studio** inside Owner Login only.
- Image or PDF input; PDF page selection.
- Card presets: PVC ID, Aadhaar Colour, PAN, Voter, Ration, Driving Licence, Ayushman Bharat, Custom.
- Custom width/height in mm and 300/350/400/600 DPI output.
- Automatic edge-based crop with centered aspect-ratio fallback.
- High-resolution PNG/JPG save.
- Exact-size browser print using selected mm dimensions.
- Card Studio processing is browser-local; source files are not uploaded to D1/R2.

## Existing workflow preserved
- No automatic printer bridge.
- Counter payment only.
- Owner manually previews/prints customer files.
- Temporary customer files remain in the existing Durable Object workflow and can be deleted by owner.
- Owner password still comes from Cloudflare `ADMIN_INITIAL_PASSWORD`; no default password.

## Verification
- worker.js syntax check: passed
- public/app.js syntax check: passed
- owner.html inline JavaScript syntax check: passed
- ZIP integrity check: passed

Note: live Cloudflare deployment, real PDF rendering, and physical printer output were not tested in this environment.
