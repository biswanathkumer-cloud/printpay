PRINTPAY DESKTOP - v20 PRINTER FIX

INSTALL
1. Extract this ZIP to a normal Windows folder, e.g. C:\PrintPayDesktop\
2. Double-click install_desktop.bat.
3. It installs requests, websocket-client and pywin32, then starts PrintPay Desktop.
4. If Windows SmartScreen appears, choose More info -> Run anyway only if you trust the package.

PRINTER
- After login click Detect Printers.
- Printer names come from the Windows print system using the native Windows printer API.
- Select B&W and Colour printers. You can also type an exact Windows printer name.
- Click Test Printer.
- Keep Automatic Print ON and Save.

PRINT STATION KEY
Use a separate secret key, e.g. PP-7K9X-42M8. It must exactly match Owner -> Settings -> Print Station Key.
Do not use the Owner password.

VOICE
On a new order the station announces once in Bengali: “গ্রাহক আপনাকে প্রিন্ট করার জন্য ফাইল পাঠিয়েছে। [amount] টাকা সংগ্রহ করে প্রিন্ট করে দিন।”
There is no second voice after Payment Received.

If Detect Printers is still empty, first confirm the printer appears in Windows Settings -> Bluetooth & devices -> Printers & scanners and print a normal Windows test page.
