# Project architecture

- New-account setup is atomic in the database trigger: profile, library, admin role, settings, and demo records succeed or roll back together, preventing partial accounts.
- Paid-plan intent is stored in authentication metadata and resumed on the protected plan page after email confirmation, so billing always attaches to the correct library.