import { Card, SearchFilters, SearchResponse, User, InsertUser, SavedSearch, InsertSavedSearch, FavoriteCard, InsertFavoriteCard, CardCacheEntry, InsertCardCache, SearchCacheEntry, InsertSearchCache, CardRecommendation, InsertCardRecommendation, UserInteraction, InsertUserInteraction } from "@shared/schema";
import { db } from "./db";
import { users, savedSearches, favoriteCards, cardCache, searchCache, cardRecommendations, userInteractions } from "@shared/schema";
import { eq, desc, sql, and, inArray } from "drizzle-orm";
import { scryfallService } from "./services/scryfall";
import crypto from "crypto";

export interface IStorage {
  // Card search methods
  searchCards(filters: SearchFilters, page: number): Promise<SearchResponse>;
  getCard(id: string): Promise<Card | null>;
  getRandomCard(): Promise<Card>;
  
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(insertUser: InsertUser): Promise<User>;
  
  // Saved searches
  getSavedSearches(userId: number): Promise<SavedSearch[]>;
  createSavedSearch(search: InsertSavedSearch): Promise<SavedSearch>;
  deleteSavedSearch(id: number, userId: number): Promise<boolean>;
  
  // Favorite cards
  getFavoriteCards(userId: number): Promise<FavoriteCard[]>;
  addFavoriteCard(favorite: InsertFavoriteCard): Promise<FavoriteCard>;
  removeFavoriteCard(cardId: string, userId: number): Promise<boolean>;
  
  // Cache management
  cacheCard(card: Card): Promise<void>;
  getCachedCard(id: string): Promise<Card | null>;
  cacheSearchResults(filters: SearchFilters, page: number, results: SearchResponse): Promise<void>;
  getCachedSearchResults(filters: SearchFilters, page: number): Promise<SearchResponse | null>;
  cleanupOldCache(): Promise<void>;
  
  // User interactions for recommendations
  recordUserInteraction(interaction: InsertUserInteraction): Promise<void>;
  getUserInteractions(userId: number, limit?: number): Promise<UserInteraction[]>;
  
  // Recommendation system
  getCardRecommendations(cardId: string, limit?: number): Promise<CardRecommendation[]>;
  generateRecommendationsForCard(cardId: string): Promise<void>;
  getPersonalizedRecommendations(userId: number, limit?: number): Promise<Card[]>;
}

export class DatabaseStorage implements IStorage {
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours for card cache
  private readonly SEARCH_CACHE_TTL = 60 * 60 * 1000; // 1 hour for search cache

  private generateQueryHash(filters: SearchFilters, page: number): string {
    const queryString = JSON.stringify({ filters, page });
    return crypto.createHash('md5').update(queryString).digest('hex');
  }

  async searchCards(filters: SearchFilters, page: number = 1): Promise<SearchResponse> {
    // Try to get from cache first
    const cachedResult = await this.getCachedSearchResults(filters, page);
    if (cachedResult) {
      return cachedResult;
    }

    // Fetch from Scryfall API
    const result = await scryfallService.searchCards(filters, page);
    
    // Cache the results and individual cards
    await this.cacheSearchResults(filters, page, result);
    
    // Cache individual cards from the results
    for (const card of result.data) {
      await this.cacheCard(card);
    }

    return result;
  }

  async getCard(id: string): Promise<Card | null> {
    // Try cache first
    const cachedCard = await this.getCachedCard(id);
    if (cachedCard) {
      // Update search count
      await db
        .update(cardCache)
        .set({ searchCount: sql`${cardCache.searchCount} + 1` })
        .where(eq(cardCache.id, id));
      return cachedCard;
    }

    // Fetch from Scryfall API
    const card = await scryfallService.getCard(id);
    if (card) {
      await this.cacheCard(card);
    }
    
    return card;
  }

  async getRandomCard(): Promise<Card> {
    // Get a random cached card first to reduce API calls
    const [randomCached] = await db
      .select()
      .from(cardCache)
      .orderBy(sql`RANDOM()`)
      .limit(1);
    
    if (randomCached && Math.random() > 0.3) { // 70% chance to use cached
      return randomCached.cardData;
    }

    // Otherwise fetch from API
    const card = await scryfallService.getRandomCard();
    await this.cacheCard(card);
    return card;
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  // Saved searches
  async getSavedSearches(userId: number): Promise<SavedSearch[]> {
    return await db
      .select()
      .from(savedSearches)
      .where(eq(savedSearches.userId, userId));
  }

  async createSavedSearch(search: InsertSavedSearch): Promise<SavedSearch> {
    const [savedSearch] = await db
      .insert(savedSearches)
      .values(search as any)
      .returning();
    return savedSearch;
  }

  async deleteSavedSearch(id: number, userId: number): Promise<boolean> {
    const result = await db
      .delete(savedSearches)
      .where(eq(savedSearches.id, id) && eq(savedSearches.userId, userId));
    return (result.rowCount || 0) > 0;
  }

  // Favorite cards
  async getFavoriteCards(userId: number): Promise<FavoriteCard[]> {
    return await db
      .select()
      .from(favoriteCards)
      .where(eq(favoriteCards.userId, userId));
  }

  async addFavoriteCard(favorite: InsertFavoriteCard): Promise<FavoriteCard> {
    const [favoriteCard] = await db
      .insert(favoriteCards)
      .values(favorite as any)
      .returning();
    return favoriteCard;
  }

  async removeFavoriteCard(cardId: string, userId: number): Promise<boolean> {
    const result = await db
      .delete(favoriteCards)
      .where(eq(favoriteCards.cardId, cardId) && eq(favoriteCards.userId, userId));
    return (result.rowCount || 0) > 0;
  }

  // Cache management methods
  async cacheCard(card: Card): Promise<void> {
    try {
      console.log(`Attempting to cache card: ${card.name} (${card.id})`);
      
      // First try to insert
      try {
        await db
          .insert(cardCache)
          .values({
            id: card.id,
            cardData: card,
          });
        console.log(`Successfully cached new card: ${card.name} (${card.id})`);
      } catch (insertError: any) {
        // If duplicate key error, update instead
        if (insertError.code === '23505') { // PostgreSQL unique violation
          await db
            .update(cardCache)
            .set({
              cardData: card,
              lastUpdated: new Date(),
              searchCount: sql`${cardCache.searchCount} + 1`,
            })
            .where(eq(cardCache.id, card.id));
          console.log(`Updated existing cached card: ${card.name} (${card.id})`);
        } else {
          throw insertError;
        }
      }
    } catch (error) {
      console.error('Error caching card:', error);
    }
  }

  async getCachedCard(id: string): Promise<Card | null> {
    try {
      const [cached] = await db
        .select()
        .from(cardCache)
        .where(eq(cardCache.id, id));
      
      if (!cached) return null;

      // Check if cache is expired
      const isExpired = Date.now() - cached.lastUpdated.getTime() > this.CACHE_TTL;
      if (isExpired) {
        // Don't delete, just fetch fresh data
        return null;
      }

      return cached.cardData;
    } catch (error) {
      console.error('Error getting cached card:', error);
      return null;
    }
  }

  async cacheSearchResults(filters: SearchFilters, page: number, results: SearchResponse): Promise<void> {
    try {
      const queryHash = this.generateQueryHash(filters, page);
      console.log(`Attempting to cache search results for hash: ${queryHash}`);
      
      // First try to insert
      try {
        await db
          .insert(searchCache)
          .values({
            queryHash,
            filters,
            resultData: results,
            page,
          });
        console.log(`Successfully cached new search: ${results.data.length} cards for query hash ${queryHash}`);
      } catch (insertError: any) {
        // If duplicate key error, update instead
        if (insertError.code === '23505') { // PostgreSQL unique violation
          await db
            .update(searchCache)
            .set({
              resultData: results,
              lastAccessed: new Date(),
              accessCount: sql`${searchCache.accessCount} + 1`,
            })
            .where(eq(searchCache.queryHash, queryHash));
          console.log(`Updated existing search cache for query hash ${queryHash}`);
        } else {
          throw insertError;
        }
      }
    } catch (error) {
      console.error('Error caching search results:', error);
    }
  }

  async getCachedSearchResults(filters: SearchFilters, page: number): Promise<SearchResponse | null> {
    try {
      const queryHash = this.generateQueryHash(filters, page);
      
      const [cached] = await db
        .select()
        .from(searchCache)
        .where(eq(searchCache.queryHash, queryHash));
      
      if (!cached) return null;

      // Check if cache is expired
      const isExpired = Date.now() - cached.lastAccessed.getTime() > this.SEARCH_CACHE_TTL;
      if (isExpired) {
        return null;
      }

      // Update access time
      await db
        .update(searchCache)
        .set({ 
          lastAccessed: new Date(),
          accessCount: sql`${searchCache.accessCount} + 1`
        })
        .where(eq(searchCache.queryHash, queryHash));

      return cached.resultData;
    } catch (error) {
      console.error('Error getting cached search results:', error);
      return null;
    }
  }

  async cleanupOldCache(): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      
      // Only clean up very old search cache to keep storage manageable
      await db
        .delete(searchCache)
        .where(sql`${searchCache.lastAccessed} < ${cutoffDate} AND ${searchCache.accessCount} < 2`);
      
      console.log('Minimal cache cleanup completed - cards preserved for recommendations');
    } catch (error) {
      console.error('Error during cache cleanup:', error);
    }
  }

  // User interaction tracking for personalized recommendations
  async recordUserInteraction(interaction: InsertUserInteraction): Promise<void> {
    try {
      await db.insert(userInteractions).values(interaction);
    } catch (error) {
      console.error('Error recording user interaction:', error);
    }
  }

  async getUserInteractions(userId: number, limit: number = 100): Promise<UserInteraction[]> {
    return await db
      .select()
      .from(userInteractions)
      .where(eq(userInteractions.userId, userId))
      .orderBy(desc(userInteractions.createdAt))
      .limit(limit);
  }

  // Recommendation system
  async getCardRecommendations(cardId: string, limit: number = 10): Promise<CardRecommendation[]> {
    return await db
      .select()
      .from(cardRecommendations)
      .where(eq(cardRecommendations.sourceCardId, cardId))
      .orderBy(desc(cardRecommendations.score))
      .limit(limit);
  }

  async generateRecommendationsForCard(cardId: string): Promise<void> {
    try {
      const sourceCard = await this.getCachedCard(cardId);
      if (!sourceCard) return;

      // Find similar cards based on multiple criteria
      const recommendations = await this.findSimilarCards(sourceCard);
      
      // Store recommendations in database
      for (const rec of recommendations) {
        try {
          await db.insert(cardRecommendations).values({
            sourceCardId: cardId,
            recommendedCardId: rec.cardId,
            score: rec.score,
            reason: rec.reason,
          });
        } catch (error: any) {
          // Ignore duplicate key errors
          if (error.code !== '23505') {
            console.error('Error storing recommendation:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error generating recommendations:', error);
    }
  }

  private async findSimilarCards(sourceCard: Card): Promise<Array<{cardId: string, score: number, reason: string}>> {
    const recommendations: Array<{cardId: string, score: number, reason: string}> = [];
    
    // Get all cached cards for analysis
    const allCards = await db.select().from(cardCache).limit(1000);
    
    for (const cached of allCards) {
      if (cached.id === sourceCard.id) continue;
      
      const card = cached.cardData;
      let score = 0;
      const reasons: string[] = [];

      // Mana cost similarity (high weight for same CMC)
      if (sourceCard.cmc === card.cmc) {
        score += 30;
        reasons.push('same mana value');
      } else if (Math.abs(sourceCard.cmc - card.cmc) <= 1) {
        score += 15;
        reasons.push('similar mana value');
      }

      // Color identity similarity
      const sourceColors = sourceCard.color_identity || [];
      const cardColors = card.color_identity || [];
      const colorOverlap = sourceColors.filter(c => cardColors.includes(c)).length;
      if (colorOverlap > 0) {
        score += colorOverlap * 10;
        reasons.push('shared colors');
      }

      // Type line similarity
      if (sourceCard.type_line && card.type_line) {
        const sourceTypes = sourceCard.type_line.toLowerCase().split(/[—\-\s]+/);
        const cardTypes = card.type_line.toLowerCase().split(/[—\-\s]+/);
        const typeOverlap = sourceTypes.filter(t => cardTypes.includes(t)).length;
        if (typeOverlap > 0) {
          score += typeOverlap * 15;
          reasons.push('similar card type');
        }
      }

      // Oracle text keyword similarity
      if (sourceCard.oracle_text && card.oracle_text) {
        const keywords = ['flying', 'trample', 'haste', 'vigilance', 'deathtouch', 'lifelink', 'first strike', 'double strike', 'hexproof', 'indestructible'];
        const sourceKeywords = keywords.filter(k => sourceCard.oracle_text!.toLowerCase().includes(k));
        const cardKeywords = keywords.filter(k => card.oracle_text!.toLowerCase().includes(k));
        const keywordOverlap = sourceKeywords.filter(k => cardKeywords.includes(k)).length;
        if (keywordOverlap > 0) {
          score += keywordOverlap * 8;
          reasons.push('shared abilities');
        }
      }

      // Power/Toughness similarity for creatures
      if (sourceCard.power && card.power && sourceCard.toughness && card.toughness) {
        const powerDiff = Math.abs(parseInt(sourceCard.power) - parseInt(card.power));
        const toughnessDiff = Math.abs(parseInt(sourceCard.toughness) - parseInt(card.toughness));
        if (powerDiff <= 1 && toughnessDiff <= 1) {
          score += 12;
          reasons.push('similar stats');
        }
      }

      // Set/block synergy (cards from same set often work well together)
      if (sourceCard.set === card.set) {
        score += 8;
        reasons.push('same set');
      }

      if (score >= 25) { // Minimum threshold for recommendation
        recommendations.push({
          cardId: card.id,
          score: Math.min(score, 100),
          reason: reasons.join(', ')
        });
      }
    }

    return recommendations.sort((a, b) => b.score - a.score).slice(0, 20);
  }

  async getPersonalizedRecommendations(userId: number, limit: number = 20): Promise<Card[]> {
    try {
      // Get user's recent interactions
      const interactions = await this.getUserInteractions(userId, 50);
      
      if (interactions.length === 0) {
        // New user - return popular cards
        const popularCards = await db
          .select()
          .from(cardCache)
          .orderBy(desc(cardCache.searchCount))
          .limit(limit);
        return popularCards.map(c => c.cardData);
      }

      // Get cards user has interacted with
      const userCardIds = interactions.map(i => i.cardId);
      const recommendationScores: Map<string, number> = new Map();

      // For each card the user interacted with, get recommendations
      for (const interaction of interactions.slice(0, 10)) { // Limit to recent 10
        const recommendations = await this.getCardRecommendations(interaction.cardId, 15);
        
        // Weight recommendations based on interaction type and recency
        const interactionWeight = this.getInteractionWeight(interaction.interactionType);
        const ageWeight = this.getAgeWeight(interaction.createdAt);
        
        for (const rec of recommendations) {
          if (userCardIds.includes(rec.recommendedCardId)) continue; // Skip cards user already knows
          
          const currentScore = recommendationScores.get(rec.recommendedCardId) || 0;
          const newScore = currentScore + (rec.score * interactionWeight * ageWeight);
          recommendationScores.set(rec.recommendedCardId, newScore);
        }
      }

      // Get top recommended cards
      const sortedRecommendations = Array.from(recommendationScores.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);

      if (sortedRecommendations.length === 0) {
        // Fallback to popular cards
        const popularCards = await db
          .select()
          .from(cardCache)
          .orderBy(desc(cardCache.searchCount))
          .limit(limit);
        return popularCards.map(c => c.cardData);
      }

      const recommendedCardIds = sortedRecommendations.map(r => r[0]);
      const cards = await db
        .select()
        .from(cardCache)
        .where(inArray(cardCache.id, recommendedCardIds));

      return cards.map(c => c.cardData);
    } catch (error) {
      console.error('Error getting personalized recommendations:', error);
      return [];
    }
  }

  private getInteractionWeight(interactionType: string): number {
    switch (interactionType) {
      case 'favorite': return 1.0;
      case 'deck_add': return 0.9;
      case 'search': return 0.6;
      case 'view': return 0.3;
      default: return 0.1;
    }
  }

  private getAgeWeight(createdAt: Date): number {
    const daysSince = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince <= 1) return 1.0;
    if (daysSince <= 7) return 0.8;
    if (daysSince <= 30) return 0.6;
    return 0.3;
  }
}

export const storage = new DatabaseStorage();
