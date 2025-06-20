// Predefined themes that AI must choose from - ensures consistency across all cards
export const PREDEFINED_THEMES = [
  // Strategy Archetypes
  'Aggro',
  'Control',
  'Midrange',
  'Combo',
  'Tempo',
  'Prison',
  'Stax',
  'Burn',
  'Mill',
  'Reanimator',
  'Ramp',
  'Storm',
  'Voltron',
  'Pillow Fort',
  'Group Hug',
  'Chaos',
  
  // Mechanical Themes
  'Artifacts',
  'Enchantments',
  'Graveyard',
  'Counters',
  'Tokens',
  'Sacrifice',
  'Lifegain',
  'Card Draw',
  'Removal',
  'Board Wipes',
  'Ramp',
  'Mana Fixing',
  'Protection',
  'Recursion',
  'Tutors',
  'Extra Turns',
  'Land Destruction',
  'Resource Denial',
  'Steal Effects',
  'Copying',
  
  // Creature Themes
  'Tribal',
  'Flying',
  'Trample',
  'Haste',
  'Vigilance',
  'First Strike',
  'Double Strike',
  'Deathtouch',
  'Lifelink',
  'Reach',
  'Hexproof',
  'Shroud',
  'Indestructible',
  'Menace',
  'Evasion',
  'Big Creatures',
  'Small Creatures',
  'Token Generation',
  'Creature Tutors',
  'Creature Recursion',
  
  // Value Engines
  'Card Advantage',
  'Mana Advantage',
  'Board Advantage',
  'Incremental Advantage',
  'Engine Pieces',
  'Synergy Pieces',
  'Build Around',
  'Payoffs',
  'Enablers',
  
  // Specific Mechanics
  'Cycling',
  'Flashback',
  'Madness',
  'Threshold',
  'Delve',
  'Convoke',
  'Affinity',
  'Storm',
  'Cascade',
  'Suspend',
  'Echo',
  'Kicker',
  'Morph',
  'Flashback',
  'Dredge',
  'Persist',
  'Undying',
  'Proliferate',
  'Energy',
  'Experience',
  'Planeswalkers',
  
  // Color Identity Themes
  'Multicolor',
  'Color Fixing',
  'Devotion',
  'Color Matters',
  'Hybrid Mana',
  'Colorless',
  
  // Format Specific
  'EDH Staple',
  'Political',
  'Multiplayer',
  'Commander Synergy',
  'High CMC',
  'Low CMC',
  'Mana Curve',
  
  // Utility
  'Utility Land',
  'Mana Rock',
  'Win Condition',
  'Hate Piece',
  'Meta Call',
  'Sideboard',
  'Tech Card',
  'Format Staple'
] as const;

export type PredefinedTheme = typeof PREDEFINED_THEMES[number];

// Helper function to find closest matching theme
export function findClosestTheme(aiTheme: string): PredefinedTheme | null {
  const normalized = aiTheme.toLowerCase().trim();
  
  // Direct matches first
  for (const theme of PREDEFINED_THEMES) {
    if (theme.toLowerCase() === normalized) {
      return theme;
    }
  }
  
  // Partial matches
  for (const theme of PREDEFINED_THEMES) {
    if (normalized.includes(theme.toLowerCase()) || theme.toLowerCase().includes(normalized)) {
      return theme;
    }
  }
  
  // Common mappings
  const mappings: Record<string, PredefinedTheme> = {
    'aristocrats': 'Sacrifice',
    'lifegain': 'Lifegain',
    'draw': 'Card Draw',
    'ramp': 'Ramp',
    'token': 'Tokens',
    'graveyard': 'Graveyard',
    'artifact': 'Artifacts',
    'enchantment': 'Enchantments',
    'removal': 'Removal',
    'counter': 'Counters',
    'tribal': 'Tribal',
    'flying': 'Flying',
    'value': 'Card Advantage',
    'engine': 'Engine Pieces',
    'combo': 'Combo',
    'control': 'Control',
    'aggro': 'Aggro',
    'midrange': 'Midrange',
    'tempo': 'Tempo'
  };
  
  for (const [key, theme] of Object.entries(mappings)) {
    if (normalized.includes(key)) {
      return theme;
    }
  }
  
  return null;
}