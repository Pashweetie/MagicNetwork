import { storage } from "../storage";
import { Card } from "@shared/schema";
import { db } from "../db";
import { cardCache } from "@shared/schema";
import { desc, sql } from "drizzle-orm";

export class RecommendationService {
  
  // Generate recommendations for a specific card
  async generateCardRecommendations(cardId: string): Promise<void> {
    await storage.generateRecommendationsForCard(cardId);
  }

  // Get recommendations for a card
  async getCardRecommendations(cardId: string, limit: number = 10) {
    const recommendations = await storage.getCardRecommendations(cardId, limit);
    
    // Get the actual card data for each recommendation
    const cardData = await Promise.all(
      recommendations.map(async (rec) => {
        const card = await storage.getCachedCard(rec.recommendedCardId);
        return {
          card,
          score: rec.score,
          reason: rec.reason
        };
      })
    );
    
    return cardData.filter(item => item.card !== null);
  }

  // Get personalized recommendations for a user
  async getPersonalizedRecommendations(userId: number, limit: number = 20): Promise<Card[]> {
    return await storage.getPersonalizedRecommendations(userId, limit);
  }

  // Track user interaction for recommendation learning
  async trackUserInteraction(userId: number, cardId: string, interactionType: string, metadata?: any): Promise<void> {
    await storage.recordUserInteraction({
      userId,
      cardId,
      interactionType,
      metadata
    });

    // Generate recommendations for this card if we haven't already
    const existingRecs = await storage.getCardRecommendations(cardId, 1);
    if (existingRecs.length === 0) {
      console.log(`Generating recommendations for card: ${cardId}`);
      await this.generateCardRecommendations(cardId);
    }
  }

  // Batch generate recommendations for popular cards
  async generateRecommendationsForPopularCards(limit: number = 50): Promise<void> {
    console.log('Generating recommendations for popular cards...');
    
    // Get most searched cards
    const popularCards = await db
      .select({ id: cardCache.id })
      .from(cardCache)
      .orderBy(desc(cardCache.searchCount))
      .limit(limit);

    for (const card of popularCards) {
      const existingRecs = await storage.getCardRecommendations(card.id, 1);
      if (existingRecs.length === 0) {
        console.log(`Generating recommendations for popular card: ${card.id}`);
        await this.generateCardRecommendations(card.id);
        
        // Add small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log('Finished generating recommendations for popular cards');
  }

  // AI-powered theme suggestions
  async getThemeSuggestions(cardId: string): Promise<Array<{theme: string, description: string, cards: Card[]}>> {
    try {
      const sourceCard = await storage.getCachedCard(cardId);
      if (!sourceCard) {
        throw new Error('Card not found');
      }

      // Analyze card for thematic elements
      const themes = await this.analyzeCardThemes(sourceCard);
      
      // For each theme, find matching cards
      const themeGroups = [];
      for (const theme of themes) {
        const matchingCards = await this.findCardsForTheme(theme, sourceCard);
        if (matchingCards.length > 0) {
          themeGroups.push({
            theme: theme.name,
            description: theme.description,
            cards: matchingCards.slice(0, 8) // Limit to 8 cards per theme
          });
        }
      }

      return themeGroups;
    } catch (error) {
      console.error('Error getting theme suggestions:', error);
      return [];
    }
  }

  private async analyzeCardThemes(card: Card): Promise<Array<{name: string, description: string, keywords: string[]}>> {
    const themes: Array<{name: string, description: string, keywords: string[]}> = [];
    
    const cardText = (card.oracle_text || '').toLowerCase();
    const typeLine = card.type_line.toLowerCase();
    const cardName = card.name.toLowerCase();

    // Death & Taxes theme detection
    if (
      cardText.includes('tax') || 
      cardText.includes('enters the battlefield') && (cardText.includes('opponent') || cardText.includes('each player')) ||
      cardText.includes('artifact') && cardText.includes('cost') ||
      cardName.includes('thalia') || cardName.includes('leonin arbiter') ||
      cardText.includes('additional cost') || cardText.includes('pay') && cardText.includes('more')
    ) {
      themes.push({
        name: 'Death & Taxes',
        description: 'White weenie strategy that disrupts opponents with tax effects and efficient creatures.',
        keywords: ['tax', 'additional cost', 'enters the battlefield', 'artifact cost', 'creature cost', 'spell cost']
      });
    }

    // Stax theme detection
    if (
      cardText.includes('sacrifice') && (cardText.includes('each') || cardText.includes('all')) ||
      cardText.includes("can't") && (cardText.includes('cast') || cardText.includes('play') || cardText.includes('activate')) ||
      cardText.includes('winter orb') || cardText.includes('tangle wire') || cardText.includes('smokestack') ||
      cardText.includes('upkeep') && cardText.includes('sacrifice') ||
      cardText.includes('lock') || (typeLine.includes('artifact') && cardText.includes('tap'))
    ) {
      themes.push({
        name: 'Stax',
        description: 'Prison strategy focused on resource denial and symmetrical effects that hurt opponents more.',
        keywords: ['sacrifice', 'upkeep', 'can\'t cast', 'can\'t play', 'tap', 'don\'t untap', 'prison']
      });
    }

    // Combo Engine theme detection
    if (
      cardText.includes('infinite') ||
      cardText.includes('untap') && (cardText.includes('all') || cardText.includes('target')) ||
      cardText.includes('exile') && cardText.includes('cast') && cardText.includes('without paying') ||
      cardText.includes('storm') || cardText.includes('cascade') ||
      (cardText.includes('draw') && cardText.includes('card')) && cardText.includes('whenever') ||
      cardText.includes('enters the battlefield') && cardText.includes('search')
    ) {
      themes.push({
        name: 'Combo Engine',
        description: 'Cards that enable powerful synergies and game-winning combinations.',
        keywords: ['untap', 'storm', 'cascade', 'without paying', 'search', 'tutor', 'infinite', 'combo']
      });
    }

    // Aristocrats theme detection
    if (
      cardText.includes('sacrifice') && cardText.includes('creature') ||
      cardText.includes('whenever') && cardText.includes('dies') ||
      cardText.includes('death trigger') || cardText.includes('leaves the battlefield') ||
      cardName.includes('blood artist') || cardName.includes('zulaport cutthroat') ||
      cardText.includes('token') && cardText.includes('sacrifice')
    ) {
      themes.push({
        name: 'Aristocrats',
        description: 'Sacrifice-based strategy that gains value from creatures dying and entering the battlefield.',
        keywords: ['sacrifice', 'dies', 'death trigger', 'token', 'enters the battlefield', 'leaves the battlefield']
      });
    }

    // Ramp theme detection
    if (
      cardText.includes('search') && cardText.includes('land') ||
      cardText.includes('add') && (cardText.includes('mana') || cardText.match(/\{[WUBRG]\}/)) ||
      typeLine.includes('artifact') && cardText.includes('tap') && cardText.includes('add') ||
      cardText.includes('ramp') || cardText.includes('accelerate') ||
      cardName.includes('cultivate') || cardName.includes('kodama')
    ) {
      themes.push({
        name: 'Ramp',
        description: 'Mana acceleration strategy to cast expensive spells ahead of curve.',
        keywords: ['search', 'land', 'add mana', 'mana dork', 'accelerate', 'ramp']
      });
    }

    // Control theme detection
    if (
      cardText.includes('counter') && cardText.includes('spell') ||
      cardText.includes('destroy') && (cardText.includes('target') || cardText.includes('all')) ||
      cardText.includes('return') && cardText.includes('hand') ||
      cardText.includes('draw') && cardText.includes('card') ||
      typeLine.includes('instant') && (cardText.includes('counter') || cardText.includes('destroy'))
    ) {
      themes.push({
        name: 'Control',
        description: 'Reactive strategy using counterspells, removal, and card draw to control the game.',
        keywords: ['counter', 'destroy', 'return', 'draw', 'instant', 'control', 'removal']
      });
    }

    return themes;
  }

  private async findCardsForTheme(theme: {name: string, description: string, keywords: string[]}, sourceCard: Card): Promise<Card[]> {
    try {
      // Get a larger sample of cards to analyze
      const allCards = await db
        .select()
        .from(cardCache)
        .where(sql`card_data->>'id' != ${sourceCard.id}`)
        .limit(500);

      const matchingCards: Array<{card: Card, score: number}> = [];

      for (const cached of allCards) {
        const card = cached.cardData;
        let score = 0;
        
        const cardText = (card.oracle_text || '').toLowerCase();
        const typeLine = card.type_line.toLowerCase();
        const cardName = card.name.toLowerCase();

        // Score based on keyword matches
        for (const keyword of theme.keywords) {
          if (cardText.includes(keyword) || cardName.includes(keyword) || typeLine.includes(keyword)) {
            score += 10;
          }
        }

        // Bonus for exact theme matches
        const themeLower = theme.name.toLowerCase();
        if (themeLower === 'death & taxes') {
          if (card.colors?.includes('W') || !card.colors?.length) score += 5;
          if (cardText.includes('thalia') || cardText.includes('leonin arbiter')) score += 20;
          if (cardText.includes('tax') || cardText.includes('additional cost')) score += 15;
        } else if (themeLower === 'stax') {
          if (typeLine.includes('artifact')) score += 5;
          if (cardText.includes('winter orb') || cardText.includes('smokestack')) score += 25;
          if (cardText.includes('upkeep') && cardText.includes('sacrifice')) score += 15;
        } else if (themeLower === 'combo engine') {
          if (cardText.includes('storm') || cardText.includes('cascade')) score += 20;
          if (cardText.includes('infinite') || cardText.includes('without paying')) score += 15;
        } else if (themeLower === 'aristocrats') {
          if (card.colors?.includes('B') || card.colors?.includes('W')) score += 5;
          if (cardText.includes('blood artist') || cardText.includes('zulaport')) score += 25;
          if (cardText.includes('sacrifice') && cardText.includes('creature')) score += 15;
        } else if (themeLower === 'ramp') {
          if (card.colors?.includes('G')) score += 5;
          if (cardText.includes('cultivate') || cardText.includes('rampant growth')) score += 20;
          if (typeLine.includes('creature') && cardText.includes('add')) score += 10;
        } else if (themeLower === 'control') {
          if (card.colors?.includes('U') || card.colors?.includes('W')) score += 5;
          if (typeLine.includes('instant') && cardText.includes('counter')) score += 15;
          if (cardText.includes('counterspell') || cardText.includes('wrath')) score += 20;
        }

        // Color identity compatibility
        const sourceColors = sourceCard.color_identity || [];
        const cardColors = card.color_identity || [];
        const colorOverlap = sourceColors.filter(c => cardColors.includes(c)).length;
        if (colorOverlap > 0) score += colorOverlap * 3;

        if (score >= 15) { // Minimum threshold for theme inclusion
          matchingCards.push({ card, score });
        }
      }

      return matchingCards
        .sort((a, b) => b.score - a.score)
        .slice(0, 12)
        .map(item => item.card);
    } catch (error) {
      console.error('Error finding cards for theme:', error);
      return [];
    }
  }
}

export const recommendationService = new RecommendationService();