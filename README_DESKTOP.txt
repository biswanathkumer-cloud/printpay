PRINTPAY DESKTOP - v21 FINAL WINDOWS PRINTER FIX

INSTALL
1. Extract this ZIP to a normal Windows folder, for example C:\PrintPayDesktop\
2. Double-click install_desktop.bat.
3. This version does NOT require pywin32 and does not run pip during normal setup.
4. If Python 3 is missing, the installer tries to install Python 3.13 for the current Windows user with winget. If winget is unavailable, install Python 3.13 and run the installer again.

PRINTERS - USB / WIFI / LAN
- The software reads the Windows Print Spooler directly using the native Winspool API.
- Windows-installed USB, Wi-Fi and LAN/TCP-IP printer queues should appear in Detect Printers.
- PowerShell Get-Printer is a fallback.
- If a Wi-Fi/LAN printer is physically reachable but NOT installed in Windows, add it first in Windows Settings > Bluetooth & devices > Printers & scanners. The desktop software does not install vendor drivers automatically.
- After adding the printer in Windows, click Detect Printers.
- Select B&W and Colour printer. The same printer can be selected for both.
- Click Test Printer. The test uses Windows PrintUIEntry, not a PDF viewer.
- Keep Automatic Print ON and click Save.

PRINT STATION KEY
Use a separate secret key, e.g. PP-7K9X-42M8. It must exactly match Owner > Settings > Print Station Key. Do not use the Owner password.

VOICE
For a new order the station announces once in Bengali:
“গ্রাহক আপনাকে প্রিন্ট করার জন্য ফাইল পাঠিয়েছে। [amount] টাকা সংগ্রহ করে প্রিন্ট করে দিন।”
There is no second voice after Payment Received.
