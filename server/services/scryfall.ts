import { Card, SearchFilters, SearchResponse } from "@shared/schema";

const SCRYFALL_API_BASE = "https://api.scryfall.com";

export class ScryfallService {
  private buildSearchQuery(filters: SearchFilters): string {
    const parts: string[] = [];
    
    if (filters.query) {
      parts.push(filters.query);
    }
    
    if (filters.colors && filters.colors.length > 0) {
      if (filters.includeMulticolored) {
        parts.push(`c>=${filters.colors.join('')}`);
      } else {
        parts.push(`c:${filters.colors.join('')}`);
      }
    }
    
    if (filters.types && filters.types.length > 0) {
      filters.types.forEach(type => {
        parts.push(`t:${type}`);
      });
    }
    
    if (filters.rarities && filters.rarities.length > 0) {
      const rarityQuery = filters.rarities.map(r => `r:${r}`).join(' OR ');
      parts.push(`(${rarityQuery})`);
    }
    
    if (filters.format) {
      parts.push(`f:${filters.format}`);
    }
    
    if (filters.minMv !== undefined) {
      parts.push(`mv>=${filters.minMv}`);
    }
    
    if (filters.maxMv !== undefined) {
      parts.push(`mv<=${filters.maxMv}`);
    }
    
    return parts.join(' ');
  }

  async searchCards(filters: SearchFilters, page: number = 1): Promise<SearchResponse> {
    const query = this.buildSearchQuery(filters);
    const searchParams = new URLSearchParams({
      q: query || '*',
      page: page.toString(),
      format: 'json',
      include_extras: 'false',
      include_variations: 'false',
    });

    const response = await fetch(`${SCRYFALL_API_BASE}/cards/search?${searchParams}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return {
          data: [],
          has_more: false,
          total_cards: 0,
        };
      }
      throw new Error(`Scryfall API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      data: data.data || [],
      has_more: data.has_more || false,
      next_page: data.next_page,
      total_cards: data.total_cards,
    };
  }

  async getCard(id: string): Promise<Card | null> {
    const response = await fetch(`${SCRYFALL_API_BASE}/cards/${id}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Scryfall API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  async getRandomCard(): Promise<Card> {
    const response = await fetch(`${SCRYFALL_API_BASE}/cards/random`);
    
    if (!response.ok) {
      throw new Error(`Scryfall API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }
}

export const scryfallService = new ScryfallService();
