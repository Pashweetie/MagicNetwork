import { storage } from "../storage";
import { Card, cardThemes, InsertCardTheme } from "@shared/schema";
import { db } from "../db";
import { cardCache } from "@shared/schema";
import { desc, sql, eq } from "drizzle-orm";

export class RecommendationService {
  
  // Generate recommendations for a specific card
  async generateCardRecommendations(cardId: string): Promise<void> {
    await storage.generateRecommendationsForCard(cardId);
  }

  // Get recommendations for a card
  async getCardRecommendations(cardId: string, limit: number = 10) {
    const recommendations = await storage.getCardRecommendations(cardId, 'synergy', limit);
    
    // Get the actual card data for each recommendation
    const cardData = await Promise.all(
      recommendations.map(async (rec) => {
        const card = await storage.getCachedCard(rec.recommendedCardId);
        return {
          ...rec,
          card
        };
      })
    );

    return cardData.filter(rec => rec.card !== null);
  }

  // Get personalized recommendations based on user interactions
  async getPersonalizedRecommendations(userId: number, limit: number = 20): Promise<Card[]> {
    return await storage.getPersonalizedRecommendations(userId, limit);
  }

  // Track user interaction for learning
  async trackUserInteraction(userId: number, cardId: string, interactionType: string, metadata?: any): Promise<void> {
    await storage.recordUserInteraction({
      userId,
      cardId,
      interactionType,
      metadata
    });
  }

  // Generate recommendations for popular cards in batches
  async generateRecommendationsForPopularCards(limit: number = 50): Promise<void> {
    console.log('Generating recommendations for popular cards...');
    
    // Get popular cards based on search frequency
    const popularCards = await db.execute(sql`
      SELECT id FROM card_cache 
      ORDER BY search_count DESC 
      LIMIT ${limit}
    `);

    const rows = (popularCards as any).rows || [];
    for (const cardResult of rows) {
      try {
        console.log(`Generating recommendations for popular card: ${cardResult.id}`);
        await this.generateCardRecommendations(cardResult.id);
      } catch (error) {
        console.error(`Error generating recommendations for card ${cardResult.id}:`, error);
      }
    }
    
    console.log('Finished generating recommendations for popular cards');
  }

  async getThemeSuggestions(cardId: string): Promise<Array<{theme: string, description: string, cards: Card[]}>> {
    try {
      // Get the source card using direct query
      const result = await db.execute(sql`SELECT * FROM card_cache WHERE id = ${cardId} LIMIT 1`);
      
      // Handle different result formats
      let sourceCard;
      if ((result as any).rows && (result as any).rows.length > 0) {
        sourceCard = (result as any).rows[0];
      } else if (Array.isArray(result) && result.length > 0) {
        sourceCard = result[0];
      } else {
        console.log('No card found for ID:', cardId);
        return [];
      }

      const card = sourceCard as Card;

      // Generate themes using local pattern analysis
      const detectedThemes = this.analyzeCardThemesLocally(card);
      
      const results: Array<{theme: string, description: string, cards: Card[]}> = [];

      // For each detected theme, find matching cards
      for (const theme of detectedThemes) {
        const relatedCards = await this.findCardsForDynamicTheme(theme, card);
        if (relatedCards.length > 0) {
          results.push({
            theme: theme.name,
            description: theme.description,
            cards: relatedCards.slice(0, 12)
          });
        }
      }

      return results.slice(0, 6);
    } catch (error) {
      console.error('Error getting theme suggestions:', error);
      return [];
    }
  }

  private analyzeCardThemesLocally(card: Card): Array<{name: string, description: string, keywords: string[], searchTerms: string[]}> {
    const themes = [];
    const cardName = card.name.toLowerCase();
    const cardText = `${card.name} ${card.oracle_text || ''} ${card.type_line}`.toLowerCase();
    const oracleText = (card.oracle_text || '').toLowerCase();
    const typeLine = card.type_line.toLowerCase();
    
    // THEFT & CONTROL MAGIC
    if (cardName.includes('abduction') || cardName.includes('steal') || cardName.includes('mind control') ||
        oracleText.includes('gain control') || oracleText.includes('take control') || 
        oracleText.includes('steal') || oracleText.includes('exchange control')) {
      themes.push({
        name: 'Theft & Control Magic',
        description: 'Taking control of opponent permanents and resources',
        keywords: ['steal', 'control', 'gain control', 'exchange'],
        searchTerms: ['gain control', 'take control', 'steal', 'exchange control', 'control target']
      });
    }

    // STAX & PRISON
    if (oracleText.match(/can't\s+(attack|block|be\s+activated|untap)/) ||
        oracleText.includes('tax') || oracleText.includes('additional cost') ||
        oracleText.includes('pay') && oracleText.includes('more')) {
      themes.push({
        name: 'Stax & Prison',
        description: 'Disrupting opponent resources and restricting actions',
        keywords: ['tax', 'restriction', 'additional cost', 'can\'t'],
        searchTerms: ['additional cost', 'can\'t attack', 'can\'t block', 'tax', 'pay more']
      });
    }

    // TOKEN GENERATION
    if (oracleText.includes('token') || 
        (oracleText.includes('create') && oracleText.includes('creature'))) {
      themes.push({
        name: 'Token Generation',
        description: 'Creating and utilizing creature tokens for board presence',
        keywords: ['token', 'create', 'creature'],
        searchTerms: ['create token', 'token creature', 'creature token']
      });
    }

    // GRAVEYARD VALUE
    if (oracleText.includes('graveyard') || 
        (oracleText.includes('return') && oracleText.includes('battlefield')) ||
        oracleText.includes('mill') || oracleText.includes('dredge')) {
      themes.push({
        name: 'Graveyard Value',
        description: 'Using the graveyard as a resource for card advantage',
        keywords: ['graveyard', 'return', 'mill', 'dredge'],
        searchTerms: ['graveyard', 'return from graveyard', 'mill', 'put into graveyard']
      });
    }

    // ARTIFACT SYNERGY
    if (typeLine.includes('artifact') || oracleText.includes('artifact')) {
      themes.push({
        name: 'Artifact Synergy',
        description: 'Strategies built around artifact interactions',
        keywords: ['artifact', 'equipment', 'construct'],
        searchTerms: ['artifact', 'equipment', 'artifact creature']
      });
    }

    // SACRIFICE VALUE
    if (oracleText.includes('sacrifice') || 
        (oracleText.includes('destroy') && oracleText.includes('you control'))) {
      themes.push({
        name: 'Sacrifice Value',
        description: 'Converting permanents into value through sacrifice',
        keywords: ['sacrifice', 'destroy', 'death'],
        searchTerms: ['sacrifice', 'when dies', 'death trigger']
      });
    }

    // COUNTER MAGIC
    if (oracleText.includes('counter') && oracleText.includes('spell')) {
      themes.push({
        name: 'Counter Magic',
        description: 'Control strategy focused on countering opponent spells',
        keywords: ['counter', 'spell', 'permission'],
        searchTerms: ['counter target spell', 'counter spell']
      });
    }

    // BURN & DIRECT DAMAGE
    if (oracleText.includes('damage') && 
        (oracleText.includes('player') || oracleText.includes('opponent') || oracleText.includes('any target'))) {
      themes.push({
        name: 'Burn & Direct Damage',
        description: 'Dealing direct damage to opponents and planeswalkers',
        keywords: ['damage', 'burn', 'direct'],
        searchTerms: ['damage to any target', 'damage to opponent', 'deals damage']
      });
    }

    // LIFEGAIN
    if (oracleText.includes('gain') && oracleText.includes('life')) {
      themes.push({
        name: 'Lifegain Strategy',
        description: 'Gaining life and leveraging lifegain triggers',
        keywords: ['lifegain', 'gain life', 'life'],
        searchTerms: ['gain life', 'whenever you gain life', 'lifegain']
      });
    }

    // MILL STRATEGY
    if (oracleText.includes('mill') || 
        (oracleText.includes('library') && oracleText.includes('graveyard'))) {
      themes.push({
        name: 'Mill Strategy',
        description: 'Depleting opponent library or self-mill for value',
        keywords: ['mill', 'library', 'graveyard'],
        searchTerms: ['mill', 'library into graveyard', 'put cards from library']
      });
    }

    // +1/+1 COUNTERS
    if (oracleText.includes('+1/+1 counter') || 
        (oracleText.includes('counter') && oracleText.includes('creature'))) {
      themes.push({
        name: '+1/+1 Counters',
        description: 'Growing creatures with +1/+1 counters',
        keywords: ['counter', 'grow', '+1/+1'],
        searchTerms: ['+1/+1 counter', 'counter on creature', 'put counter']
      });
    }

    // RAMP & MANA ACCELERATION
    if (oracleText.includes('mana') || 
        (oracleText.includes('land') && oracleText.includes('search'))) {
      themes.push({
        name: 'Ramp & Acceleration',
        description: 'Accelerating mana development for big plays',
        keywords: ['ramp', 'mana', 'land'],
        searchTerms: ['search for land', 'add mana', 'mana acceleration']
      });
    }

    // TRIBAL THEMES
    const tribalTypes = ['elf', 'goblin', 'zombie', 'human', 'dragon', 'angel', 'demon', 'spirit', 'vampire', 'wizard', 'warrior', 'knight', 'beast', 'cat', 'bird'];
    for (const tribe of tribalTypes) {
      if (typeLine.includes(tribe) || oracleText.includes(tribe)) {
        themes.push({
          name: `${tribe.charAt(0).toUpperCase() + tribe.slice(1)} Tribal`,
          description: `Tribal strategy focused on ${tribe} creatures and synergies`,
          keywords: [tribe, 'tribal', 'creature type'],
          searchTerms: [`${tribe}`, `${tribe} creature`, `other ${tribe}s`]
        });
      }
    }

    // ENCHANTMENT SYNERGY
    if (typeLine.includes('enchantment') || oracleText.includes('enchantment')) {
      themes.push({
        name: 'Enchantment Synergy',
        description: 'Strategies built around enchantment interactions',
        keywords: ['enchantment', 'aura', 'constellation'],
        searchTerms: ['enchantment', 'constellation', 'enchant']
      });
    }

    // CARD DRAW & ADVANTAGE
    if (oracleText.includes('draw') && oracleText.includes('card')) {
      themes.push({
        name: 'Card Draw & Advantage',
        description: 'Generating card advantage through draw effects',
        keywords: ['draw', 'card', 'advantage'],
        searchTerms: ['draw card', 'draw cards', 'card advantage']
      });
    }

    return themes.slice(0, 8); // Return up to 8 most relevant themes
  }

  private async findCardsForDynamicTheme(theme: {name: string, description: string, keywords: string[], searchTerms: string[]}, sourceCard: Card): Promise<Card[]> {
    try {
      const searchQueries: string[] = [];
      
      // Build search queries from theme keywords and search terms
      for (const term of theme.searchTerms) {
        searchQueries.push(`oracle:"${term}"`);
      }
      
      for (const keyword of theme.keywords) {
        searchQueries.push(`oracle:"${keyword}"`);
      }
      
      // Also search by theme name components
      const themeWords = theme.name.toLowerCase().split(/\s+|&|\//);
      for (const word of themeWords) {
        if (word.length > 3 && !['the', 'and', 'for', 'with'].includes(word)) {
          searchQueries.push(`oracle:"${word}"`);
        }
      }

      // Execute database searches
      const matchingCards: Array<{card: Card, score: number}> = [];
      
      for (const query of searchQueries.slice(0, 8)) { // Limit queries to avoid too many DB calls
        try {
          const searchTerm = query.replace('oracle:"', '').replace('"', '');
          const cards = await db.execute(sql`
            SELECT * FROM card_cache 
            WHERE id != ${sourceCard.id}
            AND (
              LOWER(oracle_text) LIKE ${`%${searchTerm}%`}
              OR LOWER(name) LIKE ${`%${searchTerm}%`}
              OR LOWER(type_line) LIKE ${`%${searchTerm}%`}
            )
            LIMIT 20
          `);
          
          // Handle different result formats
          let cardRows = [];
          if ((cards as any).rows) {
            cardRows = (cards as any).rows;
          } else if (Array.isArray(cards)) {
            cardRows = cards;
          }
          
          for (const card of cardRows) {
            const score = this.calculateThemeRelevance(card, theme);
            if (score > 0.3) {
              matchingCards.push({ card: card as Card, score });
            }
          }
        } catch (error) {
          console.error('Error searching for theme cards:', error);
        }
      }

      // Sort by relevance and remove duplicates
      const uniqueCards = new Map<string, {card: Card, score: number}>();
      for (const item of matchingCards) {
        if (!uniqueCards.has(item.card.id) || uniqueCards.get(item.card.id)!.score < item.score) {
          uniqueCards.set(item.card.id, item);
        }
      }

      return Array.from(uniqueCards.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, 15)
        .map(item => item.card);
    } catch (error) {
      console.error('Error finding cards for dynamic theme:', error);
      return [];
    }
  }

  private calculateThemeRelevance(card: any, theme: {name: string, keywords: string[], searchTerms: string[]}): number {
    const cardText = `${card.name} ${card.oracle_text || ''} ${card.type_line}`.toLowerCase();
    let score = 0;
    
    // Check search terms (higher weight)
    for (const term of theme.searchTerms) {
      if (cardText.includes(term.toLowerCase())) {
        score += 0.4;
      }
    }
    
    // Check keywords (medium weight)
    for (const keyword of theme.keywords) {
      if (cardText.includes(keyword.toLowerCase())) {
        score += 0.2;
      }
    }
    
    // Check theme name components (lower weight)
    const themeWords = theme.name.toLowerCase().split(/\s+|&|\//);
    for (const word of themeWords) {
      if (word.length > 3 && cardText.includes(word)) {
        score += 0.1;
      }
    }
    
    return Math.min(score, 1.0);
  }

  async analyzeAndStoreCardThemes(card: Card): Promise<any[]> {
    const themes = this.analyzeCardThemesLocally(card);
    const storedThemes = [];

    for (const theme of themes) {
      try {
        const [insertedTheme] = await db.insert(cardThemes).values({
          cardId: card.id,
          themeName: theme.name,
          description: theme.description,
          keywords: theme.keywords,
          themeCategory: 'strategic',
          confidence: 80
        }).returning();
        
        storedThemes.push(insertedTheme);
      } catch (error) {
        console.error('Error storing theme:', error);
      }
    }

    return storedThemes;
  }

  private async findCardsForStoredTheme(theme: any, sourceCard: Card): Promise<Card[]> {
    const dynamicTheme = {
      name: theme.themeName,
      description: theme.description || '',
      keywords: theme.keywords || [],
      searchTerms: theme.keywords || []
    };
    
    return this.findCardsForDynamicTheme(dynamicTheme, sourceCard);
  }
}

export const recommendationService = new RecommendationService();