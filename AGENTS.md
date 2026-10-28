# Architecture rules
- Keep launch validation rules in a shared client-safe module so account confirmation and AI input limits can be tested independently.
- All AI gateway calls consume the same atomic, service-role-only per-user UTC-day quota before sending a request; attempted calls count even if the provider fails.
- Account deletion uses an authenticated server function, derives the target from the verified caller, cleans storage and application data, then deletes the auth user; owned cars and their shared records are deleted, not transferred.
- Offline support uses vite-plugin-pwa generateSW and one guarded registration wrapper; never register in development, preview, iframes, or localhost.
- Keep branded page metadata on leaf routes; root holds only sitewide defaults.
- Profile reads are limited to the caller's own profile and crew on cars they own; sharing must not expose unrelated profiles.
- Support submissions send independent, event-deduplicated team and sender emails after durable storage; team alerts use authenticated role-checked polling so notifications cannot expose messages to other users.
- Personal inbox data uses participant-scoped RLS; crew discovery returns only names and IDs of shared-car members, while support assignment and the support roster require a verified admin role. Direct messages permit recipient-only read receipts, and support replies stay within their original request's access boundary.