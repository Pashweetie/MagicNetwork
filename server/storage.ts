import { Card, SearchFilters, SearchResponse, User, InsertUser, SavedSearch, InsertSavedSearch, FavoriteCard, InsertFavoriteCard } from "@shared/schema";
import { db } from "./db";
import { users, savedSearches, favoriteCards } from "@shared/schema";
import { eq } from "drizzle-orm";

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
}

export class DatabaseStorage implements IStorage {
  // Cache for storing recent search results
  private searchCache: Map<string, { result: SearchResponse; timestamp: number }> = new Map();
  private cardCache: Map<string, { card: Card; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  private getCacheKey(filters: SearchFilters, page: number): string {
    return JSON.stringify({ filters, page });
  }

  private isExpired(timestamp: number): boolean {
    return Date.now() - timestamp > this.CACHE_TTL;
  }

  async searchCards(filters: SearchFilters, page: number = 1): Promise<SearchResponse> {
    const cacheKey = this.getCacheKey(filters, page);
    const cached = this.searchCache.get(cacheKey);
    
    if (cached && !this.isExpired(cached.timestamp)) {
      return cached.result;
    }

    // For now, return empty results since we're using Scryfall service
    // In future, this could cache popular searches in the database
    const result: SearchResponse = {
      data: [],
      has_more: false,
      total_cards: 0,
    };

    this.searchCache.set(cacheKey, { result, timestamp: Date.now() });
    return result;
  }

  async getCard(id: string): Promise<Card | null> {
    const cached = this.cardCache.get(id);
    
    if (cached && !this.isExpired(cached.timestamp)) {
      return cached.card;
    }

    return null;
  }

  async getRandomCard(): Promise<Card> {
    throw new Error("Random card not implemented in database storage");
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
      .values(search)
      .returning();
    return savedSearch;
  }

  async deleteSavedSearch(id: number, userId: number): Promise<boolean> {
    const result = await db
      .delete(savedSearches)
      .where(eq(savedSearches.id, id) && eq(savedSearches.userId, userId));
    return result.rowCount > 0;
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
      .values(favorite)
      .returning();
    return favoriteCard;
  }

  async removeFavoriteCard(cardId: string, userId: number): Promise<boolean> {
    const result = await db
      .delete(favoriteCards)
      .where(eq(favoriteCards.cardId, cardId) && eq(favoriteCards.userId, userId));
    return result.rowCount > 0;
  }
}

export const storage = new DatabaseStorage();
