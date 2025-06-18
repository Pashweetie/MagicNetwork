import { storage } from "../storage";
import { Card } from "@shared/schema";

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
    const popularCards = await storage.db
      .select({ id: storage.cardCache.id })
      .from(storage.cardCache)
      .orderBy(storage.desc(storage.cardCache.searchCount))
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
}

export const recommendationService = new RecommendationService();