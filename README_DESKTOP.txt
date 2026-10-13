PRINTPAY DESKTOP - v19

1) Owner panel -> Settings -> Print Station Key
   Set your own secret key, for example: PP-7K9X-42M8
   Do NOT use the Owner password. Keep this key private.

2) Start PrintPayDesktop.py on the shop Windows PC.
   Enter:
   - PrintPay HTTPS URL
   - Owner username: owner
   - Owner password
   - EXACT SAME Print Station Key

3) After login, open Printer Settings.
   - Click Detect Printers.
   - B&W Printer: select the Windows printer used for black & white.
   - Colour Printer: select the Windows printer used for colour.
   - If a printer is not listed, type its exact Windows printer name in the box.
   - Click Test Printer to test the selected printer.
   - Keep Automatic Print ON.
   - Click Save.

4) Customer sends an order.
   Desktop announces in Bengali:
   "গ্রাহক আপনাকে প্রিন্ট করার জন্য ফাইল পাঠিয়েছে। [amount] টাকা সংগ্রহ করে প্রিন্ট করে দিন।"
   There is NO second voice after Payment Received.

5) Owner/Desktop marks Payment Received.
   The customer file is sent automatically and the selected Windows printer starts printing.
   The temporary PDF is deleted after printing.

If the Bengali voice is not clear on Windows, install/enable a Bengali (Bangla) Windows speech voice. The software automatically prefers an installed Bengali/Bangla SAPI voice.
