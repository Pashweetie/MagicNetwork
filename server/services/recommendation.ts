import { storage } from "../storage";
import { Card, cardThemes, InsertCardTheme } from "@shared/schema";
import { db } from "../db";
import { cardCache } from "@shared/schema";
import { desc, sql, eq } from "drizzle-orm";

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
        // Try to get card from Scryfall if not cached
        const freshCard = await storage.getCard(cardId);
        if (!freshCard) {
          console.log(`Card ${cardId} not found in cache or Scryfall`);
          return [];
        }
      }

      // Check if we already have themes stored for this card
      let storedThemes = await db
        .select()
        .from(cardThemes)
        .where(eq(cardThemes.cardId, cardId));

      // If no themes stored, analyze and store them
      if (storedThemes.length === 0) {
        const cardToAnalyze = sourceCard || await storage.getCachedCard(cardId);
        if (cardToAnalyze) {
          const analyzedThemes = await this.analyzeAndStoreCardThemes(cardToAnalyze);
          storedThemes = analyzedThemes;
        }
      }

      // If still no themes, don't create shallow type-based themes
      // Only meaningful strategic themes should be included

      // For each stored theme, find matching cards
      const themeGroups = [];
      const cardForMatching = sourceCard || await storage.getCachedCard(cardId);
      
      if (cardForMatching) {
        for (const storedTheme of storedThemes) {
          const matchingCards = await this.findCardsForStoredTheme(storedTheme, cardForMatching);
          if (matchingCards.length > 0) {
            themeGroups.push({
              theme: storedTheme.themeName,
              description: storedTheme.description || 'Strategic theme based on card analysis',
              cards: matchingCards.slice(0, 8) // Limit to 8 cards per theme
            });
          }
        }
      }

      return themeGroups;
    } catch (error) {
      console.error('Error getting theme suggestions:', error);
      return [];
    }
  }

  // Store themes for a card
  async analyzeAndStoreCardThemes(card: Card): Promise<any[]> {
    const themes = await this.analyzeCardThemes(card);
    const storedThemes = [];

    for (const theme of themes) {
      try {
        const [inserted] = await db
          .insert(cardThemes)
          .values({
            cardId: card.id,
            themeName: theme.name,
            themeCategory: theme.category,
            confidence: theme.confidence,
            keywords: theme.keywords,
            description: theme.description,
          })
          .returning();
        storedThemes.push(inserted);
      } catch (error: any) {
        // Ignore duplicate errors
        if (error.code !== '23505') {
          console.error('Error storing theme:', error);
        }
      }
    }

    return storedThemes;
  }

  private async analyzeCardThemes(card: Card): Promise<Array<{name: string, description: string, keywords: string[], category: string, confidence: number}>> {
    const themes: Array<{name: string, description: string, keywords: string[], category: string, confidence: number}> = [];
    
    const cardText = (card.oracle_text || '').toLowerCase();
    const typeLine = card.type_line.toLowerCase();
    const cardName = card.name.toLowerCase();

    // Cascade/Cheating theme detection
    if (
      cardText.includes('cascade') ||
      cardText.includes('without paying') && cardText.includes('mana cost') ||
      cardText.includes('cast') && cardText.includes('without paying') ||
      cardText.includes('exile') && cardText.includes('cast') ||
      cardText.includes('suspend') || cardText.includes('rebound')
    ) {
      let confidence = 70;
      if (cardText.includes('cascade')) confidence = 95;
      if (cardText.includes('without paying') && cardText.includes('mana cost')) confidence = 90;
      
      themes.push({
        name: 'Cascade/Cheating',
        description: 'Strategy focused on casting spells without paying their mana cost or getting additional value.',
        keywords: ['cascade', 'without paying', 'suspend', 'rebound', 'exile and cast'],
        category: 'mechanic',
        confidence
      });
    }

    // Card Advantage theme detection
    if (
      (cardText.includes('draw') && cardText.includes('card')) ||
      cardText.includes('whenever') && cardText.includes('draw') ||
      cardText.includes('scry') || cardText.includes('surveil') ||
      cardText.includes('cascade') || // Cascade gives card advantage
      cardText.includes('search') && cardText.includes('library') ||
      cardText.includes('return') && cardText.includes('hand')
    ) {
      let confidence = 60;
      if (cardText.includes('draw') && cardText.includes('card')) confidence = 85;
      if (cardText.includes('cascade')) confidence += 20; // Cascade is strong card advantage
      
      themes.push({
        name: 'Card Advantage',
        description: 'Strategy focused on generating more cards than opponents through draw, search, and selection.',
        keywords: ['draw', 'scry', 'surveil', 'search library', 'cascade', 'return to hand'],
        category: 'strategy',
        confidence: Math.min(confidence, 95)
      });
    }

    // Drain Strategy theme detection
    if (
      cardText.includes('lose') && cardText.includes('life') ||
      cardText.includes('drain') ||
      cardText.includes('each opponent loses') ||
      cardText.includes('damage to each opponent') ||
      cardText.includes('sacrifice') && cardText.includes('each player') ||
      cardText.includes('discard') && cardText.includes('each player')
    ) {
      let confidence = 75;
      if (cardText.includes('each opponent loses')) confidence = 90;
      if (cardText.includes('drain')) confidence = 85;
      
      themes.push({
        name: 'Drain Strategy',
        description: 'Strategy that slowly drains opponents resources and life while maintaining advantage.',
        keywords: ['lose life', 'drain', 'each opponent', 'damage to each', 'each player sacrifice'],
        category: 'strategy',
        confidence
      });
    }

    // Death & Taxes theme detection
    if (
      cardText.includes('tax') || 
      cardText.includes('enters the battlefield') && (cardText.includes('opponent') || cardText.includes('each player')) ||
      cardText.includes('artifact') && cardText.includes('cost') ||
      cardName.includes('thalia') || cardName.includes('leonin arbiter') ||
      cardText.includes('additional cost') || cardText.includes('pay') && cardText.includes('more')
    ) {
      let confidence = 80;
      if (cardText.includes('tax') || cardName.includes('thalia')) confidence = 95;
      
      themes.push({
        name: 'Death & Taxes',
        description: 'White weenie strategy that disrupts opponents with tax effects and efficient creatures.',
        keywords: ['tax', 'additional cost', 'enters the battlefield', 'artifact cost', 'creature cost', 'spell cost'],
        category: 'archetype',
        confidence
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
      let confidence = 85;
      if (cardText.includes('winter orb') || cardText.includes('smokestack')) confidence = 95;
      
      themes.push({
        name: 'Stax',
        description: 'Prison strategy focused on resource denial and symmetrical effects that hurt opponents more.',
        keywords: ['sacrifice', 'upkeep', 'can\'t cast', 'can\'t play', 'tap', 'don\'t untap', 'prison'],
        category: 'archetype',
        confidence
      });
    }

    // Combo Engine theme detection
    if (
      cardText.includes('infinite') ||
      cardText.includes('untap') && (cardText.includes('all') || cardText.includes('target')) ||
      cardText.includes('storm') ||
      (cardText.includes('draw') && cardText.includes('card')) && cardText.includes('whenever') ||
      cardText.includes('enters the battlefield') && cardText.includes('search') ||
      cardText.includes('tutor') || cardText.includes('demonic tutor')
    ) {
      let confidence = 70;
      if (cardText.includes('infinite')) confidence = 95;
      if (cardText.includes('storm')) confidence = 90;
      
      themes.push({
        name: 'Combo Engine',
        description: 'Cards that enable powerful synergies and game-winning combinations.',
        keywords: ['untap', 'storm', 'infinite', 'tutor', 'search', 'combo', 'enters and search'],
        category: 'strategy',
        confidence
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
      let confidence = 80;
      if (cardName.includes('blood artist') || cardName.includes('zulaport')) confidence = 95;
      
      themes.push({
        name: 'Aristocrats',
        description: 'Sacrifice-based strategy that gains value from creatures dying and entering the battlefield.',
        keywords: ['sacrifice', 'dies', 'death trigger', 'token', 'enters the battlefield', 'leaves the battlefield'],
        category: 'synergy',
        confidence
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
      let confidence = 75;
      if (cardText.includes('search') && cardText.includes('land')) confidence = 90;
      
      themes.push({
        name: 'Ramp',
        description: 'Mana acceleration strategy to cast expensive spells ahead of curve.',
        keywords: ['search', 'land', 'add mana', 'mana dork', 'accelerate', 'ramp'],
        category: 'strategy',
        confidence
      });
    }

    // Control theme detection
    if (
      cardText.includes('counter') && cardText.includes('spell') ||
      cardText.includes('destroy') && (cardText.includes('target') || cardText.includes('all')) ||
      cardText.includes('return') && cardText.includes('hand') ||
      typeLine.includes('instant') && (cardText.includes('counter') || cardText.includes('destroy'))
    ) {
      let confidence = 70;
      if (cardText.includes('counter') && cardText.includes('spell')) confidence = 85;
      
      themes.push({
        name: 'Control',
        description: 'Reactive strategy using counterspells, removal, and card draw to control the game.',
        keywords: ['counter', 'destroy', 'return', 'draw', 'instant', 'control', 'removal'],
        category: 'archetype',
        confidence
      });
    }

    return themes;
  }

  private async findCardsForStoredTheme(theme: any, sourceCard: Card): Promise<Card[]> {
    return this.findCardsForTheme(
      {
        name: theme.themeName,
        description: theme.description,
        keywords: theme.keywords || []
      },
      sourceCard
    );
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
        
        const currentCardText = (card.oracle_text || '').toLowerCase();
        const typeLine = card.type_line.toLowerCase();
        const cardName = card.name.toLowerCase();

        // Score based on keyword matches in oracle text (primary)
        for (const keyword of theme.keywords) {
          if (currentCardText.includes(keyword)) {
            score += 25; // High weight for oracle text matches
          } else if (cardName.includes(keyword) || typeLine.includes(keyword)) {
            score += 5; // Lower weight for name/type matches
          }
        }

        // Oracle text-focused theme matching
        const themeLower = theme.name.toLowerCase();
        if (themeLower === 'death & taxes') {
          if (currentCardText.includes('thalia') || currentCardText.includes('leonin arbiter')) score += 30;
          if (currentCardText.includes('tax') || currentCardText.includes('additional cost')) score += 20;
          if (currentCardText.includes('enters the battlefield') && currentCardText.includes('opponent')) score += 15;
        } else if (themeLower === 'stax') {
          if (currentCardText.includes('winter orb') || currentCardText.includes('smokestack')) score += 35;
          if (currentCardText.includes('upkeep') && currentCardText.includes('sacrifice')) score += 25;
          if (currentCardText.includes('can\'t') && (currentCardText.includes('cast') || currentCardText.includes('play'))) score += 20;
        } else if (themeLower === 'combo engine') {
          if (currentCardText.includes('storm') || currentCardText.includes('cascade')) score += 30;
          if (currentCardText.includes('infinite') || currentCardText.includes('without paying')) score += 25;
          if (currentCardText.includes('untap') && currentCardText.includes('target')) score += 20;
        } else if (themeLower === 'cascade/cheating') {
          if (currentCardText.includes('cascade')) score += 35;
          if (currentCardText.includes('without paying') && currentCardText.includes('mana cost')) score += 30;
          if (currentCardText.includes('suspend') || currentCardText.includes('rebound')) score += 20;
        } else if (themeLower === 'card advantage') {
          if (currentCardText.includes('draw') && currentCardText.includes('card')) score += 25;
          if (currentCardText.includes('search') && currentCardText.includes('library')) score += 20;
          if (currentCardText.includes('scry') || currentCardText.includes('surveil')) score += 15;
        } else if (themeLower === 'aristocrats') {
          if (currentCardText.includes('blood artist') || currentCardText.includes('zulaport')) score += 35;
          if (currentCardText.includes('sacrifice') && currentCardText.includes('creature')) score += 25;
          if (currentCardText.includes('whenever') && currentCardText.includes('dies')) score += 20;
        } else if (themeLower === 'ramp') {
          if (currentCardText.includes('cultivate') || currentCardText.includes('rampant growth')) score += 30;
          if (currentCardText.includes('search') && currentCardText.includes('land')) score += 25;
          if (currentCardText.includes('add') && currentCardText.includes('mana')) score += 20;
        } else if (themeLower === 'control') {
          if (currentCardText.includes('counterspell') || currentCardText.includes('wrath')) score += 30;
          if (currentCardText.includes('counter') && currentCardText.includes('spell')) score += 25;
          if (currentCardText.includes('destroy') && currentCardText.includes('target')) score += 20;
        }

        // Oracle text analysis for theme matching (most important)
        const sourceText = (sourceCard.oracle_text || '').toLowerCase();
        
        // Score based on shared important phrases in oracle text
        for (const keyword of theme.keywords) {
          if (sourceText.includes(keyword) && currentCardText.includes(keyword)) {
            score += 20; // High weight for oracle text matches
          }
        }
        
        // Minimal color identity compatibility
        const sourceColors = sourceCard.color_identity || [];
        const cardColors = card.color_identity || [];
        const colorOverlap = sourceColors.filter(c => cardColors.includes(c)).length;
        if (colorOverlap > 0) score += colorOverlap * 1; // Reduced weight

        if (score >= 10) { // Lower threshold to include more cards
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