# PrintPay v21 Final — Web + Mobile Only

Desktop Software, Python, BAT, Durable Objects and WebSocket Print Station have been permanently removed from this package.

## GitHub / Cloudflare files
Upload the complete package so the `public` folder is preserved. Do not upload only `worker.js`.

## Customer
- Mobile/PC browser
- Image/PDF upload
- Immediate preview
- Preview cleanup: Crop, Brightness, Contrast, Scale, Sharpness, B&W cleanup
- B&W / Colour, copies, pricing and discounts
- Send Order to Counter
- File remains in the customer browser; D1 stores only order/report data
- After Owner marks cash payment received, the browser prepares/opens the Print Dialog

## Owner
- Browser password login
- Date-wise report
- Payment Received action
- New unpaid order announcement in clear, slow Bengali voice:
  `গ্রাহক আপনাকে প্রিন্ট করার জন্য ফাইল পাঠিয়েছে। {amount} টাকা সংগ্রহ করে প্রিন্ট করে দিন।`
- Payment Received does NOT trigger another voice announcement
- Bengali voice can be ON/OFF and the message can be edited
- Printer name fields are reference fields
- Test / Open Browser Printer opens the browser print dialog

## Printer limitation
A normal website cannot read Windows installed printers or silently select a printer. This is blocked by browser security. On the PC running the print dialog, install the USB/Wi-Fi/LAN printer in Windows first; the browser print dialog then shows the available system printers.

## Cloudflare
- Worker: `printpay`
- D1: `printpay-db`
- Secrets: `ADMIN_INITIAL_PASSWORD` and optionally `SESSION_SECRET`
- No R2
- No online payment
