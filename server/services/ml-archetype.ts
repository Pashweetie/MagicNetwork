import { Card } from "@shared/schema";
import { db } from "../db";
import { cardCache, userInteractions, cardRecommendations } from "@shared/schema";
import { sql } from "drizzle-orm";

// Define known MTG archetypes with their characteristics
interface Archetype {
  name: string;
  keyCards: string[];
  keywordWeights: { [keyword: string]: number };
  typeWeights: { [type: string]: number };
  manaCurvePreference: number[]; // CMC 0-7+ weights
  colorWeights: { [color: string]: number };
  strategies: string[];
}

const ARCHETYPES: Archetype[] = [
  {
    name: "Aggro",
    keyCards: ["lightning bolt", "monastery swiftspear", "goblin guide"],
    keywordWeights: {
      "haste": 0.9,
      "first strike": 0.7,
      "double strike": 0.8,
      "prowess": 0.8,
      "deals damage": 0.6,
      "direct damage": 0.7
    },
    typeWeights: {
      "creature": 0.8,
      "instant": 0.6,
      "sorcery": 0.4
    },
    manaCurvePreference: [0.7, 0.9, 0.8, 0.5, 0.2, 0.1, 0.0, 0.0],
    colorWeights: { "R": 0.9, "W": 0.7, "B": 0.5, "G": 0.6, "U": 0.3 },
    strategies: ["fast clock", "burn", "weenie", "tempo"]
  },
  {
    name: "Control",
    keyCards: ["counterspell", "wrath of god", "teferi"],
    keywordWeights: {
      "counter": 0.9,
      "destroy all": 0.8,
      "draw a card": 0.7,
      "exile": 0.6,
      "flash": 0.5
    },
    typeWeights: {
      "instant": 0.9,
      "sorcery": 0.7,
      "planeswalker": 0.6,
      "enchantment": 0.5
    },
    manaCurvePreference: [0.3, 0.4, 0.6, 0.8, 0.9, 0.7, 0.5, 0.3],
    colorWeights: { "U": 0.9, "W": 0.8, "B": 0.6, "R": 0.3, "G": 0.2 },
    strategies: ["card advantage", "board control", "late game", "answers"]
  },
  {
    name: "Midrange",
    keyCards: ["tarmogoyf", "lightning bolt", "thoughtseize"],
    keywordWeights: {
      "enters the battlefield": 0.7,
      "versatile": 0.8,
      "removal": 0.6,
      "card advantage": 0.5
    },
    typeWeights: {
      "creature": 0.7,
      "instant": 0.6,
      "sorcery": 0.5,
      "planeswalker": 0.4
    },
    manaCurvePreference: [0.4, 0.6, 0.8, 0.9, 0.7, 0.4, 0.2, 0.1],
    colorWeights: { "B": 0.8, "G": 0.8, "R": 0.7, "W": 0.6, "U": 0.5 },
    strategies: ["value", "flexible", "threats and answers", "versatile"]
  },
  {
    name: "Combo",
    keyCards: ["storm", "exhume", "show and tell"],
    keywordWeights: {
      "storm": 0.9,
      "without paying": 0.8,
      "infinite": 0.9,
      "untap": 0.7,
      "cascade": 0.6
    },
    typeWeights: {
      "instant": 0.7,
      "sorcery": 0.8,
      "artifact": 0.6,
      "enchantment": 0.5
    },
    manaCurvePreference: [0.8, 0.7, 0.6, 0.4, 0.3, 0.2, 0.1, 0.9], // High 0 and 7+ for combo pieces
    colorWeights: { "U": 0.7, "R": 0.6, "B": 0.6, "G": 0.4, "W": 0.3 },
    strategies: ["fast mana", "tutors", "protection", "engine"]
  },
  {
    name: "Ramp",
    keyCards: ["cultivate", "sol ring", "llanowar elves"],
    keywordWeights: {
      "add mana": 0.9,
      "search.*land": 0.8,
      "ramp": 0.9,
      "big threats": 0.7
    },
    typeWeights: {
      "creature": 0.6,
      "sorcery": 0.8,
      "artifact": 0.7,
      "enchantment": 0.5
    },
    manaCurvePreference: [0.5, 0.8, 0.7, 0.5, 0.4, 0.3, 0.6, 0.8], // Early ramp, late threats
    colorWeights: { "G": 0.9, "U": 0.4, "W": 0.3, "B": 0.3, "R": 0.4 },
    strategies: ["acceleration", "big spells", "mana fixing", "late game"]
  },
  {
    name: "Tribal",
    keyCards: ["lord of atlantis", "goblin king", "elvish champion"],
    keywordWeights: {
      "tribal": 0.9,
      "creature type": 0.8,
      "lord": 0.8,
      "anthem": 0.7
    },
    typeWeights: {
      "creature": 0.9,
      "tribal": 0.9,
      "instant": 0.4,
      "sorcery": 0.4
    },
    manaCurvePreference: [0.6, 0.8, 0.9, 0.7, 0.5, 0.3, 0.1, 0.0],
    colorWeights: { "W": 0.7, "G": 0.8, "R": 0.7, "B": 0.6, "U": 0.6 },
    strategies: ["synergy", "creature based", "lords", "tribal support"]
  }
];

export class MLArchetypePredictor {
  
  // Analyze a card's compatibility with each archetype
  async predictArchetypeCompatibility(card: Card): Promise<{ [archetype: string]: number }> {
    const scores: { [archetype: string]: number } = {};
    
    for (const archetype of ARCHETYPES) {
      scores[archetype.name] = this.calculateArchetypeScore(card, archetype);
    }
    
    return scores;
  }
  
  // Calculate how well a deck of cards fits an archetype
  async predictDeckArchetype(cards: Card[]): Promise<{ archetype: string, confidence: number, reasoning: string[] }[]> {
    const archetypeScores: { [name: string]: { total: number, reasons: string[] } } = {};
    
    // Initialize scores
    for (const archetype of ARCHETYPES) {
      archetypeScores[archetype.name] = { total: 0, reasons: [] };
    }
    
    // Analyze each card
    for (const card of cards) {
      const cardScores = await this.predictArchetypeCompatibility(card);
      
      for (const [archetypeName, score] of Object.entries(cardScores)) {
        archetypeScores[archetypeName].total += score;
        
        if (score > 0.6) {
          archetypeScores[archetypeName].reasons.push(
            `${card.name} fits ${archetypeName.toLowerCase()} strategy (${Math.round(score * 100)}%)`
          );
        }
      }
    }
    
    // Normalize scores and create results
    const results = Object.entries(archetypeScores)
      .map(([name, data]) => ({
        archetype: name,
        confidence: Math.min(data.total / cards.length, 1.0),
        reasoning: data.reasons.slice(0, 5) // Top 5 reasons
      }))
      .sort((a, b) => b.confidence - a.confidence);
    
    return results;
  }
  
  // Suggest cards that would improve archetype fit
  async suggestCardsForArchetype(currentDeck: Card[], targetArchetype: string): Promise<Card[]> {
    const archetype = ARCHETYPES.find(a => a.name === targetArchetype);
    if (!archetype) return [];
    
    // Get cards from cache that score highly for this archetype
    const candidateCards = await db
      .select()
      .from(cardCache)
      .limit(500);
    
    const suggestions: { card: Card, score: number }[] = [];
    
    for (const cached of candidateCards) {
      const card = cached.cardData;
      
      // Skip cards already in deck
      if (currentDeck.some(deckCard => deckCard.id === card.id)) continue;
      
      const score = this.calculateArchetypeScore(card, archetype);
      if (score > 0.7) {
        suggestions.push({ card, score });
      }
    }
    
    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map(s => s.card);
  }
  
  // Train the model using existing user interaction data
  async trainFromUserData(): Promise<void> {
    try {
      // Analyze user deck building patterns
      const interactions = await db
        .select()
        .from(userInteractions)
        .where(sql`interaction_type = 'deck_add'`)
        .limit(1000);
      
      // Group interactions by user to identify deck patterns
      const userDecks: { [userId: number]: string[] } = {};
      
      for (const interaction of interactions) {
        if (!userDecks[interaction.userId]) {
          userDecks[interaction.userId] = [];
        }
        userDecks[interaction.userId].push(interaction.cardId);
      }
      
      // Analyze successful card combinations
      for (const [userId, cardIds] of Object.entries(userDecks)) {
        if (cardIds.length >= 5) { // Minimum deck size for analysis
          const cards = await this.getCardsById(cardIds);
          const archetypeAnalysis = await this.predictDeckArchetype(cards);
          
          // Update archetype weights based on successful combinations
          this.updateWeightsFromDeckAnalysis(cards, archetypeAnalysis);
        }
      }
      
      console.log('ML model training completed from user data');
    } catch (error) {
      console.error('Error training ML model:', error);
    }
  }
  
  private calculateArchetypeScore(card: Card, archetype: Archetype): number {
    let score = 0;
    const factors: string[] = [];
    
    const cardText = (card.oracle_text || '').toLowerCase();
    const cardName = card.name.toLowerCase();
    const typeLine = card.type_line.toLowerCase();
    
    // Keyword matching
    for (const [keyword, weight] of Object.entries(archetype.keywordWeights)) {
      if (cardText.includes(keyword) || cardName.includes(keyword)) {
        score += weight * 0.3;
        factors.push(`keyword: ${keyword}`);
      }
    }
    
    // Type matching
    for (const [type, weight] of Object.entries(archetype.typeWeights)) {
      if (typeLine.includes(type)) {
        score += weight * 0.25;
        factors.push(`type: ${type}`);
      }
    }
    
    // Mana curve analysis
    const cmc = Math.min(card.cmc, 7);
    const manaCurveScore = archetype.manaCurvePreference[cmc] || 0;
    score += manaCurveScore * 0.2;
    
    // Color identity matching
    const colors = card.color_identity || [];
    let colorScore = 0;
    for (const color of colors) {
      colorScore += archetype.colorWeights[color] || 0;
    }
    if (colors.length > 0) {
      score += (colorScore / colors.length) * 0.15;
    }
    
    // Key card bonus
    for (const keyCard of archetype.keyCards) {
      if (cardName.includes(keyCard.toLowerCase())) {
        score += 0.4;
        factors.push(`key card: ${keyCard}`);
      }
    }
    
    // Strategy matching
    for (const strategy of archetype.strategies) {
      if (cardText.includes(strategy) || cardName.includes(strategy)) {
        score += 0.1;
        factors.push(`strategy: ${strategy}`);
      }
    }
    
    return Math.min(score, 1.0);
  }
  
  private async getCardsById(cardIds: string[]): Promise<Card[]> {
    const cards: Card[] = [];
    
    for (const id of cardIds) {
      const cached = await db
        .select()
        .from(cardCache)
        .where(sql`id = ${id}`)
        .limit(1);
      
      if (cached.length > 0) {
        cards.push(cached[0].cardData);
      }
    }
    
    return cards;
  }
  
  private updateWeightsFromDeckAnalysis(cards: Card[], analysis: any[]): void {
    // Simple weight adjustment based on successful deck patterns
    // In a real ML system, this would use gradient descent or similar
    
    const topArchetype = analysis[0];
    if (topArchetype && topArchetype.confidence > 0.7) {
      const archetype = ARCHETYPES.find(a => a.name === topArchetype.archetype);
      if (archetype) {
        // Slightly increase weights for patterns found in successful decks
        for (const card of cards) {
          const cardText = (card.oracle_text || '').toLowerCase();
          
          // Find keywords that appeared and boost their weights slightly
          for (const keyword of Object.keys(archetype.keywordWeights)) {
            if (cardText.includes(keyword)) {
              archetype.keywordWeights[keyword] = Math.min(
                archetype.keywordWeights[keyword] * 1.01,
                1.0
              );
            }
          }
        }
      }
    }
  }
}

export const mlArchetypePredictor = new MLArchetypePredictor();