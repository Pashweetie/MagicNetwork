import { storage } from "../storage";
import { Card } from "@shared/schema";
import { aiRecommendationService } from "./ai-recommendation-service";
import { cardMatchesFilters } from "../utils/card-filters";

export class RecommendationService {
  
  async generateCardRecommendations(cardId: string): Promise<void> {
    // Pure AI generates recommendations automatically when needed
    console.log(`AI recommendation generation handled by neural network for card: ${cardId}`);
  }

  async getCardRecommendations(cardId: string, limit: number = 10) {
    // All recommendations now calculated by frontend using theme-based synergy
    return [];
  }

  // Get personalized recommendations based on user interactions
  async getPersonalizedRecommendations(userId: number, limit: number = 20): Promise<Card[]> {
    return await storage.getPersonalizedRecommendations(userId, limit);
  }

  // Track user interaction for learning
  async trackUserInteraction(userId: number, cardId: string, interactionType: string, metadata?: any): Promise<void> {
    // User interactions now handled by frontend theme voting system
    console.log(`User ${userId} interacted with card ${cardId}: ${interactionType}`);
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
      
      // Check if themes already exist in database
      const existingThemes = await storage.getCardThemes(cardId);
      
      let aiThemes = [];
      if (existingThemes.length === 0) {
        // Generate themes if none exist
        console.log(`No existing themes found, generating AI themes for ${card.name}`);
        await aiRecommendationService.generateCardThemes(card);
        
        // Get the newly generated themes
        const newThemes = await storage.getCardThemes(cardId);
        aiThemes = newThemes.map(t => ({
          theme: t.theme_name,
          description: `${t.theme_name} strategy`
        }));
        console.log(`AI identified ${aiThemes.length} themes for ${card.name}`);
        
        // Trigger storage of themes (this happens in analyzeCardThemes via unifiedAIService)
        if (aiThemes.length > 0) {
          // Re-fetch the newly stored themes
          const newlyStoredThemes = await storage.getCardThemes(cardId);
          console.log(`Stored ${newlyStoredThemes.length} themes in database`);
        }
      } else {
        console.log(`Using ${existingThemes.length} existing themes from database`);
        aiThemes = existingThemes.map(t => ({
          theme: t.theme_name,
          description: t.description || ''
        }));
      }

      if (aiThemes.length === 0) {
        console.log('No themes found for card');
        return [];
      }

      const themeSuggestions = [];
      
      for (const themeData of aiThemes.slice(0, 3)) { // Limit to top 3 themes
        try {
          console.log(`Finding cards for theme: ${themeData.theme}`);
          
          // Find cards that match this theme using existing card_themes table
          const { db } = await import('../db');
          const { cardThemes, cardCache } = await import('@shared/schema');
          const { eq, and, ne, sql, desc } = await import('drizzle-orm');
          
          // Try to find cards with exact theme match first
          let similarThemeCards = await db
            .select({
              cardId: cardThemes.card_id,
              finalScore: cardThemes.final_score
            })
            .from(cardThemes)
            .where(and(
              eq(cardThemes.theme_name, themeData.theme),
              ne(cardThemes.card_id, cardId)
            ))
            .orderBy(desc(cardThemes.final_score))
            .limit(12);
          
          // Only use database themes - no fallback generation
          if (similarThemeCards.length === 0) {
            console.log(`No cards found in database for theme: ${themeData.theme}`);
            continue; // Skip this theme if no cards found
          }
          
          // Get the actual card data from cache
          const cards: Card[] = [];
          for (const themeCard of similarThemeCards) {
            const cached = await db
              .select()
              .from(cardCache)
              .where(eq(cardCache.id, themeCard.cardId))
              .limit(1);
            
            if (cached.length > 0) {
              let cardData: Card;
              
              // Handle both string and object cardData
              if (typeof cached[0].cardData === 'string') {
                cardData = JSON.parse(cached[0].cardData) as Card;
              } else {
                cardData = cached[0].cardData as Card;
              }
              
              if (cardData && cardMatchesFilters(cardData, filters)) {
                cards.push(cardData);
              }
            }
          }
          
          if (cards.length > 0) {
            // Use the theme's actual final_score from database if it exists for this card
            const cardTheme = existingThemes.find(t => t.theme_name === themeData.theme);
            const confidence = cardTheme ? cardTheme.final_score / 100 : 0.5;
            
            themeSuggestions.push({
              theme: themeData.theme,
              description: themeData.description,
              confidence: confidence,
              cards: cards.slice(0, 8) // Limit cards per theme
            });
            
            console.log(`Added theme "${themeData.theme}" with ${cards.length} cards`);
          } else {
            console.log(`No cards found for theme "${themeData.theme}"`);
          }
        } catch (themeError) {
          console.error(`Theme processing error for ${themeData.theme}:`, themeError);
        }
      }

      console.log(`Returning ${themeSuggestions.length} theme suggestions`);
      return themeSuggestions.sort((a, b) => b.confidence - a.confidence);
    } catch (error) {
      console.error('Error getting theme suggestions:', error);
      return [];
    }
  }





  // Generate recommendations for popular cards in batches
  async generateRecommendationsForPopularCards(limit: number = 50): Promise<void> {
    console.log('Neural network handles recommendation generation automatically');
  }
}

export const recommendationService = new RecommendationService();