import { db } from "./db";
import { cardCache, searchCache, users, savedSearches, favoriteCards, cardRecommendations, userInteractions, recommendationFeedback, cardThemes, decks, cardTags, tagRelationships, userTagFeedback } from "@shared/schema";
import { Card, SearchFilters, SearchResponse, User, InsertUser, SavedSearch, InsertSavedSearch, FavoriteCard, InsertFavoriteCard, CardRecommendation, InsertCardRecommendation, UserInteraction, InsertUserInteraction, InsertRecommendationFeedback, Deck, InsertDeck, CardTag, InsertCardTag, TagRelationship, InsertTagRelationship, UserTagFeedback, InsertUserTagFeedback } from "@shared/schema";
import { eq, sql, and, desc, asc } from "drizzle-orm";
import crypto from "crypto";
import { scryfallService } from "./services/scryfall";
import { cardMatchesFilters } from "./utils/card-filters";

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
  
  // Recommendation system (simplified)
  getCardRecommendations(cardId: string, type: 'synergy' | 'functional_similarity', limit?: number, filters?: any): Promise<CardRecommendation[]>;
  
  // Theme-based synergy system
  findCardsBySharedThemes(sourceCard: Card, sourceThemes: Array<{theme: string, description: string, confidence: number, cards: Card[]}>, filters?: any): Promise<Array<{card: Card, sharedThemes: Array<{theme: string, confidence: number}>, synergyScore: number, reason: string}>>;
  
  // Tag system
  getCardTags(cardId: string): Promise<CardTag[]>;
  createCardTag(tag: InsertCardTag): Promise<CardTag>;
  updateCardTagVotes(cardId: string, tag: string, upvotes: number, downvotes: number): Promise<void>;
  findCardsByTags(tags: string[], filters?: any): Promise<Card[]>;
  getTagRelationships(tag: string): Promise<TagRelationship[]>;
  createTagRelationship(relationship: InsertTagRelationship): Promise<TagRelationship>;
  recordUserTagFeedback(feedback: InsertUserTagFeedback): Promise<void>;
  
  // Feedback system
  recordRecommendationFeedback(feedback: InsertRecommendationFeedback): Promise<void>;
  getRecommendationWeights(): Promise<{[key: string]: number}>;
  
  // Deck persistence
  createDeck(deck: InsertDeck): Promise<Deck>;
  getUserDecks(userId: number): Promise<Deck[]>;
  getDeck(id: number, userId: number): Promise<Deck | null>;
  updateDeck(id: number, userId: number, updates: Partial<InsertDeck>): Promise<Deck | null>;
  deleteDeck(id: number, userId: number): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours for card cache
  private readonly SEARCH_CACHE_TTL = 60 * 60 * 1000; // 1 hour for search cache

  private generateQueryHash(filters: SearchFilters, page: number): string {
    return crypto.createHash('md5').update(JSON.stringify({ filters, page })).digest('hex');
  }

  async searchCards(filters: SearchFilters, page: number = 1): Promise<SearchResponse> {
    try {
      return await scryfallService.searchCards(filters, page);
    } catch (error) {
      console.error('Search failed:', error);
      return { data: [], has_more: false, total_cards: 0 };
    }
  }

  async getCard(id: string): Promise<Card | null> {
    // Try cache first
    const cached = await this.getCachedCard(id);
    if (cached) return cached;

    // Fetch from API
    try {
      const card = await scryfallService.getCard(id);
      if (card) {
        await this.cacheCard(card);
      }
      return card;
    } catch (error) {
      console.error(`Failed to get card ${id}:`, error);
      return null;
    }
  }

  async getRandomCard(): Promise<Card> {
    try {
      return await scryfallService.getRandomCard();
    } catch (error) {
      console.error('Failed to get random card:', error);
      throw new Error('Failed to get random card');
    }
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getSavedSearches(userId: number): Promise<SavedSearch[]> {
    return db.select()
      .from(savedSearches)
      .where(eq(savedSearches.userId, userId))
      .orderBy(desc(savedSearches.createdAt));
  }

  async createSavedSearch(search: InsertSavedSearch): Promise<SavedSearch> {
    const [result] = await db.insert(savedSearches).values(search).returning();
    return result;
  }

  async deleteSavedSearch(id: number, userId: number): Promise<boolean> {
    await db.delete(savedSearches)
      .where(and(eq(savedSearches.id, id), eq(savedSearches.userId, userId)));
    return true;
  }

  async getFavoriteCards(userId: number): Promise<FavoriteCard[]> {
    return db.select()
      .from(favoriteCards)
      .where(eq(favoriteCards.userId, userId))
      .orderBy(desc(favoriteCards.createdAt));
  }

  async addFavoriteCard(favorite: InsertFavoriteCard): Promise<FavoriteCard> {
    const [result] = await db.insert(favoriteCards).values(favorite).returning();
    return result;
  }

  async removeFavoriteCard(cardId: string, userId: number): Promise<boolean> {
    await db.delete(favoriteCards)
      .where(and(eq(favoriteCards.cardId, cardId), eq(favoriteCards.userId, userId)));
    return true;
  }

  async cacheCard(card: Card): Promise<void> {
    await db.insert(cardCache).values({
      id: card.id,
      cardData: card
    }).onConflictDoUpdate({
      target: cardCache.id,
      set: {
        cardData: card,
        lastUpdated: new Date(),
        searchCount: sql`${cardCache.searchCount} + 1`
      }
    });
  }

  async getCachedCard(id: string): Promise<Card | null> {
    const [cached] = await db.select().from(cardCache).where(eq(cardCache.id, id));
    return cached ? cached.cardData as Card : null;
  }

  async cacheSearchResults(filters: SearchFilters, page: number, results: SearchResponse): Promise<void> {
    const queryHash = this.generateQueryHash(filters, page);
    await db.insert(searchCache).values({
      queryHash,
      results
    }).onConflictDoUpdate({
      target: searchCache.queryHash,
      set: {
        results,
        lastAccessed: new Date(),
        accessCount: sql`${searchCache.accessCount} + 1`
      }
    });
  }

  async getCachedSearchResults(filters: SearchFilters, page: number): Promise<SearchResponse | null> {
    const queryHash = this.generateQueryHash(filters, page);
    const [cached] = await db.select().from(searchCache).where(eq(searchCache.queryHash, queryHash));
    
    if (cached) {
      const age = Date.now() - cached.createdAt.getTime();
      if (age < this.SEARCH_CACHE_TTL) {
        return cached.results as SearchResponse;
      }
    }
    return null;
  }

  async cleanupOldCache(): Promise<void> {
    const cutoff = new Date(Date.now() - this.CACHE_TTL);
    await db.delete(cardCache).where(sql`${cardCache.lastUpdated} < ${cutoff}`);
    await db.delete(searchCache).where(sql`${searchCache.lastAccessed} < ${cutoff}`);
  }

  async recordUserInteraction(interaction: InsertUserInteraction): Promise<void> {
    await db.insert(userInteractions).values(interaction);
  }

  async getUserInteractions(userId: number, limit: number = 100): Promise<UserInteraction[]> {
    return db.select()
      .from(userInteractions)
      .where(eq(userInteractions.userId, userId))
      .orderBy(desc(userInteractions.createdAt))
      .limit(limit);
  }

  async getCardRecommendations(cardId: string, type: 'synergy' | 'functional_similarity', limit: number = 10, filters?: any): Promise<CardRecommendation[]> {
    return db.select()
      .from(cardRecommendations)
      .where(and(eq(cardRecommendations.sourceCardId, cardId), eq(cardRecommendations.recommendationType, type)))
      .orderBy(desc(cardRecommendations.score))
      .limit(limit);
  }

  async generateRecommendationsForCard(cardId: string): Promise<void> {
    // AI handles this automatically
    console.log(`AI generating recommendations for card: ${cardId}`);
  }

  async getPersonalizedRecommendations(userId: number, limit: number = 20): Promise<Card[]> {
    const interactions = await this.getUserInteractions(userId, 50);
    
    if (interactions.length === 0) {
      const popularCards = await db.select()
        .from(cardCache)
        .orderBy(desc(cardCache.searchCount))
        .limit(limit);
      
      return popularCards.map(cached => cached.cardData as Card);
    }

    const cardIds = interactions.map(i => i.cardId);
    const uniqueCardIds = Array.from(new Set(cardIds));
    
    const userCards: Card[] = [];
    for (const cardId of uniqueCardIds.slice(0, 10)) {
      const card = await this.getCard(cardId);
      if (card) userCards.push(card);
    }

    const recommendations = new Set<string>();
    for (const card of userCards) {
      const recs = await this.getCardRecommendations(card.id, 'synergy', 3);
      recs.forEach(rec => recommendations.add(rec.recommendedCardId));
    }

    const recommendedCards: Card[] = [];
    for (const cardId of Array.from(recommendations).slice(0, limit)) {
      const card = await this.getCard(cardId);
      if (card) recommendedCards.push(card);
    }

    return recommendedCards;
  }

  async findSynergyCards(sourceCard: Card): Promise<Array<{cardId: string, score: number, reason: string}>> {
    return [];
  }

  async findFunctionallySimilarCards(sourceCard: Card, filters?: any): Promise<Array<{cardId: string, score: number, reason: string}>> {
    return [];
  }

  async createDeck(deck: InsertDeck): Promise<Deck> {
    const [result] = await db.insert(decks).values(deck).returning();
    return result;
  }

  async getUserDecks(userId: number): Promise<Deck[]> {
    return db.select()
      .from(decks)
      .where(eq(decks.userId, userId))
      .orderBy(desc(decks.updatedAt));
  }

  async getDeck(id: number, userId: number): Promise<Deck | null> {
    const [deck] = await db.select()
      .from(decks)
      .where(and(eq(decks.id, id), eq(decks.userId, userId)));
    return deck || null;
  }

  async updateDeck(id: number, userId: number, updates: Partial<InsertDeck>): Promise<Deck | null> {
    const [deck] = await db.update(decks)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(decks.id, id), eq(decks.userId, userId)))
      .returning();
    return deck || null;
  }

  async deleteDeck(id: number, userId: number): Promise<boolean> {
    await db.delete(decks)
      .where(and(eq(decks.id, id), eq(decks.userId, userId)));
    return true;
  }

  async recordRecommendationFeedback(feedback: InsertRecommendationFeedback): Promise<void> {
    await db.insert(recommendationFeedback).values(feedback);
  }

  async getRecommendationWeights(): Promise<{[key: string]: number}> {
    return {
      synergy: 1.0,
      functional_similarity: 0.8,
      theme: 0.9
    };
  }

  async findCardsBySharedThemes(
    sourceCard: Card, 
    sourceThemes: Array<{theme: string, cards: Card[], confidence?: number, description?: string}>, 
    filters?: any
  ): Promise<Array<{card: Card, sharedThemes: Array<{theme: string, confidence: number}>, synergyScore: number, reason: string}>> {
    try {
      const synergies: Array<{card: Card, sharedThemes: Array<{theme: string, confidence: number}>, synergyScore: number, reason: string}> = [];
      const cardThemeMap = new Map<string, Array<{theme: string, confidence: number}>>();
      
      // Extract all theme names from source card
      const sourceThemeNames = sourceThemes.map(t => t.theme);
      
      // Collect all cards from theme groups and track their themes
      console.log(`📋 Processing ${sourceThemes.length} source themes for synergy analysis`);
      for (const themeGroup of sourceThemes) {
        console.log(`  Theme: "${themeGroup.theme}" has ${themeGroup.cards.length} cards`);
        for (const card of themeGroup.cards) {
          if (card.id === sourceCard.id) continue; // Skip source card
          
          if (!cardThemeMap.has(card.id)) {
            cardThemeMap.set(card.id, []);
          }
          
          cardThemeMap.get(card.id)!.push({
            theme: themeGroup.theme,
            confidence: themeGroup.confidence || 50 // Default confidence if not provided
          });
        }
      }
      
      console.log(`📊 Found ${cardThemeMap.size} unique cards across all themes`);
      
      // Calculate synergy scores based on shared themes
      let processedCount = 0;
      let filteredCount = 0;
      
      for (const [cardId, sharedThemes] of Array.from(cardThemeMap.entries())) {
        if (sharedThemes.length === 0) continue;
        
        const card = await this.getCard(cardId);
        if (!card) continue;
        
        processedCount++;
        
        // Apply filters with detailed logging
        if (filters) {
          const matchesFilter = cardMatchesFilters(card, filters);
          if (!matchesFilter) {
            filteredCount++;
            continue;
          }
        }
        
        // Calculate synergy score
        const averageConfidence = sharedThemes.reduce((sum: number, t: any) => sum + t.confidence, 0) / sharedThemes.length;
        const themeOverlap = sharedThemes.length / sourceThemeNames.length;
        const synergyScore = (averageConfidence / 100) * themeOverlap;
        
        // Generate reason
        const themeNames = sharedThemes.map((t: any) => t.theme);
        const reason = `Shares ${sharedThemes.length} theme${sharedThemes.length > 1 ? 's' : ''}: ${themeNames.slice(0, 3).join(', ')}${themeNames.length > 3 ? '...' : ''}`;
        
        synergies.push({
          card,
          sharedThemes,
          synergyScore,
          reason
        });
      }
      
      console.log(`🔍 Processed ${processedCount} cards, filtered out ${filteredCount}, kept ${synergies.length}`);
      
      // Sort by synergy score and theme count
      const finalResults = synergies
        .sort((a, b) => {
          // Primary sort: synergy score
          if (Math.abs(a.synergyScore - b.synergyScore) > 0.1) {
            return b.synergyScore - a.synergyScore;
          }
          // Secondary sort: number of shared themes
          return b.sharedThemes.length - a.sharedThemes.length;
        })
        .slice(0, 50); // Limit results
        
      console.log(`🎯 Final synergy results: ${finalResults.length} cards after filtering and sorting`);
      return finalResults;
        
    } catch (error) {
      console.error('Error finding cards by shared themes:', error);
      return [];
    }
  }

  // Tag system methods
  async getCardTags(cardId: string): Promise<CardTag[]> {
    return await db.select().from(cardTags).where(eq(cardTags.cardId, cardId));
  }

  async createCardTag(tag: InsertCardTag): Promise<CardTag> {
    const [result] = await db.insert(cardTags).values(tag).returning();
    return result;
  }

  async updateCardTagVotes(cardId: string, tag: string, upvotes: number, downvotes: number): Promise<void> {
    await db.update(cardTags)
      .set({ upvotes, downvotes })
      .where(and(eq(cardTags.cardId, cardId), eq(cardTags.tag, tag)));
  }

  async findCardsByTags(tags: string[], filters?: any): Promise<Card[]> {
    const taggedCards = await db.select({ cardId: cardTags.cardId })
      .from(cardTags)
      .where(sql`${cardTags.tag} = ANY(${tags})`);

    const cardIds = taggedCards.map(tc => tc.cardId);
    if (cardIds.length === 0) return [];

    const cards: Card[] = [];
    for (const cardId of cardIds) {
      const card = await this.getCachedCard(cardId);
      if (card && cardMatchesFilters(card, filters)) {
        cards.push(card);
      }
    }
    return cards;
  }

  async getTagRelationships(tag: string): Promise<TagRelationship[]> {
    return await db.select().from(tagRelationships).where(eq(tagRelationships.sourceTag, tag));
  }

  async createTagRelationship(relationship: InsertTagRelationship): Promise<TagRelationship> {
    const [result] = await db.insert(tagRelationships).values(relationship).returning();
    return result;
  }

  async recordUserTagFeedback(feedback: InsertUserTagFeedback): Promise<void> {
    await db.insert(userTagFeedback).values(feedback);
  }
}

export const storage = new DatabaseStorage();