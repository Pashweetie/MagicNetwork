import { db } from "./db";
import { cardCache, searchCache, users, cardThemes, themeVotes, decks, userDecks } from "@shared/schema";
import { Card, SearchFilters, SearchResponse, User, InsertUser, Deck, InsertDeck, UserDeck, InsertUserDeck, DeckEntry, CardTheme, InsertCardTheme, ThemeVote, InsertThemeVote } from "@shared/schema";
import { eq, sql, and, desc, asc, inArray, or } from "drizzle-orm";
import crypto from "crypto";
import { scryfallService } from "./services/scryfall";
import { cardMatchesFilters } from "./utils/card-filters";

export interface IStorage {
  // Card search methods
  searchCards(filters: SearchFilters, page: number): Promise<SearchResponse>;
  getCard(id: string): Promise<Card | null>;
  getRandomCard(): Promise<Card>;
  
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(insertUser: InsertUser): Promise<User>;
  
  // Cache management
  cacheCard(card: Card): Promise<void>;
  getCachedCard(id: string): Promise<Card | null>;
  cacheSearchResults(filters: SearchFilters, page: number, results: SearchResponse): Promise<void>;
  getCachedSearchResults(filters: SearchFilters, page: number): Promise<SearchResponse | null>;
  cleanupOldCache(): Promise<void>;
  
  // Simplified theme system
  getCardThemes(cardId: string): Promise<CardTheme[]>;
  createCardTheme(theme: InsertCardTheme): Promise<CardTheme>;
  
  // Deck persistence
  createDeck(deck: InsertDeck): Promise<Deck>;
  getUserDecks(userId: number): Promise<Deck[]>;
  getDeck(id: number, userId: number): Promise<Deck | null>;
  updateDeck(id: number, userId: number, updates: Partial<InsertDeck>): Promise<Deck | null>;
  deleteDeck(id: number, userId: number): Promise<boolean>;
  
  // User deck management (one deck per user)
  getUserDeck(userId: string): Promise<{ deck: UserDeck | null, entries: DeckEntry[], commander?: Card }>;
  saveUserDeck(userId: string, deckData: Partial<InsertUserDeck>): Promise<UserDeck>;
  
  // Deck import functionality
  importDeckFromText(userId: string, deckText: string, format?: string): Promise<{ success: boolean, message: string, importedCards: number, failedCards: string[] }>;

}

export class DatabaseStorage implements IStorage {
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours for card cache
  private readonly SEARCH_CACHE_TTL = 60 * 60 * 1000; // 1 hour for search cache

  private generateQueryHash(filters: SearchFilters, page: number): string {
    const queryString = JSON.stringify({ filters, page });
    return crypto.createHash('md5').update(queryString).digest('hex');
  }

  async searchCards(filters: SearchFilters, page: number = 1): Promise<SearchResponse> {
    try {
      // Check cache first
      const cachedResult = await this.getCachedSearchResults(filters, page);
      if (cachedResult) {
        return cachedResult;
      }

      // Use Scryfall service for live search
      const result = await scryfallService.searchCards(filters, page);
      
      // Cache cards individually
      for (const card of result.data) {
        await this.cacheCard(card);
      }
      
      // Cache search results
      await this.cacheSearchResults(filters, page, result);
      
      return result;
    } catch (error) {
      console.error('Search error:', error);
      throw error;
    }
  }

  async getCard(id: string): Promise<Card | null> {
    try {
      // Try cache first
      const cached = await this.getCachedCard(id);
      if (cached) {
        return cached;
      }
      
      // Fetch from Scryfall
      const card = await scryfallService.getCard(id);
      if (card) {
        await this.cacheCard(card);
      }
      
      return card;
    } catch (error) {
      console.error('Get card error:', error);
      return null;
    }
  }

  async getRandomCard(): Promise<Card> {
    try {
      const card = await scryfallService.getRandomCard();
      await this.cacheCard(card);
      return card;
    } catch (error) {
      console.error('Random card error:', error);
      throw error;
    }
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, parseInt(id))).limit(1);
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async cacheCard(card: Card): Promise<void> {
    try {
      await db.insert(cardCache)
        .values({
          id: card.id,
          cardData: card,
          lastUpdated: new Date(),
          searchCount: 1
        })
        .onConflictDoUpdate({
          target: cardCache.id,
          set: {
            cardData: card,
            lastUpdated: new Date(),
            searchCount: sql`${cardCache.searchCount} + 1`
          }
        });
    } catch (error) {
      console.error('Cache card error:', error);
    }
  }

  async getCachedCard(id: string): Promise<Card | null> {
    try {
      const [cached] = await db.select()
        .from(cardCache)
        .where(eq(cardCache.id, id))
        .limit(1);
      
      if (cached && (Date.now() - cached.lastUpdated.getTime()) < this.CACHE_TTL) {
        return cached.cardData;
      }
      
      return null;
    } catch (error) {
      console.error('Get cached card error:', error);
      return null;
    }
  }

  async cacheSearchResults(filters: SearchFilters, page: number, results: SearchResponse): Promise<void> {
    try {
      const queryHash = this.generateQueryHash(filters, page);
      await db.insert(searchCache)
        .values({
          queryHash,
          query: JSON.stringify({ filters, page }),
          results,
          createdAt: new Date(),
          lastAccessed: new Date(),
          accessCount: 1
        })
        .onConflictDoUpdate({
          target: searchCache.queryHash,
          set: {
            results,
            lastAccessed: new Date(),
            accessCount: sql`${searchCache.accessCount} + 1`
          }
        });
    } catch (error) {
      console.error('Cache search results error:', error);
    }
  }

  async getCachedSearchResults(filters: SearchFilters, page: number): Promise<SearchResponse | null> {
    try {
      const queryHash = this.generateQueryHash(filters, page);
      const [cached] = await db.select()
        .from(searchCache)
        .where(eq(searchCache.queryHash, queryHash))
        .limit(1);
      
      if (cached && (Date.now() - cached.lastAccessed.getTime()) < this.SEARCH_CACHE_TTL) {
        // Update access time
        await db.update(searchCache)
          .set({ lastAccessed: new Date() })
          .where(eq(searchCache.queryHash, queryHash));
        
        return cached.results;
      }
      
      return null;
    } catch (error) {
      console.error('Get cached search results error:', error);
      return null;
    }
  }

  async cleanupOldCache(): Promise<void> {
    try {
      const cutoff = new Date(Date.now() - this.CACHE_TTL);
      await db.delete(cardCache)
        .where(sql`${cardCache.lastUpdated} < ${cutoff}`);
      
      const searchCutoff = new Date(Date.now() - this.SEARCH_CACHE_TTL);
      await db.delete(searchCache)
        .where(sql`${searchCache.lastAccessed} < ${searchCutoff}`);
    } catch (error) {
      console.error('Cleanup cache error:', error);
    }
  }



  async getCardRecommendations(cardId: string, type: 'synergy' | 'functional_similarity', limit: number = 10, filters?: any): Promise<CardRecommendation[]> {
    return db.select()
      .from(cardRecommendations)
      .where(and(
        eq(cardRecommendations.sourceCardId, cardId),
        eq(cardRecommendations.recommendationType, type)
      ))
      .orderBy(desc(cardRecommendations.score))
      .limit(limit);
  }

  async recordRecommendationFeedback(feedback: InsertRecommendationFeedback): Promise<void> {
    try {
      await db.insert(recommendationFeedback).values(feedback);
    } catch (error) {
      console.error('Record recommendation feedback error:', error);
    }
  }

  async getRecommendationWeights(): Promise<{[key: string]: number}> {
    // Simple implementation - in practice this would analyze feedback
    return {
      'synergy': 1.0,
      'functional_similarity': 0.8,
      'theme': 0.9
    };
  }

  // Simplified method - remove complex implementation
  async findCardsBySharedThemes(): Promise<any[]> {
    return [];
  }

  // Remove complex synergy methods - replaced by new algorithm
  async findSynergyCards(): Promise<any[]> {
    return [];
  }

  async findFunctionallySimilarCards(): Promise<any[]> {
    return [];
  }

  async getCardThemes(cardId: string): Promise<CardTheme[]> {
    return db.select()
      .from(cardThemes)
      .where(eq(cardThemes.card_id, cardId))
      .orderBy(desc(cardThemes.confidence));
  }

  async createCardTheme(theme: InsertCardTheme): Promise<CardTheme> {
    const [result] = await db.insert(cardThemes).values(theme).returning();
    return result;
  }

  // Remove old voting method - replaced by new themeVotes table
  async updateCardThemeVotes(): Promise<void> {}

  async findCardsByThemes(themes: string[], filters?: any): Promise<Card[]> {
    if (themes.length === 0) return [];
    
    const cardIds = await db.select({ 
      cardId: cardThemes.card_id,
      avgScore: sql<number>`AVG(${cardThemes.confidence})`.as('avg_score')
    })
      .from(cardThemes)
      .where(inArray(cardThemes.theme_name, themes))
      .groupBy(cardThemes.card_id)
      .orderBy(desc(sql`AVG(${cardThemes.confidence})`));
    
    if (cardIds.length === 0) return [];
    
    const cachedCards = await db.select()
      .from(cardCache)
      .where(inArray(cardCache.id, cardIds.map(c => c.cardId)));
    
    let cards = cachedCards.map(c => c.cardData);
    
    if (filters) {
      cards = cards.filter(card => cardMatchesFilters(card, filters));
    }
    
    return cards;
  }



  // Remove old feedback methods - simplified system
  async recordUserThemeFeedback(): Promise<void> {}
  async recordCardThemeFeedback(): Promise<void> {}

  async calculateThemeSynergyScore(): Promise<{score: number, reason: string}> {
    return { score: 0, reason: "Use new synergy algorithm" };
  }
