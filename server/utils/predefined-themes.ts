// Comprehensive list of Magic: The Gathering strategic themes
// AI must choose only from these predefined categories

export const PREDEFINED_THEMES = [
  // Core Strategies
  "Aggro",
  "Control",
  "Midrange",
  "Combo",
  "Tempo",
  "Prison",
  "Stax",
  "Hatebears",
  "Burn",
  "Mill",

  // Resource Management
  "Card Advantage",
  "Ramp",
  "Mana Dorks",
  "Land Destruction",
  "Resource Denial",
  "Hand Disruption",
  "Draw Engines",
  "Cantrips",
  "Card Selection",
  "Tutoring",

  // Creature Strategies
  "Tribal",
  "Go-Wide",
  "Tokens",
  "Aristocrats",
  "Sacrifice Synergy",
  "Reanimator",
  "Graveyard Value",
  "Graveyard Hate",
  "Voltron",
  "Big Creatures",
  "Creature Cheating",
  "ETB Value",
  "LTB Value",
  "Blink/Flicker",

  // Combat & Damage
  "Combat Tricks",
  "Pump Spells",
  "Evasion",
  "Double Strike",
  "Trample",
  "Flying Matters",
  "Unblockable",
  "Direct Damage",
  "Lifegain",
  "Lifelink Matters",
  "Lifegain Matters",
  "Drain Strategy",

  // Spell-Based
  "Spellslinger",
  "Storm",
  "Cascade",
  "Cascade/Cheating",
  "Cost Reduction",
  "X-Spells",
  "Instant Speed",
  "Flash",
  "Counterspells",
  "Removal",
  "Board Wipes",
  "Spot Removal",

  // Artifact & Equipment
  "Artifacts Matter",
  "Equipment",
  "Equipment Voltron",
  "Artifact Ramp",
  "Artifact Combo",
  "Metalcraft",
  "Affinity",
  "Modular",

  // Enchantment
  "Enchantments Matter",
  "Auras",
  "Aura Voltron",
  "Enchantress",
  "Constellation",
  "Curse Strategy",

  // Land Strategies
  "Landfall",
  "Lands Matter",
  "Land Ramp",
  "Land Sacrifice",
  "Utility Lands",
  "Multicolor Fixing",

  // Graveyard
  "Graveyard Recursion",
  "Self-Mill",
  "Dredge",
  "Delve",
  "Flashback",
  "Threshold",
  "Delirium",
  "Escape",

  // Counter Strategies
  "+1/+1 Counters",
  "Proliferate",
  "Counter Manipulation",
  "Planeswalker Support",
  "Energy",
  "Experience Counters",

  // Timing & Phases
  "End Step Matters",
  "Upkeep Triggers",
  "Beginning of Combat",
  "Extra Turns",
  "Extra Combat",
  "Instant Speed Value",

  // Protection & Resilience
  "Protection",
  "Hexproof/Shroud",
  "Indestructible",
  "Regeneration",
  "Bounce Effects",
  "Phasing",
  "Ward",

  // Specific Mechanics
  "Cycling",
  "Madness",
  "Morph",
  "Suspend",
  "Split Second",
  "Kicker",
  "Overload",
  "Convoke",
  "Delve",
  "Emerge",
  "Mutate",
  "Adventure",
  "Foretell",
  "Flashback",

  // Color-Specific
  "Mono-Color Devotion",
  "Color Matters",
  "Multicolor Synergy",
  "WUBRG Matters",
  "Color Hate",

  // Format Specific
  "Commander Specific",
  "Politics",
  "Group Hug",
  "Group Slug",
  "Pillow Fort",
  "Chaos",

  // Win Conditions
  "Alternative Win Cons",
  "Laboratory Maniac",
  "Approach of the Second Sun",
  "Felidar Sovereign",
  "Coalition Victory",
  "Maze's End",

  // Value Engines
  "Incremental Advantage",
  "Synergy Engines",
  "Value Creatures",
  "Utility Spells",
  "Flexible Answers",
  "Modal Spells",

  // Tribal Specific (Major Tribes)
  "Humans",
  "Elves", 
  "Goblins",
  "Merfolk",
  "Zombies",
  "Dragons",
  "Angels",
  "Demons",
  "Spirits",
  "Beasts",
  "Elementals",
  "Slivers",
  "Soldiers",
  "Warriors",
  "Wizards",
  "Knights",
  "Vampires",
  "Werewolves",
  "Pirates",
  "Dinosaurs",
  "Cats",
  "Dogs",
  "Birds",
  "Insects",

  // Interaction
  "Reactive Strategy",
  "Proactive Strategy",
  "Permission",
  "Disruption",
  "Symmetrical Effects",
  "Asymmetrical Advantage",
] as const;

export type PredefinedTheme = typeof PREDEFINED_THEMES[number];

// Helper function to validate if a theme is predefined
export function isValidTheme(theme: string): theme is PredefinedTheme {
  return PREDEFINED_THEMES.includes(theme as PredefinedTheme);
}

// Helper function to get closest matching theme (for AI fallback)
export function getClosestTheme(input: string): PredefinedTheme {
  const inputLower = input.toLowerCase();
  
  // Direct match
  const directMatch = PREDEFINED_THEMES.find(theme => 
    theme.toLowerCase() === inputLower
  );
  if (directMatch) return directMatch;
  
  // Partial match
  const partialMatch = PREDEFINED_THEMES.find(theme => 
    theme.toLowerCase().includes(inputLower) || 
    inputLower.includes(theme.toLowerCase())
  );
  if (partialMatch) return partialMatch;
  
  // Keyword matching
  const keywords: Record<string, PredefinedTheme[]> = {
    'creature': ['Tribal', 'Go-Wide', 'Big Creatures'],
    'spell': ['Spellslinger', 'Storm', 'Instant Speed'],
    'artifact': ['Artifacts Matter', 'Equipment', 'Artifact Ramp'],
    'graveyard': ['Graveyard Recursion', 'Reanimator', 'Self-Mill'],
    'counter': ['+1/+1 Counters', 'Proliferate', 'Counter Manipulation'],
    'life': ['Lifegain', 'Drain Strategy', 'Lifegain Matters'],
    'land': ['Landfall', 'Ramp', 'Lands Matter'],
    'draw': ['Card Advantage', 'Draw Engines', 'Cantrips'],
    'token': ['Tokens', 'Go-Wide', 'Aristocrats'],
    'damage': ['Burn', 'Direct Damage', 'Aggro'],
  };
  
  for (const [keyword, themes] of Object.entries(keywords)) {
    if (inputLower.includes(keyword)) {
      return themes[0];
    }
  }
  
  // Default fallback
  return 'Midrange';
}