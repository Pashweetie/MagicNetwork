import { storage } from "../storage";
import { Card } from "@shared/schema";
import { pureAIService } from "./pure-ai-recommendations";

export class RecommendationService {
  
  async generateCardRecommendations(cardId: string): Promise<void> {
    // Pure AI generates recommendations automatically when needed
    console.log(`AI recommendation generation handled by neural network for card: ${cardId}`);
  }

  async getCardRecommendations(cardId: string, limit: number = 10) {
    const recommendations = await storage.getCardRecommendations(cardId, 'synergy', limit);
    
    // Get the actual card data for each recommendation
    const cardData = await Promise.all(
      recommendations.map(async (rec) => {
        const card = await storage.getCachedCard(rec.recommendedCardId);
        return {
          ...rec,
          card
        };
      })
    );

    return cardData.filter(rec => rec.card !== null);
  }

  // Get personalized recommendations based on user interactions
  async getPersonalizedRecommendations(userId: number, limit: number = 20): Promise<Card[]> {
    return await storage.getPersonalizedRecommendations(userId, limit);
  }

  // Track user interaction for learning
  async trackUserInteraction(userId: number, cardId: string, interactionType: string, metadata?: any): Promise<void> {
    await storage.recordUserInteraction({
      userId,
      cardId,
      interactionType,
      metadata
    });
  }

  async getThemeSuggestions(cardId: string, filters?: any): Promise<Array<{theme: string, description: string, confidence: number, cards: Card[]}>> {
    console.log(`Getting theme analysis with cards for card: ${cardId}`);
    
    try {
      const card = await storage.getCard(cardId);
      if (!card) {
        console.log(`Card not found: ${cardId}`);
        return [];
      }
      
      console.log(`Retrieved card: ${card.name} (${card.type_line})`);
      
      // Get AI-generated themes
      const aiThemes = await pureAIService.analyzeCardThemes(card);
      console.log(`AI identified ${aiThemes.length} themes for ${card.name}`);
      
      // Get theme confidence from database and find similar cards
      const { db } = await import('../db');
      const { cardThemes, cardCache } = await import('@shared/schema');
      const { eq, and, ne, sql, desc } = await import('drizzle-orm');
      
      const dbThemes = await db
        .select()
        .from(cardThemes)
        .where(eq(cardThemes.card_id, cardId));
      
      const themeGroups = [];
      for (const theme of aiThemes) {
        const dbTheme = dbThemes.find(t => t.theme_name === theme.theme);
        const confidence = dbTheme?.confidence || 0.5;
        
        // Find cards with the same theme
        const similarThemeCards = await db
          .select({
            cardId: cardThemes.card_id,
            confidence: cardThemes.confidence
          })
          .from(cardThemes)
          .where(and(
            eq(cardThemes.theme_name, theme.theme),
            ne(cardThemes.card_id, cardId)
          ))
          .orderBy(desc(cardThemes.confidence))
          .limit(12);
        
        // Get the actual card data from cache
        const cards: Card[] = [];
        for (const themeCard of similarThemeCards) {
          const cached = await db
            .select()
            .from(cardCache)
            .where(eq(cardCache.id, themeCard.cardId))
            .limit(1);
          
          if (cached.length > 0) {
            const cardData = cached[0].cardData as Card;
            if (cardData && this.cardMatchesFilters(cardData, filters)) {
              cards.push(cardData);
            }
          }
        }
        
        console.log(`Found ${cards.length} cards for theme "${theme.theme}" with ${confidence}% confidence`);
        
        themeGroups.push({
          theme: theme.theme,
          description: theme.description,
          confidence: confidence,
          cards: cards
        });
      }
      
      console.log(`Returning ${themeGroups.length} theme groups with cards and confidence`);
      console.log('Theme groups:', themeGroups.map(g => ({ theme: g.theme, confidence: g.confidence, cardCount: g.cards.length })));
      return themeGroups;
      
    } catch (error) {
      console.error('Error getting theme suggestions:', error);
      return [];
    }
  }

  private cardMatchesFilters(card: Card, filters?: any): boolean {
    if (!filters) return true;
    
    try {
      if (filters.colors && filters.colors.length > 0) {
        const cardColors = card.colors || [];
        const hasRequiredColors = filters.colors.every((color: string) => 
          cardColors.includes(color)
        );
        if (!hasRequiredColors) return false;
      }
      
      if (filters.cmc_min !== undefined && card.cmc < filters.cmc_min) return false;
      if (filters.cmc_max !== undefined && card.cmc > filters.cmc_max) return false;
      
      if (filters.type && !card.type_line.toLowerCase().includes(filters.type.toLowerCase())) return false;
      
      return true;
    } catch (error) {
      console.error('Filter matching error:', error);
      return true;
    }
  }

  // Generate recommendations for popular cards in batches
  async generateRecommendationsForPopularCards(limit: number = 50): Promise<void> {
    console.log('Neural network handles recommendation generation automatically');
  }
}

export const recommendationService = new RecommendationService();