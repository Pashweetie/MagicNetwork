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
  private readonly BASE_URL = 'https://edhrec.com';
  private cache = new Map<string, { data: EdhrecRecommendations; timestamp: number }>();
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  private normalizeCommanderName(name: string): string {
    // EDHREC expects commander names in lowercase with specific formatting for URLs
    return name.toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special characters except hyphens
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
  }

  private async fetchCommanderPage(commanderName: string): Promise<string> {
    try {
      const normalizedName = this.normalizeCommanderName(commanderName);
      const url = `${this.BASE_URL}/commanders/${normalizedName}`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MTG-Deck-Builder/1.0)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (!response.ok) {
        throw new Error(`EDHREC page error: ${response.status} ${response.statusText}`);
      }

      return await response.text();
    } catch (error) {
      console.error('Error fetching EDHREC page:', error);
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
      const pageContent = await this.fetchCommanderPage(commander.name);
      const recommendations = this.parseEdhrecPage(pageContent, commander);

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

  private parseEdhrecPage(html: string, commander: Card): EdhrecRecommendations | null {
    try {
      // Look for JSON data embedded in the page (many sites embed data this way)
      const jsonDataMatch = html.match(/window\.__NEXT_DATA__\s*=\s*({.*?})\s*<\/script>/s) ||
                          html.match(/"props":\s*({.*?"pageProps".*?})/s) ||
                          html.match(/data-initial-props="([^"]*)"/) ||
                          html.match(/var\s+cardData\s*=\s*({.*?});/s);

      if (jsonDataMatch) {
        try {
          const jsonStr = jsonDataMatch[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&');
          const data = JSON.parse(jsonStr);
          
          // Try to extract card recommendations from the parsed data
          if (data.pageProps?.initialData?.recommendations) {
            return this.formatEdhrecData(data.pageProps.initialData, commander);
          }
          
          if (data.props?.pageProps?.recommendations) {
            return this.formatEdhrecData(data.props.pageProps, commander);
          }
        } catch (parseError) {
          console.log('Failed to parse embedded JSON data');
        }
      }

      // Fallback: try to extract card names from HTML structure
      const cardMatches = html.match(/data-card-name="([^"]+)"/g) || [];
      const cardNames = cardMatches.map(match => 
        match.replace('data-card-name="', '').replace('"', '')
      );

      if (cardNames.length > 0) {
        return this.createRecommendationsFromNames(cardNames, commander);
      }

      return null;
    } catch (error) {
      console.error('Error parsing EDHREC page:', error);
      return null;
    }
  }

  private createRecommendationsFromNames(cardNames: string[], commander: Card): EdhrecRecommendations {
    const cards = cardNames.map(name => ({
      name,
      url: `https://edhrec.com/cards/${encodeURIComponent(name.toLowerCase().replace(/\s+/g, '-'))}`,
      num_decks: 1000, // Default placeholder
      synergy: 50,     // Default placeholder
      price: 0,        // Default placeholder
      color_identity: [],
      type_line: 'Unknown',
      cmc: 0
    }));

    // Categorize cards by type (simple heuristic based on name patterns)
    const creatures = cards.filter(c => this.isLikelyCreature(c.name));
    const instants = cards.filter(c => this.isLikelyInstant(c.name));
    const sorceries = cards.filter(c => this.isLikelySorcery(c.name));
    const artifacts = cards.filter(c => this.isLikelyArtifact(c.name));
    const enchantments = cards.filter(c => this.isLikelyEnchantment(c.name));
    const lands = cards.filter(c => this.isLikelyLand(c.name));
    const remaining = cards.filter(c => 
      !creatures.includes(c) && !instants.includes(c) && !sorceries.includes(c) &&
      !artifacts.includes(c) && !enchantments.includes(c) && !lands.includes(c)
    );

    return {
      commander: commander.name,
      total_decks: 5000,
      updated_at: new Date().toISOString(),
      cards: {
        creatures: creatures.slice(0, 15),
        instants: instants.slice(0, 10),
        sorceries: sorceries.slice(0, 10),
        artifacts: artifacts.slice(0, 10),
        enchantments: enchantments.slice(0, 10),
        planeswalkers: [],
        lands: lands.slice(0, 10)
      },
      themes: []
    };
  }

  private isLikelyCreature(name: string): boolean {
    const lowerName = name.toLowerCase();
    return /\b(creature|beast|dragon|angel|demon|spirit|elemental|wizard|warrior|knight|soldier)\b/.test(lowerName);
  }

  private isLikelyInstant(name: string): boolean {
    const lowerName = name.toLowerCase();
    return /\b(bolt|shock|path|counter|response|protection|pump)\b/.test(lowerName);
  }

  private isLikelySorcery(name: string): boolean {
    const lowerName = name.toLowerCase();
    return /\b(draw|tutor|search|wrath|board|clear|ramp)\b/.test(lowerName);
  }

  private isLikelyArtifact(name: string): boolean {
    const lowerName = name.toLowerCase();
    return /\b(mana|rock|equipment|sword|hammer|ring|crown|throne|vault|forge)\b/.test(lowerName);
  }

  private isLikelyEnchantment(name: string): boolean {
    const lowerName = name.toLowerCase();
    return /\b(aura|curse|blessing|bond|pact|oath|vow)\b/.test(lowerName);
  }

  private isLikelyLand(name: string): boolean {
    const lowerName = name.toLowerCase();
    return /\b(land|island|mountain|forest|plains|swamp|gate|shore|peak|grove)\b/.test(lowerName);
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