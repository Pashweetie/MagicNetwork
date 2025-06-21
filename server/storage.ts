import { db } from "./db";
import { cardCache, searchCache, users, cardThemes, themeVotes, decks, userDecks, cards } from "@shared/schema";
import { Card, SearchFilters, SearchResponse, User, InsertUser, Deck, InsertDeck, UserDeck, InsertUserDeck, DeckEntry, CardTheme, InsertCardTheme, ThemeVote, InsertThemeVote } from "@shared/schema";
import { eq, sql, and, desc, asc, inArray, or, ilike } from "drizzle-orm";
import crypto from "crypto";
import { scryfallService } from "./services/scryfall";
import { cardMatchesFilters } from "./utils/card-filters";

export interface IStorage {
  // Card search methods
  searchCards(filters: SearchFilters, page: number): Promise<SearchResponse>;
  getCard(id: string): Promise<Card | null>;
  getRandomCard(): Promise<Card>;
  
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(insertUser: InsertUser): Promise<User>;
  
  // Cache management
  cacheCard(card: Card): Promise<void>;
  getCachedCard(id: string): Promise<Card | null>;
  cacheSearchResults(filters: SearchFilters, page: number, results: SearchResponse): Promise<void>;
  getCachedSearchResults(filters: SearchFilters, page: number): Promise<SearchResponse | null>;
  cleanupOldCache(): Promise<void>;
  
  // Simplified theme system
  getCardThemes(cardId: string): Promise<CardTheme[]>;
  createCardTheme(theme: InsertCardTheme): Promise<CardTheme>;
  
  // Deck persistence
  createDeck(deck: InsertDeck): Promise<Deck>;
  getUserDecks(userId: number): Promise<Deck[]>;
  getDeck(id: number, userId: number): Promise<Deck | null>;
  updateDeck(id: number, userId: number, updates: Partial<InsertDeck>): Promise<Deck | null>;
  deleteDeck(id: number, userId: number): Promise<boolean>;
  
  // User deck management (one deck per user)
  getUserDeck(userId: string): Promise<{ deck: UserDeck | null, entries: DeckEntry[], commander?: Card }>;
  saveUserDeck(userId: string, deckData: Partial<InsertUserDeck>): Promise<UserDeck>;
  
  // Deck import functionality
  importDeckFromText(userId: string, deckText: string, format?: string): Promise<{ success: boolean, message: string, importedCards: number, failedCards: string[] }>;

  // EDHREC card linking
  linkEdhrecCards(edhrecCards: Array<{name: string, num_decks: number, synergy: number, url: string}>): Promise<Array<Card & {edhrec_rank: number, edhrec_synergy: number, edhrec_url: string}>>;
}

export class DatabaseStorage implements IStorage {
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours for card cache
  private readonly SEARCH_CACHE_TTL = 60 * 60 * 1000; // 1 hour for search cache
  private cardDatabaseService: any = null;

  private generateQueryHash(filters: SearchFilters, page: number): string {
    const queryString = JSON.stringify({ filters, page });
    return crypto.createHash('md5').update(queryString).digest('hex');
  }

  async searchCards(filters: SearchFilters, page: number = 1): Promise<SearchResponse> {
    try {
      // Check cache first
      const cachedResult = await this.getCachedSearchResults(filters, page);
      if (cachedResult) {
        return cachedResult;
      }

      // Try local database first if available
      try {
        const { cardDatabaseService } = await import("./services/card-database-service");
        const cardCount = await cardDatabaseService.getCardCount();
        if (cardCount > 1000) { // Only use local DB if we have substantial data
          const result = await cardDatabaseService.searchCards(filters, page);
          await this.cacheSearchResults(filters, page, result);
          return result;
        } else {
          console.log(`Local database has only ${cardCount} cards, using Scryfall for search`);
        }
      } catch (dbError) {
        console.log('Local database not ready, using Scryfall');
      }

      // Fallback to Scryfall service for live search
      const result = await scryfallService.searchCards(filters, page);
      
      // Cache cards individually
      for (const card of result.data) {
        await this.cacheCard(card);
      }
      
      // Cache search results
      await this.cacheSearchResults(filters, page, result);
      
      return result;
    } catch (error) {
      console.error('Search error:', error);
      throw error;
    }
  }

  async getCard(id: string): Promise<Card | null> {
    try {
      // Try cache first
      const cached = await this.getCachedCard(id);
      if (cached) {
        return cached;
      }
      
      // Try local database first if available
      try {
        const { cardDatabaseService } = await import("./services/card-database-service");
        const card = await cardDatabaseService.getCard(id);
        if (card) {
          await this.cacheCard(card);
          return card;
        }
      } catch (dbError) {
        console.log('Local database not ready for card lookup, using Scryfall');
      }
      
      // Fallback to Scryfall
      const card = await scryfallService.getCard(id);
      if (card) {
        await this.cacheCard(card);
      }
      
      return card;
    } catch (error) {
      console.error('Get card error:', error);
      return null;
    }
  }

  async getRandomCard(): Promise<Card> {
    try {
      // Try local database first if available
      try {
        const { cardDatabaseService } = await import("./services/card-database-service");
        const card = await cardDatabaseService.getRandomCard();
        await this.cacheCard(card);
        return card;
      } catch (dbError) {
        console.log('Local database not ready for random card, using Scryfall');
      }
      
      // Fallback to Scryfall
      const card = await scryfallService.getRandomCard();
      await this.cacheCard(card);
      return card;
    } catch (error) {
      console.error('Random card error:', error);
      throw error;
    }
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async cacheCard(card: Card): Promise<void> {
    try {
      await db.insert(cardCache)
        .values({
          id: card.id,
          cardData: card,
          lastUpdated: new Date(),
          searchCount: 1
        })
        .onConflictDoUpdate({
          target: cardCache.id,
          set: {
            cardData: card,
            lastUpdated: new Date(),
            searchCount: sql`${cardCache.searchCount} + 1`
          }
        });
    } catch (error) {
      console.error('Cache card error:', error);
    }
  }

  async getCachedCard(id: string): Promise<Card | null> {
    try {
      const [cached] = await db.select()
        .from(cardCache)
        .where(eq(cardCache.id, id))
        .limit(1);
      
      if (cached && (Date.now() - cached.lastUpdated.getTime()) < this.CACHE_TTL) {
        return cached.cardData;
      }
      
      return null;
    } catch (error) {
      console.error('Get cached card error:', error);
      return null;
    }
  }

  async cacheSearchResults(filters: SearchFilters, page: number, results: SearchResponse): Promise<void> {
    try {
      const queryHash = this.generateQueryHash(filters, page);
      await db.insert(searchCache)
        .values({
          queryHash,
          query: JSON.stringify({ filters, page }),
          results,
          createdAt: new Date(),
          lastAccessed: new Date(),
          accessCount: 1
        })
        .onConflictDoUpdate({
          target: searchCache.queryHash,
          set: {
            results,
            lastAccessed: new Date(),
            accessCount: sql`${searchCache.accessCount} + 1`
          }
        });
    } catch (error) {
      console.error('Cache search results error:', error);
    }
  }

  async getCachedSearchResults(filters: SearchFilters, page: number): Promise<SearchResponse | null> {
    try {
      const queryHash = this.generateQueryHash(filters, page);
      const [cached] = await db.select()
        .from(searchCache)
        .where(eq(searchCache.queryHash, queryHash))
        .limit(1);
      
      if (cached && (Date.now() - cached.lastAccessed.getTime()) < this.SEARCH_CACHE_TTL) {
        // Update access time
        await db.update(searchCache)
          .set({ lastAccessed: new Date() })
          .where(eq(searchCache.queryHash, queryHash));
        
        return cached.results;
      }
      
      return null;
    } catch (error) {
      console.error('Get cached search results error:', error);
      return null;
    }
  }

  async cleanupOldCache(): Promise<void> {
    try {
      const cutoff = new Date(Date.now() - this.CACHE_TTL);
      await db.delete(cardCache)
        .where(sql`${cardCache.lastUpdated} < ${cutoff}`);
      
      const searchCutoff = new Date(Date.now() - this.SEARCH_CACHE_TTL);
      await db.delete(searchCache)
        .where(sql`${searchCache.lastAccessed} < ${searchCutoff}`);
    } catch (error) {
      console.error('Cleanup cache error:', error);
    }
  }



  async getCardRecommendations(cardId: string, type: 'synergy' | 'functional_similarity', limit: number = 10, filters?: any): Promise<any[]> {
    // Placeholder for recommendations - using AI service instead
    return [];
  }

  async recordRecommendationFeedback(feedback: any): Promise<void> {
    try {
      // Placeholder for recommendation feedback
      console.log('Recording recommendation feedback:', feedback);
    } catch (error) {
      console.error('Record recommendation feedback error:', error);
    }
  }

  async getRecommendationWeights(): Promise<{[key: string]: number}> {
    // Simple implementation - in practice this would analyze feedback
    return {
      'synergy': 1.0,
      'functional_similarity': 0.8,
      'theme': 0.9
    };
  }

  // Simplified method - remove complex implementation
  async findCardsBySharedThemes(): Promise<any[]> {
    return [];
  }

  // Remove complex synergy methods - replaced by new algorithm
  async findSynergyCards(): Promise<any[]> {
    return [];
  }

  async findFunctionallySimilarCards(): Promise<any[]> {
    return [];
  }

  async getCardThemes(cardId: string): Promise<CardTheme[]> {
    return db.select()
      .from(cardThemes)
      .where(eq(cardThemes.card_id, cardId))
      .orderBy(desc(cardThemes.confidence));
  }

  async createCardTheme(theme: InsertCardTheme): Promise<CardTheme> {
    const [result] = await db.insert(cardThemes).values(theme).returning();
    return result;
  }

  // Remove old voting method - replaced by new themeVotes table
  async updateCardThemeVotes(): Promise<void> {}

  async findCardsByThemes(themes: string[], filters?: any): Promise<Card[]> {
    if (themes.length === 0) return [];
    
    const cardIds = await db.select({ 
      cardId: cardThemes.card_id,
      avgScore: sql<number>`AVG(${cardThemes.confidence})`.as('avg_score')
    })
      .from(cardThemes)
      .where(inArray(cardThemes.theme_name, themes))
      .groupBy(cardThemes.card_id)
      .orderBy(desc(sql`AVG(${cardThemes.confidence})`));
    
    if (cardIds.length === 0) return [];
    
    const cachedCards = await db.select()
      .from(cardCache)
      .where(inArray(cardCache.id, cardIds.map(c => c.cardId)));
    
    let cards = cachedCards.map(c => c.cardData);
    
    if (filters) {
      cards = cards.filter(card => cardMatchesFilters(card, filters));
    }
    
    return cards;
  }



  // Remove old feedback methods - simplified system
  async recordUserThemeFeedback(): Promise<void> {}
  async recordCardThemeFeedback(): Promise<void> {}

  async calculateThemeSynergyScore(): Promise<{score: number, reason: string}> {
    return { score: 0, reason: "Use new synergy algorithm" };
  }

  async createDeck(deck: InsertDeck): Promise<Deck> {
    const [result] = await db.insert(decks).values(deck).returning();
    return result;
  }

  async getUserDecks(userId: number): Promise<Deck[]> {
    return db.select()
      .from(decks)
      .where(eq(decks.userId, userId))
      .orderBy(desc(decks.updatedAt));
  }

  async getDeck(id: number, userId: number): Promise<Deck | null> {
    const [deck] = await db.select()
      .from(decks)
      .where(and(eq(decks.id, id), eq(decks.userId, userId)))
      .limit(1);
    return deck || null;
  }

  async updateDeck(id: number, userId: number, updates: Partial<InsertDeck>): Promise<Deck | null> {
    const [deck] = await db.update(decks)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(decks.id, id), eq(decks.userId, userId)))
      .returning();
    return deck || null;
  }

  async deleteDeck(id: number, userId: number): Promise<boolean> {
    const result = await db.delete(decks)
      .where(and(eq(decks.id, id), eq(decks.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  async getUserDeck(userId: string): Promise<{ deck: UserDeck | null, entries: DeckEntry[], commander?: Card }> {
    try {
      const [deck] = await db.select().from(userDecks).where(eq(userDecks.userId, userId));
      
      if (!deck) {
        return { deck: null, entries: [], commander: undefined };
      }

      const entries: DeckEntry[] = [];
      const commander = deck.commanderId ? await this.getCard(deck.commanderId) : undefined;
      
      if (deck.cards && Array.isArray(deck.cards)) {
        for (const cardData of deck.cards as Array<{cardId: string, quantity: number}>) {
          const card = await this.getCard(cardData.cardId);
          if (card) {
            entries.push({ card, quantity: cardData.quantity });
          }
        }
      }

      return { deck, entries, commander: commander || undefined };
    } catch (error) {
      console.error('getUserDeck error:', error);
      return { deck: null, entries: [], commander: undefined };
    }
  }

  async saveUserDeck(userId: string, deckData: Partial<InsertUserDeck>): Promise<UserDeck> {
    const existingDeck = await db.select().from(userDecks).where(eq(userDecks.userId, userId)).limit(1);
    
    if (existingDeck.length > 0) {
      const [updated] = await db.update(userDecks)
        .set({ ...deckData, updatedAt: new Date() })
        .where(eq(userDecks.userId, userId))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(userDecks)
        .values({ userId, ...deckData })
        .returning();
      return created;
    }
  }

  async linkEdhrecCards(edhrecCards: Array<{name: string, num_decks: number, synergy: number, url: string}>): Promise<Array<Card & {edhrec_rank: number, edhrec_synergy: number, edhrec_url: string}>> {
    try {
      const cardNames = edhrecCards.map(card => card.name.toLowerCase());
      
      // Single query to get all matching cards from database
      const dbCards = await scryfallService.searchCards({
        query: cardNames.map(name => `!"${name}"`).join(' OR ')
      });
      
      const linkedCards: Array<Card & {edhrec_rank: number, edhrec_synergy: number, edhrec_url: string}> = [];
      
      // Create a map for fast lookups
      const dbCardMap = new Map<string, Card>();
      dbCards.data.forEach(card => {
        dbCardMap.set(card.name.toLowerCase(), card);
      });
      
      // Link EDHREC cards with database cards
      edhrecCards.forEach(edhrecCard => {
        const dbCard = dbCardMap.get(edhrecCard.name.toLowerCase());
        if (dbCard) {
          linkedCards.push({
            ...dbCard,
            edhrec_rank: edhrecCard.num_decks,
            edhrec_synergy: edhrecCard.synergy,
            edhrec_url: edhrecCard.url
          });
        }
      });
      
      console.log(`✅ Linked ${linkedCards.length} out of ${edhrecCards.length} EDHREC cards via database join`);
      return linkedCards;
    } catch (error) {
      console.error('Error linking EDHREC cards:', error);
      return [];
    }
  }

  async importDeckFromText(userId: string, deckText: string, format?: string): Promise<{ success: boolean, message: string, importedCards: number, failedCards: string[] }> {
    try {
      const lines = deckText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      const failedCards: string[] = [];
      let commander: Card | null = null;

      console.log(`Starting bulk import of ${lines.length} lines`);

      // Parse all card names from the deck text
      const cardEntries: Array<{name: string, quantity: number, isCommander: boolean}> = [];
      
      for (const line of lines) {
        if (line.startsWith('#') || line.startsWith('//') || line.length === 0 || line.toLowerCase().includes('commander:') || line.toLowerCase().includes('main deck:')) {
          continue;
        }

        const match = line.match(/^(\d+)\s+(.+)$/);
        if (!match) {
          failedCards.push(line);
          continue;
        }

        const quantity = parseInt(match[1]);
        let cardName = match[2].trim();
        
        // Remove set codes in parentheses
        cardName = cardName.replace(/\s*\([^)]+\)\s*$/, '');
        
        // Check if it's a commander
        const isCommander = cardName.includes('*') || cardName.toLowerCase().includes('commander');
        cardName = cardName.replace(/\*|\s*commander\s*/gi, '').trim();

        cardEntries.push({ name: cardName, quantity, isCommander });
      }

      console.log(`Parsed ${cardEntries.length} card entries, searching database...`);

      // Bulk search all card names at once using the database
      const cardNames = cardEntries.map(entry => entry.name);
      const foundCards = await this.bulkFindCardsByNames(cardNames);
      
      // Create lookup map for found cards
      const cardMap = new Map<string, Card>();
      foundCards.forEach(card => {
        cardMap.set(card.name.toLowerCase(), card);
        // Also add variations for double-faced cards
        if (card.name.includes(' // ')) {
          const mainName = card.name.split(' // ')[0];
          cardMap.set(mainName.toLowerCase(), card);
        }
      });

      // Match entries to found cards
      const importedCards: Array<{cardId: string, quantity: number}> = [];
      
      for (const entry of cardEntries) {
        const foundCard = cardMap.get(entry.name.toLowerCase());
        
        if (foundCard) {
          importedCards.push({ cardId: foundCard.id, quantity: entry.quantity });
          
          if (entry.isCommander) {
            commander = foundCard;
          }
          
          console.log(`Found: ${foundCard.name}`);
        } else {
          failedCards.push(entry.name);
          console.log(`Failed to find: ${entry.name}`);
        }
      }

      console.log(`Bulk import complete: ${importedCards.length} imported, ${failedCards.length} failed`);

      if (importedCards.length === 0) {
        return {
          success: false,
          message: "No cards could be imported",
          importedCards: 0,
          failedCards
        };
      }

      // Save the deck with imported cards
      const deckData: Partial<InsertUserDeck> = {
        name: `Imported Deck`,
        format: format || 'Commander',
        cards: importedCards,
        commanderId: commander?.id
      };

      await this.saveUserDeck(userId, deckData);

      return {
        success: true,
        message: `Successfully imported ${importedCards.length} card${importedCards.length !== 1 ? 's' : ''}${failedCards.length > 0 ? ` (${failedCards.length} failed)` : ''}`,
        importedCards: importedCards.length,
        failedCards
      };

    } catch (error) {
      console.error('Deck import error:', error);
      return {
        success: false,
        message: "Failed to import deck",
        importedCards: 0,
        failedCards: []
      };
    }
  }

  private async bulkFindCardsByNames(cardNames: string[]): Promise<Card[]> {
    try {
      console.log(`Searching for ${cardNames.length} cards in local database...`);
      
      const foundCards: Card[] = [];
      
      // Use Drizzle ORM approach to avoid SQL issues
      for (const cardName of cardNames) {
        try {
          // First try exact match
          let result = await db.select()
            .from(cards)
            .where(eq(cards.name, cardName))
            .limit(1);
          
          // If no exact match, try fuzzy match
          if (result.length === 0) {
            result = await db.select()
              .from(cards)
              .where(ilike(cards.name, `%${cardName}%`))
              .limit(1);
          }

          if (result.length > 0) {
            foundCards.push(this.convertDbCardToCard(result[0]));
          }
        } catch (error) {
          console.error(`Error searching for card "${cardName}":`, error);
        }
      }

      console.log(`Found ${foundCards.length} cards in local database`);
      return foundCards;
    } catch (error) {
      console.error('Bulk card search error:', error);
      return [];
    }
  }

  private convertDbCardToCard(dbCard: any): Card {
    return {
      id: dbCard.id,
      name: dbCard.name,
      mana_cost: dbCard.manaCost || dbCard.mana_cost,
      cmc: dbCard.cmc,
      type_line: dbCard.typeLine || dbCard.type_line,
      oracle_text: dbCard.oracleText || dbCard.oracle_text,
      colors: dbCard.colors,
      color_identity: dbCard.colorIdentity || dbCard.color_identity,
      power: dbCard.power,
      toughness: dbCard.toughness,
      rarity: dbCard.rarity,
      set: dbCard.setCode || dbCard.set_code,
      set_name: dbCard.setName || dbCard.set_name,
      image_uris: dbCard.imageUris || dbCard.image_uris,
      card_faces: dbCard.cardFaces || dbCard.card_faces,
      prices: dbCard.prices,
      legalities: dbCard.legalities,
    };
  }

  private convertRawDbCardToCard(row: any): Card {
    return {
      id: row.id,
      name: row.name,
      mana_cost: row.mana_cost,
      cmc: row.cmc,
      type_line: row.type_line,
      oracle_text: row.oracle_text,
      colors: row.colors,
      color_identity: row.color_identity,
      power: row.power,
      toughness: row.toughness,
      rarity: row.rarity,
      set: row.set_code,
      set_name: row.set_name,
      image_uris: row.image_uris,
      card_faces: row.card_faces,
      prices: row.prices,
      legalities: row.legalities,
    };
  }
}

export const storage = new DatabaseStorage();
