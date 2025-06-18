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

  // Pure neural network theme analysis - no hardcoded patterns
  async getThemeSuggestions(cardId: string, filters?: any): Promise<Array<{theme: string, description: string, cards: Card[]}>> {
    console.log(`Getting pure neural network theme analysis for card: ${cardId}`);
    
    try {
      const card = await storage.getCard(cardId);
      if (!card) {
        console.log(`Card not found: ${cardId}`);
        return [];
      }
      
      console.log(`Retrieved card: ${card.name} (${card.type_line})`);
      
      // Get AI-generated themes (uses cache if available)
      const aiThemes = await pureAIService.analyzeCardThemes(card);
      console.log(`AI identified ${aiThemes.length} themes for ${card.name}`);
      
      // Return just theme names - cards loaded on-demand to avoid performance issues
      const themeGroups = aiThemes.map(theme => ({
        theme: theme.theme,
        description: theme.description,
        cards: [] // Empty - loaded when user expands theme
      }));
      
      console.log(`Returning ${themeGroups.length} theme groups (cards on-demand)`);
      return themeGroups;
      
    } catch (error) {
      console.error('Error getting neural network theme suggestions:', error);
      return [];
    }
  }

  // Generate recommendations for popular cards in batches
  async generateRecommendationsForPopularCards(limit: number = 50): Promise<void> {
    console.log('Neural network handles recommendation generation automatically');
  }
}

export const recommendationService = new RecommendationService();