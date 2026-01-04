/**
 * Authoritative emoji → label mapping for fiftytwoormore edge functions
 * 
 * This is the single source of truth for all emoji labels used in emails.
 * Must be kept in sync with src/lib/emojiLabels.ts
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
};

// Emoji category mapping
export const EMOJI_CATEGORY_MAP: Record<string, string> = {
  // SPICY_HEAT
  '🍑': 'SPICY_HEAT', '🍆': 'SPICY_HEAT', '🍌': 'SPICY_HEAT', '👄': 'SPICY_HEAT', '👅': 'SPICY_HEAT',
  '🍩': 'SPICY_HEAT', '👉': 'SPICY_HEAT', '✂️': 'SPICY_HEAT', '♋️': 'SPICY_HEAT', '🏇': 'SPICY_HEAT',
  '💦': 'SPICY_HEAT', '🔥': 'SPICY_HEAT', '🌶️': 'SPICY_HEAT', '🥕': 'SPICY_HEAT', '⛓️': 'SPICY_HEAT',
  '🧊': 'SPICY_HEAT', '🌽': 'SPICY_HEAT', '🍒': 'SPICY_HEAT',
  // ROMANTIC_SOFT
  '💋': 'ROMANTIC_SOFT', '💕': 'ROMANTIC_SOFT', '✨': 'ROMANTIC_SOFT', '🌹': 'ROMANTIC_SOFT',
  '💎': 'ROMANTIC_SOFT', '🕯️': 'ROMANTIC_SOFT', '🎀': 'ROMANTIC_SOFT', '🍦': 'ROMANTIC_SOFT',
  // PLAYFUL_TEASE
  '😈': 'PLAYFUL_TEASE', '🦋': 'PLAYFUL_TEASE', '💃': 'PLAYFUL_TEASE', '🎭': 'PLAYFUL_TEASE',
  '🥵': 'PLAYFUL_TEASE', '💥': 'PLAYFUL_TEASE',
  // LOCATION_HOME
  '🛏️': 'LOCATION_HOME', '🛋️': 'LOCATION_HOME', '🧺': 'LOCATION_HOME', '🚿': 'LOCATION_HOME',
  '🛁': 'LOCATION_HOME', '🪑': 'LOCATION_HOME', '🍽️': 'LOCATION_HOME',
  // LOCATION_AWAY
  '🌳': 'LOCATION_AWAY', '🏖️': 'LOCATION_AWAY', '🏕️': 'LOCATION_AWAY', '🏩': 'LOCATION_AWAY',
  '🚻': 'LOCATION_AWAY', '🧖': 'LOCATION_AWAY', '👙': 'LOCATION_AWAY', '🗺️': 'LOCATION_AWAY',
  '🚗': 'LOCATION_AWAY', '🚌': 'LOCATION_AWAY', '🚂': 'LOCATION_AWAY', '✈️': 'LOCATION_AWAY', '🛥️': 'LOCATION_AWAY',
  // META_CAPTURE
  '🎥': 'META_CAPTURE', '📸': 'META_CAPTURE',
};

/**
 * Get the label for an emoji
 */
export function getEmojiLabel(emoji: string): string {
  return EMOJI_LABEL_MAP[emoji] || 'Unknown';
}

/**
 * Get the category for an emoji
 */
export function getEmojiCategory(emoji: string): string {
  return EMOJI_CATEGORY_MAP[emoji] || 'UNKNOWN';
}
