/**
 * journalTitles.ts
 *
 * Per-region puzzle titles, grounded in each chapter's own journal imagery
 * (data/regions.ts descriptions + CHAPTER_COMPLETIONS lore in
 * app/puzzle/[id]/PuzzleClient.tsx) instead of the old generic
 * difficulty-tiered pool (scripts/titlePool.ts), which doesn't reference
 * any region's specific content. Matches Mercer's established voice: short,
 * observational, noun-phrase or terse clause — "The Third Window", "A
 * Measurement That Will Not Close" — never flowery.
 *
 * Within a region, titles are listed roughly in escalating-unease order so
 * assignment-by-score (see assignJournalTitles.ts) has the imagery itself
 * subtly sharpen alongside the puzzles' real difficulty.
 */

export const LANDFALL_TITLES: string[] = [
  'The Approach by Water', 'Shore Before Dusk', 'The Empty Mooring', 'Gulls Over the Point',
  'The Unlit Lamp', 'Boots on Wet Stone', 'The Path Up from the Landing', 'Salt on the Door',
  'The Keeper\'s Unlocked Door', 'A House Without a Keeper', "Vale's Empty Chair",
  'The Cold Hearth', 'The Register, Last Entry', 'No Watch Kept', 'The Bell Not Rung',
  'Charts Folded Wrong', 'The First Night Alone', 'A Light Still Turning',
  'No Movement From the Water', 'The Silence Where Vale Should Be',
  'Tower Sound, Keeper Gone', 'The Log Resumes', 'Setting the Watch Myself',
  'What the Tide Brought In', 'The Walk to the Tower', 'Counting the Steps Up',
  'The Door at the Base', 'A Stair I Have Not Climbed', 'First Light Through the Lens',
  'The Shoreline, Unremarkable', 'Nothing Yet Out of Place', 'The Easy Climb',
  'Before I Knew to Look Closer', 'The Approach Confirmed', 'Settling In for the Night',
  'The Tower, Sound for Now',
];

export const SURVEY_TITLES: string[] = [
  "The Marks Above the Entrance", "Mason's Work, Surely", "A Chisel's Old Lines",
  "The Threshold Stone", "Measuring the Doorframe", "The First Doubt", "A Second Measurement",
  "Vale's Journal, Recovered", "Little But Numbers", "Repeated Past Need",
  "\"Bigger Within,\" Underlined", "The Phrase Written Twice", "Copying the Marks Myself",
  "The Lintel's Odd Angle", "A Margin Note, Unsigned", "The Torn Page",
  "What the Tally Doesn't Add", "The Plumb Line Indoors", "Nonsense, I Called It",
  "Checking the Simple Arithmetic", "The Blank Page After", "Numbers That Don't Resolve",
  "The Ledger's Last Column", "An Entrance Re-Measured", "Marks I Did Not Make",
  "The Doorframe, Twice Over", "Mason's Chisel, Mason's Doubt", "What Vale Underlined",
  "The Interior Doesn't Match the Door", "A Discrepancy of Inches", "Counting the Marks Again",
  "The Survey Resumes at Dusk", "Three Measurements, Three Answers", "The Page I Keep Returning To",
  "A Note in My Own Hand, Unremembered", "Marks Without Meaning", "The Entrance Measured Four Times",
  "What the Chisel Left Behind", "Vale's Hand, Shaking by the End",
  "The Threshold That Won't Agree With Itself", "A Second Opinion From the Stone",
  "The Tally Sheet, Crossed Out", "Numbers I Trust Less Each Time",
  "The Lintel Measured From Both Sides", "Copying What I Cannot Explain",
  "The Margin Fills With Doubt", "A Mason Long Since Dead",
  "The Door That Measures Differently Each Time", "What Mason's Work Conceals",
  "The Last Page of Vale's Hand", "Stone That Won't Hold a Fixed Number",
  "The Survey I Cannot Finish", "Returning to the Same Wrong Sum", "What I Underlined Myself",
  "The Entrance, Measured Once More",
];

export const LOWER_LEVEL_TITLES: string[] = [
  "Twenty-One Feet, Eight Inches", "Checked From Three Walls", "The Tower Does Not Care",
  "The Spiral Stair Down", "A Landing I Don't Remember", "The Turn That Shouldn't Be There",
  "Counting Steps on the Way Down", "The Narrowing Passage", "A Wider Room Below",
  "The Weighted Line, Hung Still", "Clear of the Stone at the Bottom", "Drawn Toward It Higher Up",
  "Though the Line Itself Is Straight", "A Fourth Wall, A Fourth Number", "The Level That Isn't",
  "Stopped Assuming the Fault Is Mine", "The Plumb Bob's Small Lie", "A Measurement I Trust Less",
  "The Missing Step", "An Echo That Returns Too Soon", "The Stair That Doesn't End Where Counted",
  "Larger Within, As Vale Wrote", "The Drop Beneath the Landing", "A Second Spiral, Unmarked",
  "The Wall That Leans Without Leaning", "Re-Measuring in Better Light", "The Line Hangs Wrong Again",
  "A Room Too Large for Its Door", "The Fifth Wall I Shouldn't Need", "Stone That Pulls the Plumb Line",
  "The Count of Steps, Disputed", "Where the Passage Should Have Ended", "A Deeper Landing Than Charted",
  "The Weighted Line Refuses to Settle", "Measuring Twice, Believing Neither",
  "The Stair's Impossible Extra Turn", "A Number the Tower Rejects", "The Level I Cannot Trust",
  "Walls That Measure Differently Each Visit", "The Narrow Place That Isn't Narrow",
  "A Fault That Isn't Mine", "The Landing Below the Landing", "Stone Pulling Against the Plumb",
  "The Spiral's Uncounted Turn", "Twenty-One Eight, And Then Not",
  "The Passage That Widens as I Descend", "A Wall Measured Four Different Ways",
  "The Stair I Climb Down Twice", "What the Third Wall Confirmed",
  "The Weighted Line's Second Lie", "A Landing That Shouldn't Exist", "The Lower Level, Still Measuring",
  "Where Larger Within Begins to Make Sense", "The Fourth Measurement, Worse Than the First",
  "A Stone Floor That Isn't Level", "The Turn I Miscounted Twice", "Stopped Trusting My Own Hand",
  "The Passage Vale Never Finished Charting", "A Wider Room Than the Walls Allow",
  "The Plumb Line's Steady Refusal", "Measuring the Unmeasurable Again", "The Stair Keeps Its Own Count",
  "A Fault in the Stone, Not in Me", "The Level Beneath the Tower's Foundation",
  "Where Three Walls Disagree", "The Weighted Line, Hung a Third Time",
  "A Deeper Floor Than the Plans Show", "The Measurement I Keep Re-Checking", "What the Tower Will Not Confirm",
];

export const LANTERN_ROOM_TITLES: string[] = [
  "Thirty-Six Seconds by the Gears", "Forty-One by the Light", "One Revolution, As Built",
  "The Mechanism Is Sound", "Counted From the Gallery", "Counted Again From the Stair",
  "The Discrepancy Holds Every Time", "The Retaining Bracket", "A Cut I Didn't Feel at First",
  "Blood Finding the Lens", "Settled Into the Grooves", "As Though It Belonged There",
  "Drawing What the Blood Shows", "The Gears, Examined Myself", "A Second Hand That Lags",
  "The Beam's Slower Turn", "Five Seconds Unaccounted For", "The Housing, Opened and Resealed",
  "What the Glass Remembers", "The Lens Through Red Light", "A Groove That Wasn't Cut by Any Tool",
  "The Interval Widens With Each Count", "Thirty-Six on Paper, Forty-One in Truth",
  "The Mechanism Doesn't Know It's Wrong", "A Reflection That Holds Too Long",
  "The Light Through What I Spilled", "Drawing By Lamplight, By Blood-Light",
  "The Gears Turn On, Indifferent", "A Fourth Count From the Gallery Stair",
  "What the Retaining Bracket Caught", "The Lens Drinks the Light Oddly Now",
  "Forty-One Seconds, Confirmed Again", "The Turning Mechanism's Quiet Lie",
  "Blood in the Grooves, Dried Now", "A Pattern the Glass Was Not Cut to Show",
  "The Beam Arrives Late, Always Late", "Watching the Second Hand Fall Behind",
  "The Lens Shows More the Longer I Look", "A Discrepancy I Can No Longer Blame on Counting",
  "The Gears Sound in the Walls at Night", "What Settled Into the Glass Stays There",
  "The Light Through the Wound in the Lens", "Five Seconds That Should Not Exist",
  "The Mechanism, Taken Apart and Found Sound", "Drawing the Shape the Blood Insists On",
  "The Interval, Measured a Fifth Time",
  "The Count That Refuses to Settle", "A Sixth Hand on the Dial", "What the Lens Won't Let Me Unsee",
  "The Gears Keep Their Own Time Now",
];

export const WEST_WALL_TITLES: string[] = [
  "Two Windows, By the Exterior Record", "Three, Counted From the Stair",
  "The Centre Opening", "No Corresponding Stone Outside", "I Struck the Wall to Be Sure",
  "From Within, the Sound Came Through Glass", "A Horizon Sitting Lower Than It Should",
  "As Though I Stand Somewhere Higher", "The Third Window's Exact Position",
  "Counted From the Stair a Second Time", "The Exterior Wall, Unbroken Stone",
  "What the Glass Lets Through", "A View That Doesn't Match the Map",
  "The Window With No Frame Outside", "Light Falling Wrong Through the Centre Pane",
  "The Count Still Disagrees", "Two Without, Three Within, Both True",
  "A Height I Have No Stair For", "The Horizon's Small, Wrong Drop",
  "Glass That Shouldn't Hold a View at All", "Striking the Wall Where the Window Should End",
  "The Sound of Glass With No Window Behind It", "A Fourth Count, Still Three",
  "What the Third Window Overlooks", "The View Sits Lower Each Time I Check",
  "No Masonry to Explain the Gap", "The Wall I Struck Rings Hollow There and Nowhere Else",
  "A Window Opening Onto a Height That Isn't Mine",
  "The Record Says Two; My Eyes Say Otherwise", "Through the Centre Pane, the Wrong Sea",
  "The Third Window, Measured Against the Stone", "An Opening the Mason Never Cut",
  "The Horizon Keeps Falling, Pane by Pane", "Glass Where the Exterior Shows Solid Wall",
  "Standing Somewhere I Have No Stair To", "The West Wall's Impossible Third Frame",
  "What I See Through It I Cannot Reach", "The Window That Answers to No Measurement",
  "Three Windows, Confirmed, Still Unexplained",
  "The Wall Rings Hollow Everywhere Now", "A Height No Stone Admits To",
  "The Third Window, Measured a Final Time", "What the Exterior Will Never Record",
];
