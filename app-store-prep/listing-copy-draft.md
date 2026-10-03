# App Store Connect listing — draft copy

*All drafts below. Character counts verified against Apple's current field limits, but double-check at submission time in case Apple's limits have changed. Everything here is meant to be copy-pasted into App Store Connect's own fields, not published as-is anywhere else.*

## App name
**Eldritch Beacon** (16 chars — well under the 30-char limit; matches the native app's display name already set in `Info.plist`)

## Subtitle (30 char max)
**A Lovecraftian Logic Puzzle** (27 chars)

## Promotional text (170 char max — can be changed anytime without a new build/review)
> Restore the charts. Hold the watch. A slow-burn Lovecraftian puzzler with 370+ hand-crafted boards and a story that watches back.

(129 chars)

## Description (4000 char max)

> The Beacon has gone dark, and Keeper Vale isn't answering.
>
> The Eldritch Beacon is a logic puzzle in the spirit of Star Battle and Queens — place a Watcher in every row, column, and territory, with none ever touching another, not even at the corners. When a cell can't hold a Watcher, mark it with a Ward instead. Pure deduction, no guessing required: every puzzle has exactly one correct chart, and the logic to find it.
>
> **A campaign with a story.** Follow Captain Mercer's own journal as the charts grow stranger — the tower's measurements stop adding up, a window opens onto a view that shouldn't exist, and something that was never drawn starts answering back. Seven chapters, each unlocking a real page of hand-illustrated journal art.
>
> **Hundreds of puzzles.** A full campaign plus two advanced variants — Shattered Realms (scattered, non-contiguous territories) and Twin Watchers (two Watchers per row, column, and territory) — for over 370 puzzles in total, from a gentle introduction to genuinely difficult late-game charts.
>
> **A new puzzle every day.** The Daily Beacon serves up a fresh challenge, with its own difficulty curve across the week.
>
> **Smart hints, not spoilers.** Ask for help and get a nudge first, a fuller explanation if you ask again — and if you've placed something that doesn't match the true chart, the game tells you outright instead of leaving you stuck on a deduction that can't go anywhere.
>
> **No ads. No in-app purchases. No account required.** Your progress stays on your device.
>
> One Watcher. One row. One column. One territory. The Beacon holds — for now.

## Keywords (100 char max, comma-separated, no spaces needed after commas)
`puzzle,logic,lovecraft,horror,star battle,queens,brain teaser,indie,daily puzzle,atmospheric`

(92 chars)

## Category
**Primary:** Games → Puzzle
**Secondary (optional):** Games → Board, or Entertainment

## Age rating
Apple's current system is a self-answered questionnaire (Horror/Fear Themes, Mature/Suggestive Themes, Realistic Violence, etc., each None / Infrequent-Mild / Frequent-Intense) that computes the final rating for you — I can't fill this out for you since it's a developer self-report tied to the actual App Store Connect account, but my honest read of the content:

- **Horror/Fear Themes:** Infrequent/Mild is the defensible answer — cosmic-horror atmosphere, unsettling late-game reveal, no jump scares or graphic content.
- **Mature/Suggestive Themes:** Possibly Infrequent/Mild, given the unsettling tone of the journal's ending (the "I KNOW" reveal) — your call on whether that clears the bar.
- **Blood:** the journal pages show stylized ink/watercolor blood (not realistic/graphic) — likely still "None" or the mildest tier depending on how Apple's current wording reads it when you fill out the form; worth a careful look at the actual pages (`public/journal/page-04.jpg` through `page-07.jpg`) against Apple's own category descriptions before answering.
- Everything else (violence, sexual content, gambling, substances) is a clean **None** — there's nothing in the game that touches these.

My best guess at the resulting rating is **12+**, but this is Apple's algorithm from your own honest answers, not something I can determine for you.

## App Privacy (the separate questionnaire, not the `.xcprivacy` manifest)
As currently built, the shipped iOS app collects **no data at all** (see `privacy-policy-draft.md` for why — PostHog never initializes on mobile builds). Answer every category in App Store Connect's "App Privacy" section as **Data Not Collected**. If you later add mobile analytics, this needs to change before that build ships, not after.

## Privacy Policy URL
Required field — point it at wherever you end up hosting `privacy-policy-draft.md`'s content. It must be a live, public URL; Apple does check that it resolves.
