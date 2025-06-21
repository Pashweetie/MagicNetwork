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
  private readonly BASE_URL = 'https://json.edhrec.com/pages/commanders';
  private cache = new Map<string, { data: EdhrecRecommendations; timestamp: number }>();
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  private normalizeCommanderName(name: string): string {
    // EDHREC expects commander names in lowercase with no symbols and dashes instead of spaces
    return name.toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove all symbols
      .replace(/\s+/g, '-') // Replace spaces with dashes
      .replace(/-+/g, '-') // Replace multiple dashes with single
      .replace(/^-|-$/g, ''); // Remove leading/trailing dashes
  }

  private async fetchEdhrecData(commanderName: string): Promise<any> {
    try {
      const normalizedName = this.normalizeCommanderName(commanderName);
      const url = `${this.BASE_URL}/${normalizedName}.json`;
      
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
      const edhrecData = await this.fetchEdhrecData(commander.name);
      const recommendations = this.formatEdhrecData(edhrecData, commander);

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
        name: card.name || card.card_name || '',
        url: card.url || `https://edhrec.com/cards/${encodeURIComponent((card.name || card.card_name || '').toLowerCase().replace(/\s+/g, '-'))}`,
        num_decks: card.num_decks || card.decks || card.percentage || 0,
        synergy: card.synergy || card.score || card.synergy_score || 0,
        price: card.price || card.usd || card.price_usd || 0,
        color_identity: card.color_identity || [],
        type_line: card.type_line || card.type || card.type_raw || '',
        cmc: card.cmc || card.mana_cost || card.converted_mana_cost || 0,
        oracle_text: card.oracle_text || card.text || card.oracle
      }));
    };

    // Extract card recommendations from EDHREC JSON structure
    const cardSections = data.container?.json_dict?.cardlists || data.cardlists || [];
    const cardsByType: { [key: string]: EdhrecCard[] } = {
      creatures: [],
      instants: [],
      sorceries: [],
      artifacts: [],
      enchantments: [],
      planeswalkers: [],
      lands: []
    };

    // Process each card section
    cardSections.forEach((section: any) => {
      const sectionName = (section.tag || section.header || '').toLowerCase();
      const sectionCards = formatCards(section.cardviews || section.cards || []);

      if (sectionName.includes('creature')) {
        cardsByType.creatures.push(...sectionCards);
      } else if (sectionName.includes('instant')) {
        cardsByType.instants.push(...sectionCards);
      } else if (sectionName.includes('sorcery')) {
        cardsByType.sorceries.push(...sectionCards);
      } else if (sectionName.includes('artifact')) {
        cardsByType.artifacts.push(...sectionCards);
      } else if (sectionName.includes('enchantment')) {
        cardsByType.enchantments.push(...sectionCards);
      } else if (sectionName.includes('planeswalker')) {
        cardsByType.planeswalkers.push(...sectionCards);
      } else if (sectionName.includes('land')) {
        cardsByType.lands.push(...sectionCards);
      } else {
        // For sections without clear type, distribute cards based on first letter or add to creatures
        cardsByType.creatures.push(...sectionCards.slice(0, 10));
      }
    });
    
    return {
      commander: commander.name,
      total_decks: data.container?.json_dict?.num_decks || data.num_decks || 0,
      updated_at: new Date().toISOString(),
      cards: cardsByType,
      themes: [] // EDHREC themes would need separate parsing if available
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