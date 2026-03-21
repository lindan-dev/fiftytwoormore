/**
 * Authoritative emoji → label mapping for fiftytwoormore
 * 
 * This is the single source of truth for all emoji labels used in:
 * - Logging UI (EmojiSelector)
 * - Stats views (On this day, Best Periods, Bunny Days, Time of Day, Benchmarks)
 * - Emails (weekly digest, mid-week nudge, milestone, comeback)
 * - Admin / internal previews
 * - Tooltips, helper text, empty states, microcopy
 * 
 * RULES:
 * - Use exactly these labels verbatim
 * - Do not invent synonyms or fall back to old labels
 * - When listing multiple emojis, use labels separated by commas
 * - When referencing a single emoji in prose, capitalize the label
 */

// Authoritative emoji → label map
export const EMOJI_LABEL_MAP: Record<string, string> = {
  // Activities & Moves
  '🍑': 'Backside',
  '🍆': 'Disco Stick',
  '🍌': 'Disco Stick',
  '💋': 'Make-out',
  '👄': 'Lips at work',
  '👅': 'Tongue work',
  '🍩': 'Backdoor',
  '👉': 'Hands-on',
  '✂️': 'Side-by-side',
  '♋️': 'Mutual favor',
  '🏇': 'Taking the lead',
  '💃': 'Warm-up show',
  '💦': 'Grand finale',
  '💥': 'Things escalated',
  
  // Vibes & Intensity
  '🔥': 'Steamy',
  '🌶️': 'Extra spicy',
  '🍦': 'Classic',
  '🥵': 'Overheated',
  '😈': 'A bit naughty',
  '🦋': 'Teasing',
  '✨': 'Magic moments',
  '💕': 'All the feels',
  '🌹': 'Romantic vibes',
  '💎': 'Something special',
  
  // Extras & Props
  '🥕': 'Extra help',
  '⛓️': 'Tied-up fun',
  '🎭': 'In character',
  '🎀': 'All wrapped up',
  '🧊': 'Cold tricks',
  '🕯️': 'Set the mood',
  '🌽': 'Visual inspiration',
  '🍒': 'Upper assets',
  
  // Locations - Home
  '🛏️': 'Bedroom',
  '🛋️': 'Couch time',
  '🧺': 'Laundry break',
  '🚿': 'Shower session',
  '🛁': 'Bath time',
  '🪑': 'Chair situation',
  '🍽️': 'Kitchen counter',
  
  // Locations - Away
  '🌳': 'Out in the wild',
  '🏖️': 'Beachside',
  '🏕️': 'Tent adventures',
  '🏩': 'Hotel mode',
  '🚻': 'Risky location',
  '🧖': 'Sauna rules',
  '👙': 'Poolside',
  '🗺️': 'Away from home',
  
  // Transport
  '🚗': 'Backseat energy',
  '🚌': 'On the move',
  '🚂': 'Train ride',
  '✈️': 'Mile-high mood',
  '🛥️': 'On the water',
  
  // Meta / Capture
  '🎥': 'Captured',
  '📸': 'Snapshot',
  
  // Countries
  '🇫🇷': 'France',
  '🇪🇸': 'Spain',
  '🇮🇹': 'Italy',
  '🇬🇷': 'Greece',
  '🇵🇹': 'Portugal',
  '🇬🇧': 'United Kingdom',
  '🇩🇪': 'Germany',
  '🇳🇱': 'Netherlands',
  '🇺🇸': 'United States',
  '🇹🇭': 'Thailand',
  '🇲🇽': 'Mexico',
  '🇯🇵': 'Japan',
  '🇦🇺': 'Australia',
  '🇭🇷': 'Croatia',
  '🇸🇪': 'Sweden',
  '🇳🇴': 'Norway',
  '🇩🇰': 'Denmark',
  '🇫🇮': 'Finland',
  '🇮🇸': 'Iceland',
  '🇲🇦': 'Morocco',
  '🇿🇦': 'South Africa',
  '🇰🇪': 'Kenya',
  '🇹🇿': 'Tanzania',
  '🇪🇬': 'Egypt',
  '🇳🇬': 'Nigeria',
};

// Emoji category mapping for copy generation
export type EmojiCategory = 
  | 'ROMANTIC_SOFT'
  | 'PLAYFUL_TEASE'
  | 'SPICY_HEAT'
  | 'LOCATION_HOME'
  | 'LOCATION_AWAY'
  | 'META_CAPTURE'
  | 'UNKNOWN';

// Map labels to categories
const LABEL_CATEGORY_MAP: Record<string, EmojiCategory> = {
  // ROMANTIC_SOFT
  'Romantic vibes': 'ROMANTIC_SOFT',
  'Set the mood': 'ROMANTIC_SOFT',
  'All the feels': 'ROMANTIC_SOFT',
  'Make-out': 'ROMANTIC_SOFT',
  'All wrapped up': 'ROMANTIC_SOFT',
  'Magic moments': 'ROMANTIC_SOFT',
  'Something special': 'ROMANTIC_SOFT',
  'Classic': 'ROMANTIC_SOFT',

  // PLAYFUL_TEASE
  'Teasing': 'PLAYFUL_TEASE',
  'In character': 'PLAYFUL_TEASE',
  'Warm-up show': 'PLAYFUL_TEASE',
  'A bit naughty': 'PLAYFUL_TEASE',
  'Overheated': 'PLAYFUL_TEASE',
  'Things escalated': 'PLAYFUL_TEASE',

  // SPICY_HEAT
  'Extra spicy': 'SPICY_HEAT',
  'Mutual favor': 'SPICY_HEAT',
  'Tied-up fun': 'SPICY_HEAT',
  'Cold tricks': 'SPICY_HEAT',
  'Taking the lead': 'SPICY_HEAT',
  'Tongue work': 'SPICY_HEAT',
  'Backdoor': 'SPICY_HEAT',
  'Hands-on': 'SPICY_HEAT',
  'Side-by-side': 'SPICY_HEAT',
  'Backside': 'SPICY_HEAT',
  'Disco Stick': 'SPICY_HEAT',
  'Grand finale': 'SPICY_HEAT',
  'Visual inspiration': 'SPICY_HEAT',
  'Upper assets': 'SPICY_HEAT',
  'Extra help': 'SPICY_HEAT',
  'Steamy': 'SPICY_HEAT',
  'Lips at work': 'SPICY_HEAT',

  // LOCATION_HOME
  'Bedroom': 'LOCATION_HOME',
  'Couch time': 'LOCATION_HOME',
  'Shower session': 'LOCATION_HOME',
  'Bath time': 'LOCATION_HOME',
  'Laundry break': 'LOCATION_HOME',
  'Kitchen counter': 'LOCATION_HOME',
  'Chair situation': 'LOCATION_HOME',

  // LOCATION_AWAY
  'Hotel mode': 'LOCATION_AWAY',
  'Away from home': 'LOCATION_AWAY',
  'Tent adventures': 'LOCATION_AWAY',
  'Beachside': 'LOCATION_AWAY',
  'On the water': 'LOCATION_AWAY',
  'Mile-high mood': 'LOCATION_AWAY',
  'Train ride': 'LOCATION_AWAY',
  'Backseat energy': 'LOCATION_AWAY',
  'On the move': 'LOCATION_AWAY',
  'Sauna rules': 'LOCATION_AWAY',
  'Poolside': 'LOCATION_AWAY',
  'Risky location': 'LOCATION_AWAY',
  'Out in the wild': 'LOCATION_AWAY',

  // COUNTRIES
  'France': 'LOCATION_AWAY',
  'Spain': 'LOCATION_AWAY',
  'Italy': 'LOCATION_AWAY',
  'Greece': 'LOCATION_AWAY',
  'Portugal': 'LOCATION_AWAY',
  'United Kingdom': 'LOCATION_AWAY',
  'Germany': 'LOCATION_AWAY',
  'Netherlands': 'LOCATION_AWAY',
  'United States': 'LOCATION_AWAY',
  'Thailand': 'LOCATION_AWAY',
  'Mexico': 'LOCATION_AWAY',
  'Japan': 'LOCATION_AWAY',
  'Australia': 'LOCATION_AWAY',
  'Croatia': 'LOCATION_AWAY',

  // META_CAPTURE
  'Captured': 'META_CAPTURE',
  'Snapshot': 'META_CAPTURE',
};

/**
 * Get the label for an emoji
 * @param emoji The emoji character
 * @returns The label, or 'Unknown' if not found
 */
export function getEmojiLabel(emoji: string): string {
  return EMOJI_LABEL_MAP[emoji] || 'Unknown';
}

/**
 * Get the category for an emoji
 * @param emoji The emoji character
 * @returns The category
 */
export function getEmojiCategory(emoji: string): EmojiCategory {
  const label = EMOJI_LABEL_MAP[emoji];
  if (!label) return 'UNKNOWN';
  return LABEL_CATEGORY_MAP[label] || 'UNKNOWN';
}

/**
 * Get the category for a label
 * @param label The label string
 * @returns The category
 */
export function getLabelCategory(label: string): EmojiCategory {
  return LABEL_CATEGORY_MAP[label] || 'UNKNOWN';
}

/**
 * Get all emoji presets for the selector UI
 * Returns array of { emoji, label } objects
 */
export function getEmojiPresets(): Array<{ emoji: string; label: string }> {
  // Return in display order (same as old EmojiSelector)
  const displayOrder = [
    '🍑', '🍆', '💋', '💥', '👅', '🍩', '👉', '✂️', '♋️', '🏇',
    '💃', '🔥', '💦', '🌶️', '🍦', '🌽', '🍒', '🍌', '🥕', '🥵',
    '😈', '👄', '💕', '✨', '🎀', '🧊', '🕯️', '🌹', '💎', '🎭',
    '🦋', '⛓️', '🛏️', '🛋️', '🧺', '🚿', '🛁', '🪑', '🍽️', '🌳',
    '🏖️', '🏕️', '🏩', '🚻', '🧖', '👙', '🗺️', '🚗', '🚌', '🚂',
    '✈️', '🛥️', '🎥', '📸',
    '🇫🇷', '🇪🇸', '🇮🇹', '🇬🇷', '🇵🇹', '🇬🇧', '🇩🇪', '🇳🇱',
    '🇺🇸', '🇹🇭', '🇲🇽', '🇯🇵', '🇦🇺', '🇭🇷'
  ];
  
  return displayOrder.map(emoji => ({
    emoji,
    label: EMOJI_LABEL_MAP[emoji] || 'Unknown'
  }));
}

// For testing exports
export const _testing = {
  LABEL_CATEGORY_MAP,
};
