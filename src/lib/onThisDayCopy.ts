// On This Day Copy Generation System
// Generates intimate, humorous, context-aware microcopy for past activities

export interface OnThisDayActivity {
  id: string;
  activity_date: string;
  emoji?: string;
  notes?: string;
}

export interface OnThisDayContext {
  yearsBack: number;
  items: OnThisDayActivity[];
  userId: string;
  date: string; // ISO date string
}

export interface OnThisDayCopy {
  title: string;
  subtitle?: string;
  body?: string;
  cta?: string;
}

// Emoji category mapping
export type EmojiCategory = 
  | 'ROMANTIC_SOFT'
  | 'PLAYFUL_TEASE'
  | 'SPICY_HEAT'
  | 'LOCATION_HOME'
  | 'LOCATION_AWAY'
  | 'META_CAPTURE'
  | 'UNKNOWN';

const EMOJI_CATEGORY_MAP: Record<string, EmojiCategory> = {
  // ROMANTIC_SOFT
  'Romantic': 'ROMANTIC_SOFT',
  'Candle': 'ROMANTIC_SOFT',
  'Hearts': 'ROMANTIC_SOFT',
  'Lips': 'ROMANTIC_SOFT',
  'Kiss': 'ROMANTIC_SOFT',
  'Ribbon': 'ROMANTIC_SOFT',
  'Sparkles': 'ROMANTIC_SOFT',
  'Special': 'ROMANTIC_SOFT',
  'Vanilla': 'ROMANTIC_SOFT',

  // PLAYFUL_TEASE
  'Tease': 'PLAYFUL_TEASE',
  'Dress-up': 'PLAYFUL_TEASE',
  'Striptease': 'PLAYFUL_TEASE',
  'Devil': 'PLAYFUL_TEASE',
  'Hot Face': 'PLAYFUL_TEASE',
  'Explosion': 'PLAYFUL_TEASE',
  'Hot': 'PLAYFUL_TEASE',

  // SPICY_HEAT
  'Spicy': 'SPICY_HEAT',
  '69': 'SPICY_HEAT',
  'Bondage': 'SPICY_HEAT',
  'Ice': 'SPICY_HEAT',
  'Cowgirl': 'SPICY_HEAT',
  'Oral': 'SPICY_HEAT',
  'Anal': 'SPICY_HEAT',
  'Fingering': 'SPICY_HEAT',
  'Scissoring': 'SPICY_HEAT',
  'Ass': 'SPICY_HEAT',
  'Dick': 'SPICY_HEAT',
  'Cum': 'SPICY_HEAT',
  'Porn': 'SPICY_HEAT',
  'Tits': 'SPICY_HEAT',
  'Dildo': 'SPICY_HEAT',

  // LOCATION_HOME
  'Bed': 'LOCATION_HOME',
  'Sofa': 'LOCATION_HOME',
  'Shower': 'LOCATION_HOME',
  'Bathtub': 'LOCATION_HOME',
  'Laundry room': 'LOCATION_HOME',
  'Kitchen': 'LOCATION_HOME',
  'Chair': 'LOCATION_HOME',

  // LOCATION_AWAY
  'Hotel': 'LOCATION_AWAY',
  'Hotell': 'LOCATION_AWAY',
  'Abroad': 'LOCATION_AWAY',
  'Tent': 'LOCATION_AWAY',
  'Beach': 'LOCATION_AWAY',
  'Boat': 'LOCATION_AWAY',
  'Airplane': 'LOCATION_AWAY',
  'Train': 'LOCATION_AWAY',
  'Car': 'LOCATION_AWAY',
  'Bus': 'LOCATION_AWAY',
  'Public sauna': 'LOCATION_AWAY',
  'Public pool': 'LOCATION_AWAY',
  'Public toilet': 'LOCATION_AWAY',
  'Outdoor': 'LOCATION_AWAY',

  // META_CAPTURE
  'Recording': 'META_CAPTURE',
  'Photographing': 'META_CAPTURE',
};

// Priority order for category selection
const CATEGORY_PRIORITY: EmojiCategory[] = [
  'SPICY_HEAT',
  'PLAYFUL_TEASE',
  'ROMANTIC_SOFT',
  'LOCATION_AWAY',
  'LOCATION_HOME',
  'META_CAPTURE',
  'UNKNOWN',
];

export function getEmojiCategory(label: string): EmojiCategory {
  return EMOJI_CATEGORY_MAP[label] || 'UNKNOWN';
}

export function getDominantCategory(items: OnThisDayActivity[]): EmojiCategory {
  const categories = new Set<EmojiCategory>();
  
  items.forEach(item => {
    if (item.notes) {
      // Notes might contain the label
      const category = getEmojiCategory(item.notes);
      if (category !== 'UNKNOWN') categories.add(category);
    }
  });
  
  // Return highest priority category found
  for (const cat of CATEGORY_PRIORITY) {
    if (categories.has(cat)) return cat;
  }
  
  return 'UNKNOWN';
}

// Time of day bucket based on timestamp
export type TimeOfDayBucket = 
  | 'Early Bird'
  | 'Lazy Morning'
  | 'Nooner'
  | 'Afternoon Delight'
  | 'Evening Bliss'
  | 'Night Owl';

export function getTimeOfDayBucket(dateStr: string): TimeOfDayBucket {
  const date = new Date(dateStr);
  const hour = date.getHours();
  
  if (hour >= 5 && hour < 8) return 'Early Bird';
  if (hour >= 8 && hour < 12) return 'Lazy Morning';
  if (hour >= 12 && hour < 14) return 'Nooner';
  if (hour >= 14 && hour < 18) return 'Afternoon Delight';
  if (hour >= 18 && hour < 22) return 'Evening Bliss';
  return 'Night Owl';
}

// Deterministic hash for stable selection
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

export function pickVariant<T>(seed: string, variants: T[]): T {
  if (variants.length === 0) throw new Error('No variants provided');
  const index = hashString(seed) % variants.length;
  return variants[index];
}

// Count bucket types
type CountBucket = 'ZERO' | 'ONE' | 'TWO' | 'THREE_PLUS';

function getCountBucket(count: number): CountBucket {
  if (count === 0) return 'ZERO';
  if (count === 1) return 'ONE';
  if (count === 2) return 'TWO';
  return 'THREE_PLUS';
}

// Years back bucket types
type YearsBackBucket = 'ONE_YEAR' | 'TWO_YEARS' | 'THREE_PLUS';

function getYearsBackBucket(yearsBack: number): YearsBackBucket {
  if (yearsBack === 1) return 'ONE_YEAR';
  if (yearsBack === 2) return 'TWO_YEARS';
  return 'THREE_PLUS';
}

// ========== COPY LIBRARIES ==========

// Title variants
const TITLES = {
  ONE_YEAR: [
    "One year ago today…",
    "This day, last year",
    "365 days back",
    "A year ago exactly",
    "Flashback: 1 year",
    "Same date, 2024 energy",
    "On this day (1 year ago)",
    "Rewind: 12 months",
    "Anniversary of a moment",
    "The annual reminder",
  ],
  TWO_YEARS: [
    "Two years ago today…",
    "This day, 2 years back",
    "Flashback: 2 years",
    "730 days ago",
    "On this day (2 years ago)",
    "Twice around the sun",
    "Two winters ago",
    "A proper throwback",
    "Still in the archive",
    "Before everything else",
  ],
  THREE_PLUS: [
    "A proper throwback…",
    "Ancient history, kinda",
    "From the archives",
    "Way back when",
    "Deep cut memory",
    "Vintage you",
    "The olden days",
    "Time capsule unlocked",
    "Distant sparks",
    "A while ago now",
  ],
};

// Subtitles by count
const SUBTITLES_ZERO = [
  "Blank… suspiciously wholesome.",
  "Nothing logged. Either it was quiet… or you were busy not logging.",
  "A gap in the record. Mysterious.",
  "The archive is silent here.",
  "No data. Just vibes.",
  "This day was off the books.",
  "Apparently, you took the day off.",
  "The log says nothing. The log knows nothing.",
  "Quiet day, or just undocumented?",
  "No receipts. No judgement.",
  "The void stares back.",
  "A rest day, probably.",
  "Nothing on file. Plausible deniability.",
  "Either chill or chaotic — we'll never know.",
  "The mystery endures.",
  "A day without evidence.",
  "Suspiciously quiet.",
  "Off the grid that day.",
  "No moments captured.",
  "The record is sealed.",
];

const SUBTITLES_ONE = [
  "One moment. It counted.",
  "A single spark. That's all it takes.",
  "One is enough.",
  "Low effort, high payoff.",
  "Quality over quantity.",
  "One logged. One remembered.",
  "Minimal but memorable.",
  "A solo entry. Still valid.",
  "Just the one. Perfect.",
  "Singular focus.",
  "One and done.",
  "A moment worth noting.",
  "Brief but logged.",
  "One tick in the box.",
  "Simple math: 1 > 0.",
  "The bare minimum, achieved.",
  "One spark is still a spark.",
  "Efficiency mode: activated.",
  "One entry, zero regrets.",
  "A quiet win.",
];

const SUBTITLES_TWO = [
  "A double feature.",
  "Twice the sparks.",
  "Two logged. Someone was motivated.",
  "Busy day? Busy day.",
  "Double trouble, in the best way.",
  "Two for the books.",
  "A pair of moments.",
  "Apparently you had plans.",
  "Two is a pattern starting.",
  "Going for gold, apparently.",
  "Doubled down.",
  "Second helpings.",
  "A repeat performance.",
  "Two-for-one energy.",
  "Back-to-back.",
  "The sequel was greenlit.",
  "Consistency unlocked.",
  "A productive day.",
  "Two sparks, one day.",
  "Overachievers.",
];

const SUBTITLES_THREE_PLUS = [
  "Someone was in a mood.",
  "A very productive day.",
  "The record speaks for itself.",
  "Ambitious, in the best way.",
  "Past you understood the assignment.",
  "Chaos, but make it cute.",
  "A day of many sparks.",
  "The log is thick.",
  "You really showed up.",
  "Maximum effort mode.",
  "Hat trick and beyond.",
  "A busy, busy day.",
  "The archive overflows.",
  "Legendary output.",
  "A multi-spark situation.",
  "You went all in.",
  "Triple threat energy.",
  "The day that kept giving.",
  "Stamina: confirmed.",
  "A personal best, maybe?",
];

// Body copy by category
const BODY_BY_CATEGORY: Record<EmojiCategory, string[]> = {
  ROMANTIC_SOFT: [
    "Sweet vibes documented.",
    "Soft and steady.",
    "The gentle kind of spark.",
    "Hearts were involved.",
    "Cozy energy.",
    "Warmth logged.",
  ],
  PLAYFUL_TEASE: [
    "A little mischief in the air.",
    "Playful chaos detected.",
    "The flirty kind.",
    "Someone was feeling spicy.",
    "A hint of drama.",
    "Extra-curricular activities.",
  ],
  SPICY_HEAT: [
    "The rated-R kind of day.",
    "Some grown-up activities.",
    "After-hours stuff.",
    "A little extra.",
    "The spicy chapter.",
    "Adult content: logged.",
  ],
  LOCATION_HOME: [
    "Home base advantage.",
    "Comfort zone activated.",
    "Domestic bliss.",
    "At-home energy.",
    "The familiar setting.",
    "No commute required.",
  ],
  LOCATION_AWAY: [
    "Adventure mode: on.",
    "Location: elsewhere.",
    "Travel sparks.",
    "Away from home.",
    "The road trip kind.",
    "Explorers.",
  ],
  META_CAPTURE: [
    "Documented for posterity.",
    "Creating content, apparently.",
    "The vibe was captured.",
    "For the archives.",
    "Visual evidence exists.",
    "Memory preserved.",
  ],
  UNKNOWN: [
    "A moment happened.",
    "Something went down.",
    "The record exists.",
    "Details: classified.",
    "It's logged, that's what matters.",
    "A spark, unspecified.",
  ],
};

// Time of day flavor
const TIME_OF_DAY_FLAVOR: Record<TimeOfDayBucket, string[]> = {
  'Early Bird': [
    "Responsible chaos before breakfast.",
    "Morning people?? Apparently.",
    "Early risers, early sparks.",
    "Dawn patrol energy.",
    "Before coffee, even.",
  ],
  'Lazy Morning': [
    "Slow start, strong finish.",
    "Mid-morning magic.",
    "After breakfast, before lunch.",
    "The leisurely kind.",
    "Brunch-adjacent.",
  ],
  'Nooner': [
    "Lunch break well spent.",
    "Midday momentum.",
    "The noon hour special.",
    "Prime time, daytime.",
    "High noon vibes.",
  ],
  'Afternoon Delight': [
    "Afternoon… delight. Obviously.",
    "The 3pm kind of energy.",
    "Post-lunch, pre-dinner.",
    "Classic afternoon.",
    "Golden hour adjacent.",
  ],
  'Evening Bliss': [
    "Prime time delivery.",
    "Evening shift: clocked in.",
    "After-dinner plans.",
    "The reliable evening.",
    "Sunset energy.",
  ],
  'Night Owl': [
    "The after-hours department.",
    "Late night logging.",
    "Midnight adjacent.",
    "When the moon's out.",
    "The quiet hours.",
  ],
};

// CTAs (all optional and gentle)
const CTAS = [
  "Log something today?",
  "Make today count too.",
  "Add to the archive.",
  "Continue the tradition?",
  "Today's still open.",
  "",
  "",
  "", // Empty strings = no CTA shown sometimes
];

// ========== MAIN FUNCTION ==========

export function buildOnThisDayCopy(context: OnThisDayContext): OnThisDayCopy {
  const { yearsBack, items, userId, date } = context;
  const count = items.length;
  
  const yearsBackBucket = getYearsBackBucket(yearsBack);
  const countBucket = getCountBucket(count);
  const category = getDominantCategory(items);
  const timeOfDay = items.length > 0 
    ? getTimeOfDayBucket(items[0].activity_date) 
    : 'Evening Bliss';
  
  // Build seed for deterministic selection
  const baseSeed = `${userId}-${date}-${yearsBack}`;
  
  // Pick title
  const titleSeed = `${baseSeed}-title`;
  const title = pickVariant(titleSeed, TITLES[yearsBackBucket]);
  
  // Pick subtitle based on count
  const subtitleSeed = `${baseSeed}-subtitle-${countBucket}`;
  let subtitles: string[];
  switch (countBucket) {
    case 'ZERO':
      subtitles = SUBTITLES_ZERO;
      break;
    case 'ONE':
      subtitles = SUBTITLES_ONE;
      break;
    case 'TWO':
      subtitles = SUBTITLES_TWO;
      break;
    case 'THREE_PLUS':
      subtitles = SUBTITLES_THREE_PLUS;
      break;
  }
  const subtitle = pickVariant(subtitleSeed, subtitles);
  
  // Pick body (only for count > 0)
  let body: string | undefined;
  if (count > 0) {
    const bodySeed = `${baseSeed}-body-${category}`;
    const categoryBodies = BODY_BY_CATEGORY[category];
    const timeFlavorSeed = `${baseSeed}-time`;
    const timeFlavor = pickVariant(timeFlavorSeed, TIME_OF_DAY_FLAVOR[timeOfDay]);
    
    // Sometimes combine category + time, sometimes just one
    const combineSeed = `${baseSeed}-combine`;
    const shouldCombine = hashString(combineSeed) % 3 === 0; // 1/3 chance
    
    if (shouldCombine && count >= 2) {
      body = `${pickVariant(bodySeed, categoryBodies)} ${timeFlavor}`;
    } else {
      // Pick one or the other
      const pickTimeSeed = `${baseSeed}-picktime`;
      body = hashString(pickTimeSeed) % 2 === 0 
        ? pickVariant(bodySeed, categoryBodies)
        : timeFlavor;
    }
  }
  
  // Pick CTA (optional)
  const ctaSeed = `${baseSeed}-cta`;
  const cta = pickVariant(ctaSeed, CTAS) || undefined;
  
  return {
    title,
    subtitle,
    body,
    cta,
  };
}

// ========== EXPORTS FOR TESTING ==========

export const _testing = {
  EMOJI_CATEGORY_MAP,
  CATEGORY_PRIORITY,
  TITLES,
  SUBTITLES_ZERO,
  SUBTITLES_ONE,
  SUBTITLES_TWO,
  SUBTITLES_THREE_PLUS,
  BODY_BY_CATEGORY,
  TIME_OF_DAY_FLAVOR,
  CTAS,
  hashString,
  getCountBucket,
  getYearsBackBucket,
};
