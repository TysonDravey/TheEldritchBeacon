/**
 * journalTitlesExtended.ts
 *
 * Same approach as journalTitles.ts, extended to the two mode-shift regions:
 * The Keeper's Quarters (shattered-realms) and The Reply (twin-watchers).
 * Grounded in their own CHAPTER_COMPLETIONS lore (app/puzzle/[id]/
 * PuzzleClient.tsx) rather than the sequential-region imagery:
 *
 * Keeper's Quarters ("They Should Not Match"): Mercer lays four drawings
 * over one another by lamplight — the shoreline, the lower floor, the
 * lantern rings, the window — and finds the same shape persisting through
 * all of them despite the centres disagreeing. Maps directly onto the
 * shattered-realms mechanic itself: a territory split into pieces that
 * never touch, still answering to one claim.
 *
 * The Reply ("I Know"): a page in Mercer's own hand that he doesn't
 * remember filling, correct in every particular, with a note beneath it
 * that he did not draw it — the reply was already waiting, in a hand that
 * wasn't his. Maps onto twin-watchers: two of everything, a second mark
 * that answers the first before it's placed.
 */

export const KEEPERS_QUARTERS_TITLES: string[] = [
  "The Drawings, Laid One Over Another", "By Lamplight, Compared", "The Shoreline Page",
  "The Lower Floor, Traced Again", "The Lantern Rings, Overlaid", "The Window, Set Against the Rest",
  "The Centres Do Not Agree", "And Should Not Agree", "Yet the Same Shape Persists",
  "Through Every One of Them", "A Shape Split Across Four Pages", "Pieces That Do Not Touch",
  "Still Answering to One Claim", "The Fragment on the Shoreline Page", "Its Match on the Lower Floor",
  "Vale Wrote the Same Thing", "\"It Is Missing Again\"", "I Begin to Understand What He Meant",
  "Tracing Paper Over Four Drawings", "The Piece That Completes Elsewhere",
  "A Claim Scattered, Not Broken", "The Lantern Ring's Missing Arc", "Found on the Window Page",
  "Four Pages, One Territory", "The Convergence by Lamplight", "What the Overlay Reveals",
  "A Shape I Traced in Pieces", "The Shoreline and the Window Agree", "Where They Should Not",
  "The Lower Floor's Scattered Half", "Held Together by Nothing I Can See",
  "The Same Boundary, Torn in Two", "A Mark That Continues Off the Page", "And Resumes on Another",
  "The Fourth Drawing Confirms It", "Nothing Touches, Yet Nothing Is Separate",
  "The Claim That Spans Four Floors", "Vale's Missing Piece, Found at Last", "Or Merely Relocated",
  "The Overlay Holds Under Lamplight", "A Second Fragment, Unmarked",
  "The Shape Refuses to Stay Whole", "Scattered by Design, Not by Damage",
  "The Lantern Rings' Broken Circle, Rejoined on Paper", "Four Pages That Shouldn't Speak to Each Other",
  "The Window Page's Quiet Confirmation", "A Territory in Three Pieces", "None of Them Adjacent",
  "The Shoreline Fragment, Traced Twice", "What Doesn't Touch Still Belongs",
  "The Centres Disagree, the Edges Don't", "Comparing the Fourth Drawing by Candlelight",
  "A Claim With No Single Home", "The Lower Floor's Third Fragment", "Found Only Under Lamplight",
  "The Same Shape, Four Times Removed", "Pieces I Didn't Know Were Paired",
  "The Convergence Vale Never Finished", "A Boundary That Crosses the Binding",
  "The Overlaid Pages Won't Lie Flat", "Four Floors, One Unbroken Claim",
  "The Fragment Hiding in the Margin", "What the Lamplight Finally Showed",
  "A Shape Too Large for One Page", "The Window and the Shoreline, Reconciled",
  "Nothing Should Match This Well", "The Lantern Ring's Other Half",
  "Traced Onto the Wrong Page, On Purpose", "A Territory That Refuses to Stay Put",
  "The Fourth Comparison, Still Unsettling", "Pieces of the Same Silence",
  "The Overlay's Last Unmatched Corner", "Four Drawings, One Impossible Agreement",
  "The Shoreline Page's Hidden Continuation", "What Should Be Four Claims Is One",
  "The Lower Floor Answers the Window", "A Fragment With No Visible Neighbor", "Still Counted Whole",
  "The Candle Gutters Over the Fourth Page", "Comparing What Should Never Compare",
  "The Claim That Crosses Every Drawing", "A Piece Held by Nothing but Agreement",
  "The Overlay, Confirmed a Second Time", "Four Pages, Traced Until They Match",
  "The Shape That Was Never Whole", "Yet Was Never Less Than One",
  "The Last Fragment, Found by Accident", "Vale's Pages, Finally Making Sense",
  "The Convergence Complete", "Four Floors Bound by an Unbroken Claim",
];

export const REPLY_TITLES: string[] = [
  "A Page in My Own Hand", "That I Do Not Remember Filling", "The Drawing Is Patient",
  "And Calm", "And Correct in Every Particular", "More Correct Than My Own Work",
  "I Wrote Beneath It", "\"I Did Not Draw This\"", "The Reply Was Already Waiting",
  "In a Hand That Was Not Mine", "A Second Hand on the Same Page", "Answering Before I Asked",
  "The Correspondence I Didn't Send", "Two Marks Where I Made One", "A Watcher I Didn't Place",
  "Already There, Already Correct", "The Page Filled Itself", "Or Something Filled It for Me",
  "A Reply to a Question I Hadn't Written", "The Second Observer", "Whose Hand I Do Not Know",
  "Twin Lines, One Origin", "The Drawing Knew Before I Did", "A Correction I Didn't Make",
  "Already Corrected", "The Hand That Isn't Mine, Again", "Two Watchers Where the Chart Shows One",
  "A Pair I Didn't Set", "The Reply Precedes the Letter", "Something Already Knew the Answer",
  "My Ink, Another's Hand", "The Page Was Waiting for Me", "Not the Other Way Around",
  "A Second Mark, Exactly Placed", "Too Correct to Be Mine", "The Correspondence Continues Without Me",
  "Two of Everything, Now", "Where One Watcher Stood", "The Old Rule, Applied Twice",
  "Find Both, or Find Neither", "A Reply Written in My Own Ink", "By a Hand I've Never Seen",
  "The Second Watcher Agrees With the First", "Before I've Placed Either",
  "Patient, Calm, and Already Finished", "The Page That Answered Itself",
  "My Work, Days Behind Its Own Reply", "Two Marks, One Unremembered", "The Twin I Didn't Draw",
  "A Correspondence With No Sender", "The Reply Arrives Before the Question",
  "Two Hands, One Page, One of Them Mine", "What I Wrote Beneath the Drawing",
  "The Other Hand's Steady Correction", "A Second Watcher, Uninvited",
  "Exactly Where the First Expected It", "The Page I Didn't Fill Alone",
  "Already Waiting in a Hand Not Mine", "Two Observations, One Origin I Cannot Place",
  "The Reply That Knew My Question First", "A Twin Mark, Older Than the First",
  "Correct in Every Particular, Still", "The Second Hand Writes On",
  "My Own Hand, Imitated Too Well", "Two Where the Chart Allows Two",
  "Neither of Them Mine to Claim", "The Correspondence I Never Started",
  "A Reply Waiting Since Before I Asked", "The Page Finishes Itself Again",
  "Patient Ink, Calm Certainty", "The Second Watcher Never Hesitates",
  "Twin Marks, Twin Silences", "What the Other Hand Already Settled",
  "A Question Answered Before It Was Mine", "The Reply, Unchanged From the First Time",
  "Two Hands Agreeing in the Dark", "The Twin I Cannot Account For",
  "Already Finished When I Arrived", "My Ink Beneath Another's Certainty",
  "The Second Mark Confirms the First", "A Correspondence That Writes Both Sides",
  "The Reply Keeps Its Own Counsel", "Two Watchers, One Silent Author",
  "The Hand That Finishes What I Start", "Correct Before I've Checked",
  "The Twin Page, Filled in Advance", "A Second Certainty I Didn't Earn",
  "The Reply That Was Always Going to Come", "Two Marks, Exactly One Explanation",
  "The Other Hand's Final Word", "A Page Patient Enough to Wait for Me",
  "The Twin Observation, Unprompted", "Already Known, Already Drawn",
  "The Reply Completes Itself", "Two of Everything, Nothing Left Unanswered",
];
