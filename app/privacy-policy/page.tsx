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
            The Eldritch Beacon does not collect, store, or transmit any personal data.
          </p>

          <ul className="font-serif text-sm text-ink flex flex-col gap-3" style={{ listStyle: 'none', paddingLeft: 0 }}>
            <li>
              <strong>No account.</strong> The app has no sign-in, no account creation, and does not
              ask for your name, email, or any other personal information.
            </li>
            <li>
              <strong>No data leaves your device.</strong> Your puzzle progress, completion status,
              and settings are stored locally on your device only. None of it is sent to us or to
              any third party. Uninstalling the app deletes this data.
            </li>
            <li>
              <strong>No analytics or tracking.</strong> This build of the app does not include any
              analytics, advertising, or tracking of any kind.
            </li>
            <li>
              <strong>No third-party services.</strong> The app does not integrate with any
              third-party SDK that collects data on this build.
            </li>
          </ul>

          <p className="font-serif text-sm text-ink">
            If a future version of this app adds optional, anonymized analytics (to understand
            which puzzles are too hard, for example), this policy will be updated first, and the
            update will describe exactly what&rsquo;s collected before it ships.
          </p>

          <p className="font-serif text-sm text-ink">
            <strong>Contact:</strong> kirk.brillon@gmail.com
          </p>
        </div>
      </div>
    </main>
  );
}
