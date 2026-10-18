import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — The Eldritch Beacon',
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen flex flex-col items-center px-6 py-12">
      <div className="w-full max-w-xl flex flex-col gap-6">
        <Link
          href="/"
          className="font-serif text-sm text-ink-light hover:text-ink transition-colors self-start"
        >
          &larr; Back
        </Link>

        <div className="border border-ink border-opacity-30 rounded-sm p-6 bg-parchment flex flex-col gap-4">
          <h1 className="font-lovecraftian text-2xl text-ink">Privacy Policy</h1>
          <p className="font-serif text-xs text-ink-light" style={{ opacity: 0.65 }}>
            The Eldritch Beacon &middot; Last updated October 18, 2026
          </p>

          <p className="font-serif text-sm text-ink">
            The Eldritch Beacon does not collect any personal data, and does not ask for your
            name, email, or any other identifying information. It does collect anonymous usage
            analytics, described below.
          </p>

          <ul className="font-serif text-sm text-ink flex flex-col gap-3" style={{ listStyle: 'none', paddingLeft: 0 }}>
            <li>
              <strong>No account.</strong> The app has no sign-in and no account creation.
            </li>
            <li>
              <strong>Your progress stays on your device.</strong> Puzzle progress, completion
              status, and settings are stored locally only, never sent to us or anyone else.
              Uninstalling the app deletes this data.
            </li>
            <li>
              <strong>Anonymous usage analytics.</strong> The app sends anonymous event data (for
              example, that a puzzle was completed, a hint was used, or a purchase went through)
              to PostHog, an analytics provider, so we can tell whether the game is being played
              and where. This data is tied to a random identifier generated on your device, not to
              you personally &mdash; it is never combined with your name, email, or any other
              identifying information, because we never collect those in the first place. It is
              not used for advertising and is not shared with any other app or website.
            </li>
            <li>
              <strong>Purchases.</strong> In-app purchases are handled entirely by Apple&rsquo;s
              App Store / StoreKit. We never see your payment details.
            </li>
          </ul>

          <p className="font-serif text-sm text-ink">
            <strong>Contact:</strong> kirk.brillon@gmail.com
          </p>
        </div>
      </div>
    </main>
  );
}
