# Privacy Policy — The Eldritch Beacon

*Draft. Reflects the app's actual current behavior as of this build — verify against whatever version you submit before publishing this anywhere. You need to host this at a real, public URL (a simple page on your own site, a GitHub Pages page, even a plain hosted text file) — App Store Connect requires a URL, not pasted text.*

**Last updated:** [fill in date before publishing]

The Eldritch Beacon does not collect, store, or transmit any personal data.

- **No account.** The app has no sign-in, no account creation, and does not ask for your name, email, or any other personal information.
- **No data leaves your device.** Your puzzle progress, completion status, and settings are stored locally on your device only (iOS's standard app storage). None of it is sent to us or to any third party. Uninstalling the app deletes this data.
- **No analytics or tracking.** This build of the app does not include any analytics, advertising, or tracking of any kind.
- **No third-party services.** The app does not integrate with any third-party SDK that collects data on this build.

If a future version of this app adds optional, anonymized analytics (to understand which puzzles are too hard, for example), this policy will be updated first, and the update will describe exactly what's collected before it ships.

**Contact:** [your contact email — required by Apple, can be your personal or a dedicated support address]

---

### Note for Kirk, not part of the published policy

This is accurate because `instrumentation-client.ts` only calls `posthog.init()` when `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` is set, and that env var is only ever injected by Vercel for the web build — `npm run build:ios` is a local build that never sets it, so PostHog genuinely never initializes in the shipped iOS app as things stand. If you ever add a token specifically for mobile (to get real usage analytics from the App Store build), this policy needs a PostHog-specific section describing what's collected (PostHog's own docs have boilerplate language for this), and the App Store Connect "App Privacy" questionnaire answers in `app-store-listing-draft.md` need to change from "Data Not Collected" to actually declaring it.
