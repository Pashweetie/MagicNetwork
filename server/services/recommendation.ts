import { storage } from "../storage";
import { Card } from "@shared/schema";
import { pureAIService } from "./pure-ai-recommendations";
import { themeSystem } from "./theme-system";
import { cardMatchesFilters } from "../utils/card-filters";

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
      
      // Generate themes using the new theme system
      const cardThemes = await themeSystem.generateCardThemes(card);
      console.log(`Generated ${cardThemes.length} themes for ${card.name}`);

      if (cardThemes.length === 0) {
        console.log('No themes found for card');
        return [];
      }

      const themeSuggestions = [];
      
      for (const themeData of cardThemes.slice(0, 3)) { // Limit to top 3 themes
        try {
          console.log(`Finding cards for theme: ${themeData.theme}`);
          
          // Find cards that match this theme
          const themeCards = await themeSystem.findCardsForTheme(themeData, card, filters);
          
          if (themeCards.length > 0) {
            themeSuggestions.push({
              theme: themeData.theme,
              description: themeData.description,
              confidence: Math.min(themeData.confidence || 0.8, 1.0),
              cards: themeCards.slice(0, 8) // Limit cards per theme
            });
            
            console.log(`Added theme "${themeData.theme}" with ${themeCards.length} cards`);
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