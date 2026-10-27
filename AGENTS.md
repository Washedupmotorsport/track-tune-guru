# Architecture rules
- Keep launch validation rules in a shared client-safe module so account confirmation and AI input limits can be tested independently.
- All AI gateway calls consume the same atomic, service-role-only per-user UTC-day quota before sending a request; attempted calls count even if the provider fails.
- Account deletion uses an authenticated server function, derives the target from the verified caller, cleans storage and application data, then deletes the auth user; owned cars and their shared records are deleted, not transferred.
- Offline support uses vite-plugin-pwa generateSW and one guarded registration wrapper; never register in development, preview, iframes, or localhost.
- Keep branded page metadata on leaf routes; root holds only sitewide defaults.