# PrintPay FINAL v14 — D1 INSERT FIX

Fixes the runtime SQLite error `6 values for 5 columns` that blocked Owner Login and Counter Payment.

Root cause: the owner INSERT listed 5 columns but supplied 6 values. It is now `VALUES('owner',?,?,?,?)` with four bound values.

The rest of the v13 functionality is preserved.
