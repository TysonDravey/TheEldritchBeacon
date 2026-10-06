# Sound design brief — VO ambience

*Content/creative direction only. No playback engineering is included here — `lib/sound.ts` has no looping or ducking primitive today, and no real VO audio exists yet to sync against. This is what a future pass would build toward once Captain Mercer's lines (see `voiceover-script-draft.md`) are actually recorded.*

## Concept

Every VO line in this game is framed as Mercer's own ship's log — he's dictating into a recorder, not narrating to the player directly. The ambience should sell that framing literally: each line sounds like a played-back recording, not a clean studio voiceover sitting on top of the game.

**Reel-to-reel / tape deck, not digital.** A period-appropriate mechanical recording, not a crisp modern voice memo. Specifically:

- A **hiss bed** under the voice — low-level tape noise, present for the whole line, not just the silence around it.
- Subtle **wow and flutter** — the faint pitch wobble of a reel that isn't running perfectly steady. Barely perceptible; this is texture, not a gimmick.
- A soft **mechanical click or thunk** bookending each line — the sound of a recorder being switched on just before Mercer speaks, and off just after. This is the single biggest lever for selling "a recording being played back" rather than "a voice in the room."
- Optional, use sparingly: a very faint low-frequency **motor hum**, present under the hiss, that drops away with the closing click — reinforces that the mechanism itself has stopped, not just the voice.

Keep all of this subtle — the ambience supports Mercer's already-understated delivery, it shouldn't compete with it. If a listener notices the tape texture before they notice what he's saying, it's too loud.

## Proposed catalog additions (for later reference — not implemented)

Matching `lib/sound.ts`'s existing `SoundType`/variant-pool shape (`public/sounds/<type>/{1..N}.mp3`, picked at random per play via `randomVariantPath()`):

| Proposed type | Shape | Notes |
|---|---|---|
| `tape-click-on` | One-shot, 2-3 variants | Plays immediately before a VO line starts |
| `tape-click-off` | One-shot, 2-3 variants | Plays immediately after a VO line ends |
| `tape-hiss-bed` | **Looping** — new primitive, `lib/sound.ts` has none today | Runs for the duration of the VO line only, under it |

The hiss bed is the one genuinely new piece of engineering this implies: `lib/sound.ts`/`components/BackgroundMusic.tsx` only ever play a sound once through today (`AudioBufferSourceNode` with no `.loop`, or `BackgroundMusic`'s "play one full track then pick another"). A real looped bed needs either `source.loop = true` on a short buffer, or scheduled repeats — and started/stopped in sync with the VO line's own start/end, which also implies a second, independent `GainNode` so the bed can fade in/out without touching music or SFX volume.

## Where this would eventually plug in

- `lib/sound.ts` — add the loop primitive and the two one-shot types above.
- `components/BackgroundMusic.tsx` — closest existing precedent for a long-lived Web Audio loop in this codebase; its iOS-volume-control workaround (Web Audio instead of `<audio>`, since iOS WebKit ignores `HTMLMediaElement.volume`) and its visibility-sync lifecycle both apply directly to a VO ambience layer too.
- Whatever eventually plays the VO line itself (not built yet — see `voiceover-script-draft.md`'s production notes for the three intended hookup points) would start the hiss bed, play the click-on, play the line, play the click-off, stop the bed.

No ducking of music/SFX is assumed necessary yet — the VO moments (tutorial beats, chapter entries, rule-change popups) mostly land on their own screens with little competing audio, but this should be revisited once real VO/ambience files exist and can actually be heard together with the rest of the mix.
