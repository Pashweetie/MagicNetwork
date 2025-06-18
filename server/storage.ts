import { Card, SearchFilters, SearchResponse } from "@shared/schema";

export interface IStorage {
  // Keep existing user methods if needed for future features
  searchCards(filters: SearchFilters, page: number): Promise<SearchResponse>;
  getCard(id: string): Promise<Card | null>;
  getRandomCard(): Promise<Card>;
}

export class MemStorage implements IStorage {
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

    // In a real implementation, this would call the Scryfall service
    // For now, return empty results since we're integrating with the actual API
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

    // In a real implementation, this would call the Scryfall service
    return null;
  }

  async getRandomCard(): Promise<Card> {
    // In a real implementation, this would call the Scryfall service
    throw new Error("Random card not implemented in memory storage");
  }
}

export const storage = new MemStorage();
