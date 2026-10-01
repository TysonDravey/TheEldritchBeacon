# Sound effects needed

Drop files straight into this folder (same workflow as `images/` and
`music/`) — any name/format is fine, I'll rename and wire them into
`public/sounds/` once they're here.

## Core set (8) — every one of these already has a call site wired in
the game, currently silent until a file exists. Expected filenames are
in parentheses; using those exact names means no code changes are
needed once they land.

1. **Ward placed** (`ward.mp3`) — short, soft tap. Paper or stone, low-key.
2. **Ward removed** (`ward-remove.mp3`) — same family as #1, slightly
   duller or reversed — should read as "undo."
3. **Watcher placed** (`watcher.mp3`) — more substantial than a Ward. A
   settling thud, or a soft chime with a little magical shimmer.
4. **Watcher removed** (`watcher-remove.mp3`) — reverse/undo version of #3.
5. **Invalid placement / contradiction** (`error.mp3`) — short dissonant
   buzz or low negative sting. Should feel "wrong," not harsh.
6. **Win ripple, per ward settling** (`win-ward.mp3`) — bright, bell-like
   *ting*, short and pitched — many of these can layer together in a
   couple seconds, so it should be gentle more than any one of these
   feeling important.
7. **Win slam — watchers crash down** (`win-slam.mp3`) — the big one. A
   weighty impact plus a magical flourish. Your single most dramatic
   sound.
8. **Puzzle/chapter complete** (`complete.mp3`) — a short fanfare,
   distinct from #7 — this is the "you actually finished" payoff, a
   little longer and more musical than the slam.

Also wired, same family as the above:
- **Hint used** (`hint.mp3`) — a soft "whisper" or page-turn — something
  that reads as being told a secret.

## Secondary set (4) — nice-to-have, not wired to code yet

9. UI navigation click — a subtle click for menu/settings interactions.
10. Region/chapter unlock banner reveal — a short sting for the "___ has
    been revealed" banner on the home screen.
11. A second (or third) background-music track, so a long session
    doesn't loop the same song forever. Drop extra tracks in `music/`,
    not here.

## One important note on #6 (win ripple)

Don't make this a loud/distinct sound meant to be heard on its own —
several of these can fire within a couple seconds as the ripple spreads
across the board, and if each one is a strong individual "ding" it reads
as noise, not a ripple. Softer and shorter is better than loud and long
for this one specifically.
