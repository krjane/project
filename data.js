// Default household: rooms, tasks tailored to Kris & Elise's apartment, rules and fun lists.
export const EPOCH = '2026-11'; // Round 1 / Season 1 starts November 2026

export const PALETTE = ['#FF5A36', '#139E9B', '#7C5CFF', '#E8A600', '#E8487D', '#2E86FF', '#2FA84F', '#FF8A00'];
export const PLAYER_EMOJI = ['🧽','🫧','🧹','🪣','🧤','🦄','🐸','🦊','🐼','🐙','🌵','🍄','⚡','🔥','🌈','👑','🤖','👾','🦖','🐝','🍋','🌶️','🎸','🎧'];
export const ROOM_EMOJI = ['🍳','🛁','🛋️','🚪','🛏️','🧳','🧥','🪜','🏠','🧺','🪴','🖥️','🎸','🍽️','🚿','📦','🌳','🚗','🐾','🧸'];

export const RANKS = [
  [0, 'Dust Rookie', '🐣'],
  [30, 'Sponge Apprentice', '🧽'],
  [90, 'Mop Squire', '🪣'],
  [180, 'Scrub Knight', '🛡️'],
  [320, 'Grout Baron', '🎩'],
  [500, 'Sparkle Duke', '✨'],
  [750, 'Grime Legend', '👑'],
];

export const SPECIAL_BADGES = [
  ['bounty', '🎯', 'Bounty Hunter', 'Snag a task during bounty hour'],
  ['mystery', '❓', 'Mystery Solver', 'Finish the secret double-points task'],
  ['sweep', '🧹', 'Clean Sweep', 'Finish every task assigned to you in a round'],
  ['early', '🌅', 'Early Bird', 'Clear your whole list by the 10th'],
  ['team', '🤝', 'Dream Team', 'Clear an entire round together'],
  ['champ', '🏆', 'Round Champion', 'Win a round'],
  ['season', '🥇', 'Season Champion', 'Win a full season'],
];

const ROOMS = [
  ['kitchen', '🍳', 'Kitchen'],
  ['bath', '🛁', 'Bathroom'],
  ['living', '🛋️', 'Living room'],
  ['front', '🚪', 'Front room'],
  ['bed1', '🛏️', 'Bedroom'],
  ['guest', '🧳', 'Guest room / office'],
  ['closets', '🧥', 'Closets'],
  ['stairs', '🪜', 'Stairwell'],
  ['whole', '🏠', 'Whole apartment'],
];

// [id, room, name, points, every-N-months, badge title, tip]
const TASKS = [
  ['fridge','kitchen','Fridge purge & wipe-down',3,1,'Fridge Archaeologist','Toss anything expired, pull out the shelves and drawers, warm soapy water. Fresh box of baking soda in the back.'],
  ['stove','kitchen','Gas stove: soak grates & caps, degrease top',3,1,'Grate Expectations','Grates and burner caps go in the sink with hot water, dish soap and a scoop of baking soda for 20 min while you wipe the stovetop. Dry the caps fully before they go back on, or the burners light unevenly.'],
  ['micro','kitchen','Microwave steam-clean',1,1,'Steam Machine','Bowl of water + a lemon slice, 3 minutes on high, let it sit 2 more, then everything wipes right off.'],
  ['airfryer','kitchen','Air fryer deep clean',2,1,'Crispy Clean','Soak the basket in hot soapy water. Unplug, flip it over, and wipe the heating element with a damp (not wet) sponge.'],
  ['sink','kitchen','Sink scrub & drain refresh',1,1,'Drain Whisperer','Baking soda + hot water down the drain. Scrub the strainer basket and the faucet base with an old toothbrush.'],
  ['dw','kitchen','Dishwasher filter & door seal',1,1,'Dish Pit Boss','Twist out the filter at the bottom, rinse and scrub it. Wipe the rubber door seal and the bottom lip of the door where gunk hides.'],
  ['back','kitchen','Backsplash & small appliances',2,2,'Splash Zone Hero','Shake out toaster crumbs, wipe the kettle and coffee maker, degrease the backsplash behind the stove.'],
  ['cab','kitchen','Cabinet fronts & handles',2,2,'Handle Handler','Dish soap + warm water. Handles and the cabinets next to the stove hold the most gunk.'],
  ['kettle','kitchen','Descale kettle / coffee maker',1,3,'Scale Slayer','Half vinegar, half water, run one cycle, then two cycles of plain water.'],
  ['dwcycle','kitchen','Dishwasher cleaning cycle',1,3,'Rinse Cycle Royalty','Empty dishwasher, a cup of white vinegar upright on the top rack (or a cleaner tab), hottest cycle.'],
  ['oven','kitchen','Oven interior + racks',5,3,'Oven Overlord','Baking soda paste the night before. Next day, spray vinegar and wipe. Racks soak in the tub with dish soap.'],
  ['hood','kitchen','Range hood filter degrease',2,3,'Filter Fixer','Boiling water + a scoop of baking soda + dish soap. Soak the filter 15 min, scrub, dry, pop it back in.'],
  ['pantry','kitchen','Pantry & inside-cabinet purge',4,6,'Pantry Sage','One shelf at a time: empty it, toss what’s expired, wipe it down, put like with like.'],
  ['behind','kitchen','Behind & under the fridge',3,6,'Behind-the-Scenes Legend','Slide it out slowly with a towel or cardboard under the feet to protect the hardwood. Vacuum the coils and floor, damp-mop. Along the stove, use the crevice tool rather than pulling it out — there’s a gas line back there.'],

  ['tub','bath','Tub, shower walls & grout',4,1,'Grout Gladiator','Spray, walk away for 10 minutes, then scrub — let the cleaner do the work. Grout: baking soda paste + toothbrush.'],
  ['toilet','bath','Toilet deep clean (base & behind too)',3,1,'Throne Restorer','Bowl, seat hinges, the base, and the floor behind it. Gloves on, podcast in.'],
  ['curtain','bath','Shower curtain, liner & bath mats wash',2,2,'Curtain Call','Liner goes in the washer with a couple of towels to scrub it. Hang to dry right on the rod.'],
  ['head','bath','Descale showerhead & faucets',2,3,'Flow Restorer','Rubber-band a bag of vinegar over the showerhead for an hour. Scrub the nozzles, run hot water.'],
  ['medcab','bath','Medicine cabinet & under-sink purge',2,3,'Cabinet Curator','Toss anything expired, wipe the shelves, merge the half-empty bottles.'],
  ['fan','bath','Exhaust fan cover & light fixture',1,3,'Fan Club President','Pop the cover off, wash it in the sink, vacuum the fan blades.'],

  ['couch','living','Couch deep vacuum (under the cushions)',2,2,'Couch Treasure Hunter','Cushions off, crevice tool. Announce the best thing you find.'],
  ['throws','living','Wash throw blankets & pillow covers',1,3,'Cozy Commander','Cold wash, low dry. Fluff the pillows while you wait.'],
  ['high','living','Dust the high spots: fixtures, door tops, shelf tops',2,2,'Dust Bunny Wrangler','Start high, work down. A microfiber on a stick (or a sock on a broom) for the tops of door frames and light fixtures.'],
  ['furn','living','Move furniture, vacuum under, check felt pads',3,3,'Furniture Shuffler','Lift, don’t drag, on hardwood. Replace any felt pads that have worn through.'],
  ['rugs','living','Rugs: vacuum underside + floor beneath, rotate',3,3,'Rug Rotator','Flip the rug, vacuum the back, vacuum the floor under it, then rotate it 180° to even out wear and sun fading. Make sure the rug pad lies flat — it protects the hardwood.'],
  ['windows','living','Windows, sills & tracks (inside)',4,3,'Window Wizard','Vacuum the tracks first, then a damp cloth. Go gentle on the old panes, and make a note of any drafty spots before winter.'],

  ['reset','front','Front room reset: drop zone, shoes, mat',2,1,'Entryway Enforcer','Sort the mail, pair up the shoes, shake the mat outside, wipe the hooks and console.'],
  ['base','front','Baseboards & trim (living + front room)',3,2,'Baseboard Boss','Damp microfiber along the baseboards and trim, then a dryer sheet. It helps repel dust afterward.'],

  ['bedwash','bed1','Wash pillows & duvet, vacuum + rotate mattress',3,3,'Mattress Maestro','Strip the bed, vacuum the mattress top, rotate it 180°, and run the pillows through the washer.'],
  ['under','bed1','Under-bed vacuum & dust surfaces',2,2,'Under-Bed Explorer','Pull out the storage bins, vacuum, dust the nightstands and headboard.'],

  ['desk','guest','Desk, monitor & cable tidy',2,2,'Cable Tamer','Dry microfiber on the screens and electronics, wipe the keyboard, zip-tie the cable spaghetti.'],
  ['guestbed','guest','Guest bed: refresh linens & vacuum under',2,3,'Hospitality Hero','Unused sheets still get dusty. Wash them so the bed’s ready for surprise guests.'],
  ['wardrobe','guest','Clothes rack & dresser reset (+ donate pile)',3,6,'Wardrobe Whisperer','Refold, rehang, and start a donate pile. The owner of the clothes gets final veto on the donate pile.'],

  ['closet1','closets','Bedroom closet purge (fill a donate bag)',3,6,'Closet Liberator','Haven’t worn it in a year? Donate bag. Wipe the shelves, vacuum the floor.'],
  ['closet2','closets','Guest room closet purge',3,6,'Closet Liberator II','Same drill: donate bag, wipe shelves, vacuum the floor.'],
  ['closetf','closets','Front-room closet clear-out & wipe shelves',2,6,'Coat Check Champion','Out-of-season coats to the back, toss broken umbrellas, wipe the shelves.'],

  ['stairs','stairs','Stairs: vacuum + damp-wipe the treads',2,1,'Stair Master','Stick vac with the crevice tool along every step edge, then a barely-damp microfiber on the wood treads. It’s a shared stairwell, so give the downstairs neighbors a heads-up if you’ll be blocking it.'],
  ['rail','stairs','Handrail, spindles & stair baseboards',2,2,'Rail Ranger','Damp cloth along the rail, then each spindle. Baseboards last.'],
  ['cobweb','stairs','Cobweb patrol + stairwell light',1,3,'Cobweb Bouncer','Microfiber on a stick for the high corners and the light fixture.'],

  ['floors','whole','Hardwood floors: vacuum + damp-mop (do this last)',3,1,'Mop Star','Stick vac first, including the rugs (both directions). Then the flat microfiber mop with a pH-neutral hardwood cleaner — damp, never wet. Skip vinegar and steam on finished wood.'],
  ['switch','whole','Disinfect switches, door handles & remotes',1,2,'Germ Goalie','Wipe every light switch, door handle, remote and the fridge handle.'],
  ['bins','whole','Wash trash & recycling bins',2,2,'Bin Boss','Tub rinse with dish soap, dry fully, sprinkle baking soda in the bottom.'],
  ['plants','whole','Houseplant spa: dust leaves, rotate, trim',1,2,'Plant Parent of the Month','Damp cloth on the big leaves, a quarter-turn toward the window, pull dead leaves, check the undersides for pests.'],
  ['vents','whole','Floor vent registers: pull, vacuum, wash',2,3,'Vent Vigilante','Lift the register covers, vacuum as far into the duct as the stick vac reaches (lost stuff lives here), wash the covers in the tub.'],
  ['filter','whole','Furnace filter check (if it’s yours to change)',1,3,'Airflow Ace','Note the size printed on the filter edge. If the landlord handles it, check it and text them.'],
  ['doors','whole','Wipe doors & door frames',2,3,'Doorframe Detective','Tops of frames get dusty; the area around the knobs gets grimy.'],
  ['laundry','whole','Basement laundry spot: lint slot + machine wipe',1,3,'Lint Lord','Pull the lint screen and vacuum the slot under it. Wipe the washer gasket and leave the door open to dry.'],
  ['smoke','whole','Test smoke & CO detectors',1,6,'Beep Commander','Press test on each one. Swap batteries on anything that chirps.'],
];

export const STAKES = [
  'Loser makes the winner’s choice of breakfast (in bed counts).',
  'Winner picks the next date night, no veto.',
  'Loser handles the next three trash runs.',
  'Winner gets a 15-minute back rub, timer on.',
  'Loser buys the next round of coffee.',
  'Winner controls the aux for a full week.',
  'Loser does dishes for a week.',
  'Winner picks the movie, and the loser can’t check their phone during it.',
];
export const WILDCARDS = [
  'Hype song rule: the other person picks the song you clean to.',
  'Speed round: pick one task each and race the same timer.',
  'Mandatory snack break at halftime. Non-negotiable.',
  'Weirdest-thing-found contest. Winner gets bragging rights.',
  'Same podcast, both earbuds in, discuss after.',
  'Rock-paper-scissors decides who gets the first swap.',
  'Phones in a drawer until the mopping is done.',
  'Loudest singer while cleaning gets glory (no points, just glory).',
];
export const TEAM_REWARDS = [
  '🍜 Takeout night from the good place',
  '🎬 Movie night with the full snack spread',
  '☕ Brunch date',
  '🛋️ Lazy Sunday: zero chores allowed',
  '🍦 Ice cream run',
  '🎲 Game night + pizza',
  '🌳 Day trip somewhere new',
  '🎶 Pick a show to go see together',
];

export function makeDefaultHouse() {
  const rooms = {};
  ROOMS.forEach(([id, e, n], i) => (rooms[id] = { n, e, o: i }));
  const tasks = {};
  const groups = {};
  TASKS.forEach(([id, r, n, p, f, q, tip], ix) => {
    tasks[id] = { n, r, p, f, q, tip, since: 0, ix };
    (groups[f] = groups[f] || []).push(id);
  });
  // spread each frequency group across months (heaviest first, round-robin) so no round is brutal
  Object.keys(groups).forEach((f) => {
    groups[f]
      .slice()
      .sort((a, b) => tasks[b].p - tasks[a].p || tasks[a].ix - tasks[b].ix)
      .forEach((id, i) => (tasks[id].off = i % +f));
  });
  Object.values(tasks).forEach((t) => delete t.ix);
  return {
    v: 1,
    created: new Date().toISOString(),
    players: [
      { name: 'Kris', emoji: '🧽', color: PALETTE[0] },
      { name: 'Elise', emoji: '🫧', color: PALETTE[1] },
    ],
    rooms,
    tasks,
    oneoffs: {},
    months: {},
    rules: { epoch: EPOCH, bountyDay: 20, bountyMult: 1.5, mystery: true, mysteryMult: 2, tolerance: 2, minPerPt: 5 },
    lists: { stakes: STAKES, wild: WILDCARDS, team: TEAM_REWARDS },
  };
}
