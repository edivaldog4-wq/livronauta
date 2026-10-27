# Project architecture
- Contact submissions require a signed, expiring ALTCHA proof verified server-side; direct browser inserts are denied and a unique stored challenge digest prevents replay atomically.

- Platform-wide administration uses the protected platform_admins registry and authenticated server functions; library roles never authorize cross-library actions.
- Advertising configuration accepts only validated IDs; fixed official scripts load only after marketing consent, without library data.

- New-account setup is atomic in the database trigger: profile, library, admin role, settings, and demo records succeed or roll back together, preventing partial accounts.
- Paid-plan intent is stored in authentication metadata and resumed on the protected plan page after email confirmation, so billing always attaches to the correct library.
- Authentication emails use the managed Livronauta template set and the delegated notify.livronauta.app sender domain, keeping delivery and branding centralized.
- Account deletion uses a 30-day reversible request followed by server-only privileged cleanup, so browser code never receives deletion privileges.
- The retired free plan remains limited to 50 books only for grandfathered libraries; all newly created libraries require Pro activation.
- New accounts always start with Pro pending and must resume billing after authentication; cancellation returns to free only for grandfathered libraries.
- The database resolves each library's default loan duration from `settings`, so every loan entry path uses one authoritative rule.