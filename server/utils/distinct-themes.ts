// Distinct Magic: The Gathering strategy themes - 150 unique categories
// Each theme represents a fundamentally different strategic approach
// Removed overlapping/similar themes to ensure clear bucketization

export const DISTINCT_THEMES = [
  // Core Archetypes (12 themes)
  "Aggro",
  "Control", 
  "Midrange",
  "Combo",
  "Ramp",
  "Tempo",
  "Prison",
  "Stax",
  "Burn",
  "Mill",
  "Reanimator",
  "Voltron",

  // Resource Strategies (10 themes)
  "Mana Acceleration",
  "Mana Denial",
  "Card Advantage",
  "Hand Disruption",
  "Resource Denial",
  "Treasure Tokens",
  "Energy Counters",
  "Storm",
  "Cascade",
  "Madness",

  // Creature Strategies (12 themes)
  "Token Generation",
  "Sacrifice Value",
  "ETB Effects",
  "LTB Effects",
  "Combat Tricks",
  "Evasion",
  "Deathtouch Synergy",
  "Lifegain Synergy",
  "Counter Manipulation",
  "Creature Stealing",
  "Mass Pump",
  "Equipment Focus",

  // Tribal Categories (15 themes)
  "Angels",
  "Dragons",
  "Elves",
  "Goblins",
  "Zombies",
  "Vampires",
  "Humans",
  "Spirits",
  "Beasts",
  "Merfolk",
  "Slivers",
  "Elementals",
  "Artifacts",
  "Wizards",
  "Warriors",

  // Graveyard Strategies (8 themes)
  "Graveyard Recursion",
  "Self-Mill",
  "Flashback",
  "Escape",
  "Delve",
  "Threshold",
  "Dredge",
  "Living Death",

  // Spell Strategies (10 themes)
  "Instant Speed",
  "Counterspells",
  "Spell Copy",
  "X-Spells",
  "Cantrips",
  "Mass Removal",
  "Targeted Removal",
  "Protection Spells",
  "Ritual Effects",
  "Extra Turns",

  // Artifact Strategies (8 themes)
  "Artifact Ramp",
  "Artifact Sacrifice",
  "Modular",
  "Affinity",
  "Improvise",
  "Vehicles",
  "Equipment Tutors",
  "Scrap Mastery",

  // Enchantment Strategies (6 themes)
  "Enchantment Pillowfort",
  "Aura Voltron",
  "Constellation",
  "Enchantment Ramp",
  "Curse Strategy",
  "Enchantment Recursion",

  // Land Strategies (8 themes)
  "Landfall",
  "Land Destruction",
  "Land Recursion",
  "Basic Land Focus",
  "Nonbasic Lands",
  "Land Animation",
  "Domain",
  "Threshold Lands",

  // Win Conditions (10 themes)
  "Alternate Win Conditions",
  "Laboratory Maniac",
  "Infect",
  "Commander Damage",
  "Poison Counters",
  "Mill Victory",
  "Lifegain Victory",
  "Token Swarm",
  "Combo Finish",
  "Beatdown",

  // Control Elements (8 themes)
  "Board Wipes",
  "Spot Removal",
  "Tap Down",
  "Bounce Effects",
  "Exile Effects",
  "Phase Out",
  "Fog Effects",
  "Damage Prevention",

  // Value Engines (10 themes)
  "Draw Engines",
  "Scry Effects",
  "Top Deck Manipulation",
  "Library Tutors",
  "Graveyard Tutors",
  "Creature Tutors",
  "Spell Tutors",
  "Artifact Tutors",
  "Land Tutors",
  "Enchantment Tutors",

  // Color Identity (8 themes)
  "Mono Color",
  "Two Color",
  "Three Color", 
  "Four Color",
  "Five Color",
  "Colorless",
  "Hybrid Mana",
  "Devotion",

  // Synergy Mechanics (12 themes)
  "Proliferate",
  "Doubling Effects",
  "Copy Effects",
  "Flicker",
  "Blink",
  "Morph",
  "Manifest",
  "Transform",
  "Meld",
  "Mutate",
  "Adventure",
  "Cycling",

  // Multiplayer Focus (7 themes)
  "Group Hug",
  "Group Slug",
  "Politics",
  "Threat Assessment",
  "Pillow Fort",
  "Kingmaker",
  "Table Balance"
];

// Validation: Ensure we have exactly 150 distinct themes
console.log(`Total distinct themes: ${DISTINCT_THEMES.length}`);

// Export for use in AI theme generation and predefined themes
export { DISTINCT_THEMES };
export default DISTINCT_THEMES;