import { Card, SearchFilters, SearchResponse, User, InsertUser, SavedSearch, InsertSavedSearch, FavoriteCard, InsertFavoriteCard, CardCacheEntry, InsertCardCache, SearchCacheEntry, InsertSearchCache } from "@shared/schema";
import { db } from "./db";
import { users, savedSearches, favoriteCards, cardCache, searchCache } from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";
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
      await db
        .insert(cardCache)
        .values({
          id: card.id,
          cardData: card,
        })
        .onConflictDoUpdate({
          target: cardCache.id,
          set: {
            cardData: card,
            lastUpdated: new Date(),
            searchCount: sql`${cardCache.searchCount} + 1`,
          }
        });
      console.log(`Cached card: ${card.name} (${card.id})`);
    } catch (error) {
      console.error('Error caching card:', error, card.id);
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
      
      await db
        .insert(searchCache)
        .values({
          queryHash,
          filters,
          resultData: results,
          page,
        })
        .onConflictDoUpdate({
          target: searchCache.queryHash,
          set: {
            resultData: results,
            lastAccessed: new Date(),
            accessCount: sql`${searchCache.accessCount} + 1`,
          }
        });
      console.log(`Cached search results: ${results.data.length} cards for query hash ${queryHash}`);
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
      const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      
      // Clean up old search cache (keep frequently accessed ones longer)
      await db
        .delete(searchCache)
        .where(sql`${searchCache.lastAccessed} < ${cutoffDate} AND ${searchCache.accessCount} < 5`);
      
      // Clean up old card cache (keep frequently searched ones)
      await db
        .delete(cardCache)
        .where(sql`${cardCache.lastUpdated} < ${cutoffDate} AND ${cardCache.searchCount} < 3`);
      
      console.log('Cache cleanup completed');
    } catch (error) {
      console.error('Error during cache cleanup:', error);
    }
  }
}

export const storage = new DatabaseStorage();
