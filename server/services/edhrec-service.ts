import { Card } from '@shared/schema';

export interface EdhrecCard {
  name: string;
  url: string;
  num_decks: number;
  synergy: number;
  price: number;
  color_identity: string[];
  type_line: string;
  cmc: number;
  oracle_text?: string;
}

export interface EdhrecRecommendations {
  commander: string;
  total_decks: number;
  updated_at: string;
  cards: {
    creatures: EdhrecCard[];
    instants: EdhrecCard[];
    sorceries: EdhrecCard[];
    artifacts: EdhrecCard[];
    enchantments: EdhrecCard[];
    planeswalkers: EdhrecCard[];
    lands: EdhrecCard[];
  };
  themes: Array<{
    name: string;
    url: string;
    num_decks: number;
    cards: EdhrecCard[];
  }>;
}

export class EdhrecService {
  private readonly BASE_URL = 'https://api.edhrec.com/v1';
  private cache = new Map<string, { data: EdhrecRecommendations; timestamp: number }>();
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  private normalizeCommanderName(name: string): string {
    // EDHREC expects commander names in lowercase with specific formatting
    return name.toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special characters except hyphens
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
  }

  private async fetchFromEdhrec(url: string): Promise<any> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'MTG-Deck-Builder/1.0',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`EDHREC API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching from EDHREC:', error);
      throw error;
    }
  }

  async getCommanderRecommendations(commander: Card): Promise<EdhrecRecommendations | null> {
    const commanderName = this.normalizeCommanderName(commander.name);
    const cacheKey = `commander:${commanderName}`;

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    try {
      // Try different EDHREC endpoints
      const endpoints = [
        `/commanders/${commanderName}`,
        `/recs/${commanderName}`,
        `/cards/${commanderName}`
      ];

      let recommendations: EdhrecRecommendations | null = null;

      for (const endpoint of endpoints) {
        try {
          const url = `${this.BASE_URL}${endpoint}`;
          const data = await this.fetchFromEdhrec(url);
          
          if (data && (data.cards || data.recommendations)) {
            recommendations = this.formatEdhrecData(data, commander);
            break;
          }
        } catch (error) {
          console.log(`Failed to fetch from ${endpoint}, trying next...`);
          continue;
        }
      }

      if (recommendations) {
        // Cache the result
        this.cache.set(cacheKey, {
          data: recommendations,
          timestamp: Date.now()
        });
        return recommendations;
      }

      return null;
    } catch (error) {
      console.error('Error getting EDHREC recommendations:', error);
      return null;
    }
  }

  private formatEdhrecData(data: any, commander: Card): EdhrecRecommendations {
    const formatCards = (cards: any[]): EdhrecCard[] => {
      if (!Array.isArray(cards)) return [];
      
      return cards.map(card => ({
        name: card.name || '',
        url: card.url || `https://edhrec.com/cards/${encodeURIComponent(card.name || '')}`,
        num_decks: card.num_decks || card.decks || 0,
        synergy: card.synergy || card.score || 0,
        price: card.price || card.usd || 0,
        color_identity: card.color_identity || [],
        type_line: card.type_line || card.type || '',
        cmc: card.cmc || card.mana_cost || 0,
        oracle_text: card.oracle_text || card.text
      }));
    };

    const cards = data.cards || data.recommendations || {};
    
    return {
      commander: commander.name,
      total_decks: data.total_decks || data.num_decks || 0,
      updated_at: new Date().toISOString(),
      cards: {
        creatures: formatCards(cards.creatures || []),
        instants: formatCards(cards.instants || []),
        sorceries: formatCards(cards.sorceries || []),
        artifacts: formatCards(cards.artifacts || []),
        enchantments: formatCards(cards.enchantments || []),
        planeswalkers: formatCards(cards.planeswalkers || []),
        lands: formatCards(cards.lands || [])
      },
      themes: (data.themes || []).map((theme: any) => ({
        name: theme.name || '',
        url: theme.url || '',
        num_decks: theme.num_decks || 0,
        cards: formatCards(theme.cards || [])
      }))
    };
  }

  async searchEdhrecCard(cardName: string): Promise<EdhrecCard | null> {
    try {
      const normalizedName = this.normalizeCommanderName(cardName);
      const url = `${this.BASE_URL}/cards/${normalizedName}`;
      const data = await this.fetchFromEdhrec(url);
      
      if (data && data.card) {
        return {
          name: data.card.name || cardName,
          url: data.card.url || `https://edhrec.com/cards/${encodeURIComponent(cardName)}`,
          num_decks: data.card.num_decks || 0,
          synergy: data.card.synergy || 0,
          price: data.card.price || 0,
          color_identity: data.card.color_identity || [],
          type_line: data.card.type_line || '',
          cmc: data.card.cmc || 0,
          oracle_text: data.card.oracle_text
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error searching EDHREC card:', error);
      return null;
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

export const edhrecService = new EdhrecService();