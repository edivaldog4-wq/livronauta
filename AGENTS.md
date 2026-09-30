# Project architecture

- New-account setup is atomic in the database trigger: profile, library, admin role, settings, and demo records succeed or roll back together, preventing partial accounts.
- Paid-plan intent is stored in authentication metadata and resumed on the protected plan page after email confirmation, so billing always attaches to the correct library.
- Authentication emails use the managed Livronauta template set and the delegated notify.livronauta.app sender domain, keeping delivery and branding centralized.
- Account deletion uses a 30-day reversible request followed by server-only privileged cleanup, so browser code never receives deletion privileges.
- The free plan permits at most 50 book records per library; enforcement lives in the database so manual entry and imports share the same limit.