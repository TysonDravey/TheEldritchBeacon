# Captain Mercer — chapter voice-over draft

*Draft lines for a short VO stinger per campaign chapter (plays on entering a region, distinct from the written completion lore already in `CHAPTER_COMPLETIONS`). Written to work either as director's notes for a human voice actor, or as a voice-description + line pair for an AI voice-generation tool. Not wired into the app yet — this is content prep only; actual audio integration is a separate step once real files exist.*

## Voice profile (use once, applies to every line)

Captain Mercer: a ship's officer, precise and procedural by training, early-to-mid 40s, no particular regional accent — clipped, controlled diction, the cadence of someone used to dictating a log rather than telling a story. He never raises his voice and never says a word like "impossible" — he states what he measured and lets the listener do the unease themselves. Across the seven chapters his composure costs him visibly more effort: the pauses land in different places, the sentences get shorter, but he does not break into panic, ever — not even in Chapter VII.

If using an AI voice tool, a style prompt along these lines works: *"A controlled, precise male voice in his 40s, reading a ship's log aloud — measured and procedural, growing almost imperceptibly more strained across the delivery, never raising in volume or pitch even when the content is unsettling."*

---

### Chapter I — Landfall
**Plays on:** first entering the campaign.
**Direction:** flat, procedural, routine — this is just another log entry to him, so far.

> "Ship's log. Fourteen September. Keeper Vale has missed two signals. We make landfall before dark — and find out why."

### Chapter II — The Survey
**Direction:** still procedural, a faint note of dismissal — he wants this to be nothing.

> "The tower stands sound. Old marks cut above the door — mason's work, I tell myself, and copy them down regardless."

### Chapter III — The Lower Level
**Direction:** the first real crack — not alarm, but a held-too-long pause before "does not."

> "Twenty-one feet, eight inches. I have measured it three times. The tower does not agree with its own walls."

### Chapter IV — The Lantern Room
**Direction:** clinical, almost too calm — he's narrating around the moment he got hurt.

> "Thirty-six seconds by the gears. Forty-one by the light. I cut my hand confirming it. The blood found the lens before I did."

### Chapter V — The West Wall
**Direction:** slower now. Let "somewhere else" sit for a beat before the line ends.

> "Two windows, by the old charts. I count three from the inside. The third one looks out on somewhere else."

### Chapter VI — The Keeper's Quarters
**Direction:** quietest delivery yet — this is the moment he stops being able to explain it away.

> "I have laid every drawing over the others by lamplight. They should not align. They do. It is the same shape."

### Chapter VII — The Reply
**Direction:** a full tonal reset — very quiet, almost gentle, more unsettling for its calm. Longer pause before the final four words than anywhere else in the script.

> "There is a page in my own hand I do not remember making. I wrote that I did not draw it. ... Something already knew."

---

### Production notes
- Each line is short by design (roughly 8–12 seconds spoken) — a stinger, not a narration track.
- If recording with a human actor, these seven lines can be done in a single short session; the voice profile note above is the only direction that needs to carry across all of them.
- If using AI voice generation, keep the SAME voice/seed across all seven for continuity, and consider very slightly lowering the generation "stability"/expressiveness setting (where the tool offers one) for Chapters VI–VII to let the strain come through.
- Once real audio files exist, they'd most naturally hook into `app/campaign/page.tsx` (the per-chapter intro screen already shows the matching journal page and chapter name) — playback wiring is a separate follow-up, not done yet.
