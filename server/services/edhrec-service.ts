import { Card } from '@shared/schema';
import { exec } from 'child_process';
import { promisify } from 'util';
import { storage } from '../storage';

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
    creatures: Array<Card & {edhrec_rank: number, edhrec_synergy: number, edhrec_url: string}>;
    instants: Array<Card & {edhrec_rank: number, edhrec_synergy: number, edhrec_url: string}>;
    sorceries: Array<Card & {edhrec_rank: number, edhrec_synergy: number, edhrec_url: string}>;
    artifacts: Array<Card & {edhrec_rank: number, edhrec_synergy: number, edhrec_url: string}>;
    enchantments: Array<Card & {edhrec_rank: number, edhrec_synergy: number, edhrec_url: string}>;
    planeswalkers: Array<Card & {edhrec_rank: number, edhrec_synergy: number, edhrec_url: string}>;
    lands: Array<Card & {edhrec_rank: number, edhrec_synergy: number, edhrec_url: string}>;
  };
  themes: Array<{
    name: string;
    url: string;
    num_decks: number;
    cards: Array<Card & {edhrec_rank: number, edhrec_synergy: number, edhrec_url: string}>;
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
      const normalizedName = this.normalizeCommanderName(commander.name);
      const url = `${this.BASE_URL}/${normalizedName}.json`;
      
      console.log(`Fetching EDHREC data for: ${commander.name} (${normalizedName})`);
      
      // Try direct fetch first
      let edhrecData;
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json',
            'Referer': 'https://edhrec.com/',
            'Cache-Control': 'no-cache'
          },
          signal: AbortSignal.timeout(30000) // 30 second timeout
        });

        if (response.ok) {
          edhrecData = await response.json();
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (fetchError) {
        console.log('Direct fetch failed, trying curl fallback:', fetchError);
        
        // Fallback to curl if direct fetch fails
        const execAsync = promisify(exec);
        const curlCommand = `timeout 30 curl -s -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" -H "Referer: https://edhrec.com/" "${url}"`;
        
        try {
          const { stdout, stderr } = await execAsync(curlCommand);
          
          if (stderr && stderr.trim()) {
            throw new Error(`Curl error: ${stderr}`);
          }

          if (!stdout || stdout.trim() === '') {
            throw new Error('Empty response from EDHREC');
          }

          edhrecData = JSON.parse(stdout);
        } catch (curlError) {
          console.error('Both fetch and curl failed:', curlError);
          return null;
        }
      }
      
      if (!edhrecData || !edhrecData.container || !edhrecData.container.json_dict) {
        console.error('Invalid EDHREC response format:', Object.keys(edhrecData || {}));
        return null;
      }

      return await this.formatEdhrecData(edhrecData, commander);
    } catch (error) {
      console.error('Error fetching EDHREC data:', error);
      return null;
    }
  }



  private async formatEdhrecData(data: any, commander: Card): Promise<EdhrecRecommendations> {
    const formatCards = (cards: any[]): Array<{name: string, num_decks: number, synergy: number, url: string}> => {
      if (!Array.isArray(cards)) return [];
      
      return cards.map(card => ({
        name: card.name || card.card_name || '',
        url: card.url || `https://edhrec.com/cards/${encodeURIComponent((card.name || card.card_name || '').toLowerCase().replace(/\s+/g, '-'))}`,
        num_decks: card.num_decks || card.decks || card.percentage || 0,
        synergy: card.synergy || card.score || card.synergy_score || 0
      }));
    };

    const extractThemes = async (data: any): Promise<Array<{name: string, url: string, num_decks: number, cards: Array<Card & {edhrec_rank: number, edhrec_synergy: number, edhrec_url: string}>}>> => {
      const themes: Array<{name: string, url: string, num_decks: number, cards: Array<Card & {edhrec_rank: number, edhrec_synergy: number, edhrec_url: string}>}> = [];
      
      // Look for theme sections in the data
      const cardlists = data.container?.json_dict?.cardlists || data.cardlists || [];
      
      for (const section of cardlists) {
        const sectionName = section.tag || section.header || '';
        if (sectionName && !['creatures', 'instants', 'sorceries', 'artifacts', 'enchantments', 'planeswalkers', 'lands'].includes(sectionName.toLowerCase())) {
          // This might be a theme section
          const themeCards = formatCards(section.cardviews || section.cards || []).slice(0, 20);
          const linkedThemeCards = await storage.linkEdhrecCards(themeCards);
          
          themes.push({
            name: sectionName,
            url: `https://edhrec.com/themes/${encodeURIComponent(sectionName.toLowerCase().replace(/\s+/g, '-'))}`,
            num_decks: section.num_decks || 0,
            cards: linkedThemeCards
          });
        }
      }
      
      return themes;
    };

    // Extract card recommendations from EDHREC JSON structure
    const cardSections = data.container?.json_dict?.cardlists || data.cardlists || [];
    const cardsByType: { [key: string]: Array<{name: string, num_decks: number, synergy: number, url: string}> } = {
      creatures: [],
      instants: [],
      sorceries: [],
      artifacts: [],
      enchantments: [],
      planeswalkers: [],
      lands: []
    };

    // Process each card section without artificial limits
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
      }
    });

    // Link all cards with database using efficient batch operation
    const allEdhrecCards = [
      ...cardsByType.creatures,
      ...cardsByType.instants,
      ...cardsByType.sorceries,
      ...cardsByType.artifacts,
      ...cardsByType.enchantments,
      ...cardsByType.planeswalkers,
      ...cardsByType.lands
    ];
    
    console.log(`🔗 Linking ${allEdhrecCards.length} EDHREC cards via database join...`);
    const linkedCards = await storage.linkEdhrecCards(allEdhrecCards);
    
    // Organize linked cards back into categories
    const linkedCardsByType = {
      creatures: [] as Array<Card & {edhrec_rank: number, edhrec_synergy: number, edhrec_url: string}>,
      instants: [] as Array<Card & {edhrec_rank: number, edhrec_synergy: number, edhrec_url: string}>,
      sorceries: [] as Array<Card & {edhrec_rank: number, edhrec_synergy: number, edhrec_url: string}>,
      artifacts: [] as Array<Card & {edhrec_rank: number, edhrec_synergy: number, edhrec_url: string}>,
      enchantments: [] as Array<Card & {edhrec_rank: number, edhrec_synergy: number, edhrec_url: string}>,
      planeswalkers: [] as Array<Card & {edhrec_rank: number, edhrec_synergy: number, edhrec_url: string}>,
      lands: [] as Array<Card & {edhrec_rank: number, edhrec_synergy: number, edhrec_url: string}>
    };
    
    linkedCards.forEach(card => {
      const typeLine = card.type_line.toLowerCase();
      if (typeLine.includes('creature')) {
        linkedCardsByType.creatures.push(card);
      } else if (typeLine.includes('instant')) {
        linkedCardsByType.instants.push(card);
      } else if (typeLine.includes('sorcery')) {
        linkedCardsByType.sorceries.push(card);
      } else if (typeLine.includes('artifact')) {
        linkedCardsByType.artifacts.push(card);
      } else if (typeLine.includes('enchantment')) {
        linkedCardsByType.enchantments.push(card);
      } else if (typeLine.includes('planeswalker')) {
        linkedCardsByType.planeswalkers.push(card);
      } else if (typeLine.includes('land')) {
        linkedCardsByType.lands.push(card);
      }
    });

    // Extract themes from the data
    const themes = await extractThemes(data);
    
    return {
      commander: commander.name,
      total_decks: data.container?.json_dict?.num_decks || data.num_decks || 0,
      updated_at: new Date().toISOString(),
      cards: linkedCardsByType,
      themes: themes
    };
  }

  private async fetchFromEdhrec(url: string): Promise<any> {
    try {
      const execAsync = promisify(exec);
      const curlCommand = `curl -s -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" -H "Referer: https://edhrec.com/" "${url}"`;
      
      const { stdout, stderr } = await execAsync(curlCommand);
      
      if (stderr && stderr.trim()) {
        throw new Error(`Curl error: ${stderr}`);
      }

      if (!stdout || stdout.trim() === '') {
        throw new Error('Empty response from EDHREC');
      }

      return JSON.parse(stdout);
    } catch (error) {
      console.error('Error fetching from EDHREC:', error);
      throw error;
    }
  }

  async searchEdhrecCard(cardName: string): Promise<EdhrecCard | null> {
    try {
      const normalizedName = this.normalizeCommanderName(cardName);
      const url = `https://json.edhrec.com/pages/cards/${normalizedName}.json`;
      const data = await this.fetchFromEdhrec(url);
      
      if (data && data.container && data.container.json_dict) {
        const cardData = data.container.json_dict;
        return {
          name: cardData.name || cardName,
          url: cardData.url || `https://edhrec.com/cards/${encodeURIComponent(cardName)}`,
          num_decks: cardData.num_decks || 0,
          synergy: cardData.synergy || 0,
          price: cardData.price || 0,
          color_identity: cardData.color_identity || [],
          type_line: cardData.type_line || '',
          cmc: cardData.cmc || 0,
          oracle_text: cardData.oracle_text
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

  clearSpecificCache(cacheKey: string): void {
    this.cache.delete(cacheKey);
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