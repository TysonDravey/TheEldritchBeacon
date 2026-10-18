import Link from 'next/link';

export const metadata = {
  title: 'Support — The Eldritch Beacon',
};

export default function SupportPage() {
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
          <h1 className="font-lovecraftian text-2xl text-ink">Support</h1>

          <p className="font-serif text-sm text-ink">
            Questions, bugs, or feedback about The Eldritch Beacon — reach out any time at{' '}
            <a href="mailto:kirk.brillon@gmail.com" className="underline hover:opacity-70">
              kirk.brillon@gmail.com
            </a>
            . Include your device model and iOS version if you&rsquo;re reporting a bug; it helps a lot.
          </p>

          <ul className="font-serif text-sm text-ink flex flex-col gap-4" style={{ listStyle: 'none', paddingLeft: 0 }}>
            <li>
              <strong>My progress disappeared.</strong> Campaign and Daily Beacon progress is
              stored only on your device, not in the cloud — reinstalling the app, or restoring
              your phone from a backup made before you played, will reset it. There&rsquo;s no
              account system, so there&rsquo;s nothing we can look up or restore on our end.
            </li>
            <li>
              <strong>I bought something but don&rsquo;t see it.</strong> Open Settings in the app
              and tap <strong>Restore Purchases</strong>. This re-checks your Apple ID&rsquo;s
              purchase history and unlocks anything you&rsquo;ve already paid for, including after
              a reinstall or a new device.
            </li>
            <li>
              <strong>What are Lanterns?</strong> The in-game currency, earned by completing
              puzzles. Spend them on Auto-Ward (automatically marks forced Wards for you) or to
              rescue a lapsed Daily Beacon streak. Both also have an optional one-time real-money
              purchase if you&rsquo;d rather skip the wait — never required.
            </li>
            <li>
              <strong>A puzzle seems unsolvable, or the hint is wrong.</strong> Every puzzle has
              exactly one correct chart, verified at generation time. If something genuinely looks
              broken, email the puzzle&rsquo;s name (shown at the top of the board) along with what
              you tried — that&rsquo;s the fastest way for it to get fixed.
            </li>
          </ul>

          <p className="font-serif text-sm text-ink">
            See also the <Link href="/privacy-policy" className="underline hover:opacity-70">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </main>
  );
}
