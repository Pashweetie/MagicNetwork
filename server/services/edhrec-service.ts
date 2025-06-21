import { Card } from '@shared/schema';
import { exec } from 'child_process';
import { promisify } from 'util';

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
  private cache = new Map<string, { data: EdhrecRecommendations; createdAt: number; lastAccessed: number }>();
  private readonly CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
  private readonly CLEANUP_INTERVAL = 60 * 60 * 1000; // Clean up every hour
  private requestQueue: Map<string, Promise<any>> = new Map(); // Prevent duplicate requests
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanupTimer();
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredEntries();
    }, this.CLEANUP_INTERVAL);
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.lastAccessed > this.CACHE_TTL) {
        this.cache.delete(key);
      }
    }
  }

  private normalizeCommanderName(name: string): string {
    // EDHREC expects commander names in lowercase with no symbols and dashes instead of spaces
    // Handle double-faced cards by taking the first part
    const mainName = name.split(' // ')[0];
    
    return mainName.toLowerCase()
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
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'application/json',
          'Referer': 'https://edhrec.com/',
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
    const now = Date.now();

    // Check cache first and update last accessed time
    const cached = this.cache.get(cacheKey);
    if (cached && now - cached.lastAccessed < this.CACHE_TTL) {
      // Update last accessed time to extend the cache life
      cached.lastAccessed = now;
      return cached.data;
    }

    // Check if request is already in progress to prevent duplicate API calls
    if (this.requestQueue.has(cacheKey)) {
      return await this.requestQueue.get(cacheKey);
    }

    try {
      // Create a promise for this request to prevent duplicates
      const requestPromise = this.fetchCommanderData(commander);
      this.requestQueue.set(cacheKey, requestPromise);

      const recommendations = await requestPromise;
      
      // Remove from queue and cache result
      this.requestQueue.delete(cacheKey);
      
      if (recommendations) {
        this.cache.set(cacheKey, {
          data: recommendations,
          createdAt: now,
          lastAccessed: now
        });
        return recommendations;
      }

      return null;
    } catch (error) {
      console.error('Error getting EDHREC recommendations:', error);
      this.requestQueue.delete(cacheKey);
      return null;
    }
  }

  private async fetchCommanderData(commander: Card): Promise<EdhrecRecommendations | null> {
    try {
      // Since EDHREC blocks direct API access, we'll use a shell command approach
      const execAsync = promisify(exec);

      const normalizedName = this.normalizeCommanderName(commander.name);
      const url = `${this.BASE_URL}/${normalizedName}.json`;
      
      const curlCommand = `curl -s -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" -H "Referer: https://edhrec.com/" "${url}"`;
      
      const { stdout, stderr } = await execAsync(curlCommand);
      
      if (stderr && stderr.trim()) {
        throw new Error(`Curl error: ${stderr}`);
      }

      if (!stdout || stdout.trim() === '') {
        throw new Error('Empty response from EDHREC');
      }

      const edhrecData = JSON.parse(stdout);
      
      if (!edhrecData || !edhrecData.container || !edhrecData.container.json_dict) {
        throw new Error('Invalid EDHREC response format');
      }

      return this.formatEdhrecData(edhrecData, commander);
    } catch (error) {
      console.error('Error fetching EDHREC data:', error);
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

    const extractThemes = (data: any): Array<{name: string, url: string, num_decks: number, cards: EdhrecCard[]}> => {
      const themes: Array<{name: string, url: string, num_decks: number, cards: EdhrecCard[]}> = [];
      
      // Look for theme sections in the data
      const cardlists = data.container?.json_dict?.cardlists || data.cardlists || [];
      
      cardlists.forEach((section: any) => {
        const sectionName = section.tag || section.header || '';
        if (sectionName && !['creatures', 'instants', 'sorceries', 'artifacts', 'enchantments', 'planeswalkers', 'lands'].includes(sectionName.toLowerCase())) {
          // This might be a theme section
          themes.push({
            name: sectionName,
            url: `https://edhrec.com/themes/${encodeURIComponent(sectionName.toLowerCase().replace(/\s+/g, '-'))}`,
            num_decks: section.num_decks || 0,
            cards: formatCards(section.cardviews || section.cards || []).slice(0, 20) // Limit theme cards to 20
          });
        }
      });
      
      return themes;
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

    // Process each card section with increased limits
    cardSections.forEach((section: any) => {
      const sectionName = (section.tag || section.header || '').toLowerCase();
      const sectionCards = formatCards(section.cardviews || section.cards || []);

      if (sectionName.includes('creature')) {
        cardsByType.creatures.push(...sectionCards.slice(0, 60)); // Increased from default
      } else if (sectionName.includes('instant')) {
        cardsByType.instants.push(...sectionCards.slice(0, 40));
      } else if (sectionName.includes('sorcery')) {
        cardsByType.sorceries.push(...sectionCards.slice(0, 40));
      } else if (sectionName.includes('artifact')) {
        cardsByType.artifacts.push(...sectionCards.slice(0, 40));
      } else if (sectionName.includes('enchantment')) {
        cardsByType.enchantments.push(...sectionCards.slice(0, 40));
      } else if (sectionName.includes('planeswalker')) {
        cardsByType.planeswalkers.push(...sectionCards.slice(0, 20));
      } else if (sectionName.includes('land')) {
        cardsByType.lands.push(...sectionCards.slice(0, 50));
      } else {
        // These might be theme sections - add to creatures but limit
        cardsByType.creatures.push(...sectionCards.slice(0, 15));
      }
    });

    // Extract themes from the data
    const themes = extractThemes(data);
    
    return {
      commander: commander.name,
      total_decks: data.container?.json_dict?.num_decks || data.num_decks || 0,
      updated_at: new Date().toISOString(),
      cards: cardsByType,
      themes: themes
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

  getCacheStats(): { size: number; keys: string[]; totalCachedCards: number } {
    let totalCards = 0;
    for (const entry of this.cache.values()) {
      const cards = entry.data.cards;
      totalCards += cards.creatures.length + cards.instants.length + cards.sorceries.length + 
                   cards.artifacts.length + cards.enchantments.length + cards.planeswalkers.length + cards.lands.length;
    }
    
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      totalCachedCards: totalCards
    };
  }

  // Cleanup timer management
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.cache.clear();
    this.requestQueue.clear();
  }
}

export const edhrecService = new EdhrecService();