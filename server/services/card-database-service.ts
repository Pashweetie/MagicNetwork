import { db } from "../db";
import { cards, cardSets, cardImages, cardPrices, cardLegalities } from "@shared/schema";
import { Card, InsertCard, CardSet, InsertCardSet } from "@shared/schema";
import { eq, sql, and, or, ilike, inArray, desc, asc } from "drizzle-orm";
import { SearchFilters, SearchResponse } from "@shared/schema";
import { cardMatchesFilters } from "../utils/card-filters";

const SCRYFALL_BULK_API = "https://api.scryfall.com/bulk-data";

export class CardDatabaseService {
  private isDownloading = false;
  private downloadProgress = { current: 0, total: 0, status: 'idle' };
  private updateCheckInterval: NodeJS.Timeout | null = null;

  async initializeDatabase(): Promise<void> {
    console.log("Initializing card database...");
    
    // Check if we have any cards in the database
    const cardCount = await this.getCardCount();
    
    if (cardCount === 0) {
      console.log("No cards found in database. Starting bulk download...");
      await this.downloadAllCards();
    } else {
      console.log(`Database already contains ${cardCount} cards`);
      // Check if we need to update
      await this.checkForUpdates();
    }
    
    // Start weekly update schedule
    this.startUpdateSchedule();
  }

  async getCardCount(): Promise<number> {
    try {
      const result = await db.select({ count: sql<number>`count(*)` }).from(cards);
      return result[0]?.count || 0;
    } catch (error) {
      console.log("Cards table not ready, returning 0");
      return 0;
    }
  }

  async downloadAllCards(): Promise<void> {
    if (this.isDownloading) {
      console.log("Download already in progress");
      return;
    }

    this.isDownloading = true;
    this.downloadProgress = { current: 0, total: 0, status: 'downloading' };

    try {
      // Get current card count to determine where to resume
      const currentCount = await this.getCardCount();
      console.log(`Current database has ${currentCount} cards`);

      // Get bulk data info from Scryfall
      console.log("Fetching bulk data info...");
      const bulkResponse = await fetch(SCRYFALL_BULK_API);
      const bulkData = await bulkResponse.json();
      
      // Find the default cards bulk data
      const defaultCards = bulkData.data.find((item: any) => item.type === 'default_cards');
      if (!defaultCards) {
        throw new Error("Could not find default cards bulk data");
      }

      console.log(`Downloading ${Math.round(defaultCards.compressed_size / 1024 / 1024)}MB of card data...`);
      
      // Download the bulk card data
      const cardsResponse = await fetch(defaultCards.download_uri);
      const cardsData = await cardsResponse.json();

      this.downloadProgress.total = cardsData.length;
      console.log(`Processing ${cardsData.length} cards (${currentCount} already in database)...`);

      // Process cards in smaller batches to be more efficient
      const batchSize = 500;
      let processedNew = 0;
      
      for (let i = 0; i < cardsData.length; i += batchSize) {
        const batch = cardsData.slice(i, i + batchSize);
        const newCardsInBatch = await this.processBatch(batch);
        processedNew += newCardsInBatch;
        this.downloadProgress.current = i + batch.length;
        
        if (i % 5000 === 0 || newCardsInBatch > 0) {
          console.log(`Processed ${this.downloadProgress.current}/${this.downloadProgress.total} cards (${processedNew} new)`);
        }
      }

      this.downloadProgress.status = 'complete';
      console.log(`Card database sync complete! Added ${processedNew} new cards.`);
      
    } catch (error) {
      console.error("Error downloading cards:", error);
      this.downloadProgress.status = 'error';
      throw error;
    } finally {
      this.isDownloading = false;
    }
  }

  private async processBatch(batch: any[]): Promise<number> {
    const cardsToInsert: InsertCard[] = [];
    const setsToInsert: Map<string, InsertCardSet> = new Map();

    // Get existing card IDs to avoid duplicates
    const batchIds = batch.map(card => card.id);
    const existingCards = await db.select({ id: cards.id })
      .from(cards)
      .where(inArray(cards.id, batchIds));
    const existingIds = new Set(existingCards.map(card => card.id));

    for (const cardData of batch) {
      // Skip if card already exists
      if (existingIds.has(cardData.id)) {
        continue;
      }

      // Skip digital-only cards, tokens, etc. if desired
      if (cardData.digital || cardData.layout === 'token') {
        continue;
      }

      // Collect set information
      if (!setsToInsert.has(cardData.set)) {
        setsToInsert.set(cardData.set, {
          code: cardData.set,
          name: cardData.set_name,
          releasedAt: cardData.released_at,
          setType: cardData.set_type,
          cardCount: 0 // Will be updated later if needed
        });
      }

      // Helper function to safely parse integers
      const parseIntSafe = (value: any): number | null => {
        if (value === null || value === undefined || value === '') return null;
        // Handle fractional power/toughness like "0.5" by converting to null
        const str = String(value);
        if (str.includes('.') || str.includes('*') || str.includes('+') || str.includes('X')) {
          return null;
        }
        const parsed = parseInt(str);
        return isNaN(parsed) ? null : parsed;
      };

      // Convert Scryfall card to our format with proper type handling
      const card: InsertCard = {
        id: cardData.id,
        name: cardData.name,
        manaCost: cardData.mana_cost || null,
        cmc: cardData.cmc || 0,
        typeLine: cardData.type_line || 'Unknown',
        oracleText: cardData.oracle_text || null,
        colors: cardData.colors || [],
        colorIdentity: cardData.color_identity || [],
        power: cardData.power || null,
        toughness: cardData.toughness || null,
        loyalty: cardData.loyalty || null,
        rarity: cardData.rarity,
        setCode: cardData.set,
        setName: cardData.set_name,
        collectorNumber: cardData.collector_number,
        releasedAt: cardData.released_at,
        artist: cardData.artist || null,
        borderColor: cardData.border_color || 'black',
        layout: cardData.layout || 'normal',
        keywords: cardData.keywords || [],
        producedMana: cardData.produced_mana || [],
        cardFaces: cardData.card_faces || null,
        imageUris: cardData.image_uris || null,
        prices: cardData.prices || null,
        legalities: cardData.legalities || null,
        edhrecRank: parseIntSafe(cardData.edhrec_rank),
        pennyRank: parseIntSafe(cardData.penny_rank),
      };

      cardsToInsert.push(card);
    }

    // Insert sets first (ignore conflicts)
    if (setsToInsert.size > 0) {
      await db.insert(cardSets)
        .values(Array.from(setsToInsert.values()))
        .onConflictDoNothing();
    }

    // Insert only new cards
    if (cardsToInsert.length > 0) {
      await db.insert(cards)
        .values(cardsToInsert)
        .onConflictDoNothing();
    }

    return cardsToInsert.length;
  }

  async searchCards(filters: SearchFilters, page: number = 1): Promise<SearchResponse> {
    const limit = 20;
    const offset = (page - 1) * limit;

    let query = db.select().from(cards);
    const conditions: any[] = [];

    // Text search
    if (filters.query) {
      conditions.push(
        or(
          ilike(cards.name, `%${filters.query}%`),
          ilike(cards.oracleText, `%${filters.query}%`),
          ilike(cards.typeLine, `%${filters.query}%`)
        )
      );
    }

    // Color filters
    if (filters.colors && filters.colors.length > 0) {
      if (filters.includeMulticolored) {
        conditions.push(
          sql`${cards.colors} && ${filters.colors}`
        );
      } else {
        conditions.push(
          sql`${cards.colors} = ${filters.colors}`
        );
      }
    }

    // Color identity filters
    if (filters.colorIdentity && filters.colorIdentity.length > 0) {
      conditions.push(
        sql`${cards.colorIdentity} <@ ${filters.colorIdentity}`
      );
    }

    // Type filters
    if (filters.types && filters.types.length > 0) {
      const typeConditions = filters.types.map(type => 
        ilike(cards.typeLine, `%${type}%`)
      );
      conditions.push(or(...typeConditions));
    }

    // Rarity filters
    if (filters.rarities && filters.rarities.length > 0) {
      conditions.push(inArray(cards.rarity, filters.rarities));
    }

    // Mana value filters
    if (filters.minMv !== undefined) {
      conditions.push(sql`${cards.cmc} >= ${filters.minMv}`);
    }
    if (filters.maxMv !== undefined) {
      conditions.push(sql`${cards.cmc} <= ${filters.maxMv}`);
    }

    // Set filter
    if (filters.set) {
      conditions.push(eq(cards.setCode, filters.set));
    }

    // Power/Toughness filters
    if (filters.power) {
      conditions.push(eq(cards.power, filters.power));
    }
    if (filters.toughness) {
      conditions.push(eq(cards.toughness, filters.toughness));
    }

    // Oracle text filter
    if (filters.oracleText) {
      conditions.push(ilike(cards.oracleText, `%${filters.oracleText}%`));
    }

    // Apply all conditions
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    // Get total count
    const countQuery = db.select({ count: sql<number>`count(*)` }).from(cards);
    if (conditions.length > 0) {
      countQuery.where(and(...conditions));
    }
    const totalResult = await countQuery;
    const totalCards = totalResult[0]?.count || 0;

    // Apply pagination and ordering
    const results = await query
      .orderBy(asc(cards.name))
      .limit(limit)
      .offset(offset);

    // Convert to Card format
    const cardData = results.map(this.convertDbCardToCard);

    return {
      data: cardData,
      has_more: offset + results.length < totalCards,
      total_cards: totalCards,
    };
  }

  async getCard(id: string): Promise<Card | null> {
    const result = await db.select()
      .from(cards)
      .where(eq(cards.id, id))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    return this.convertDbCardToCard(result[0]);
  }

  async getRandomCard(): Promise<Card> {
    const result = await db.select()
      .from(cards)
      .orderBy(sql`RANDOM()`)
      .limit(1);

    if (result.length === 0) {
      throw new Error("No cards found in database");
    }

    return this.convertDbCardToCard(result[0]);
  }

  private convertDbCardToCard(dbCard: any): Card {
    return {
      id: dbCard.id,
      name: dbCard.name,
      mana_cost: dbCard.manaCost,
      cmc: dbCard.cmc,
      type_line: dbCard.typeLine,
      oracle_text: dbCard.oracleText,
      colors: dbCard.colors,
      color_identity: dbCard.colorIdentity,
      power: dbCard.power,
      toughness: dbCard.toughness,
      rarity: dbCard.rarity,
      set: dbCard.setCode,
      set_name: dbCard.setName,
      image_uris: dbCard.imageUris,
      card_faces: dbCard.cardFaces,
      prices: dbCard.prices,
      legalities: dbCard.legalities,
    };
  }

  getDownloadProgress() {
    return this.downloadProgress;
  }

  async getLastUpdateTime(): Promise<Date | null> {
    try {
      const result = await db.select({ lastUpdated: sql<Date>`MAX(last_updated)` }).from(cards);
      return result[0]?.lastUpdated || null;
    } catch (error) {
      console.log("Could not get last update time:", error);
      return null;
    }
  }

  async checkForUpdates(): Promise<void> {
    try {
      const lastUpdate = await this.getLastUpdateTime();
      if (!lastUpdate) {
        console.log("No last update time found, skipping update check");
        return;
      }

      const lastUpdateTime = lastUpdate instanceof Date ? lastUpdate : new Date(lastUpdate);
      const daysSinceUpdate = (Date.now() - lastUpdateTime.getTime()) / (1000 * 60 * 60 * 24);
      console.log(`Last database update was ${daysSinceUpdate.toFixed(1)} days ago`);

      if (daysSinceUpdate >= 7) {
        console.log("Database is more than 7 days old, starting update...");
        await this.downloadUpdates();
      } else {
        console.log(`Database is up to date (${daysSinceUpdate.toFixed(1)} days old)`);
      }
    } catch (error) {
      console.error("Error checking for updates:", error);
    }
  }

  async downloadUpdates(): Promise<void> {
    if (this.isDownloading) {
      console.log("Download already in progress, skipping update");
      return;
    }

    console.log("Starting incremental database update...");
    
    try {
      // Get bulk data info to check if there are updates
      const bulkResponse = await fetch(SCRYFALL_BULK_API);
      const bulkData = await bulkResponse.json();
      
      const defaultCards = bulkData.data.find((item: any) => item.type === 'default_cards');
      if (!defaultCards) {
        throw new Error("Could not find default cards bulk data");
      }

      // Check if bulk data is newer than our last update
      const bulkUpdatedAt = new Date(defaultCards.updated_at);
      const lastUpdate = await this.getLastUpdateTime();
      
      if (lastUpdate && bulkUpdatedAt <= lastUpdate) {
        console.log("Bulk data is not newer than our database, no update needed");
        return;
      }

      console.log(`Bulk data updated at ${bulkUpdatedAt.toISOString()}, our last update: ${lastUpdate?.toISOString() || 'never'}`);
      
      // For now, do a full refresh for weekly updates
      // In production, you might implement incremental updates
      await this.downloadAllCards();
      
    } catch (error) {
      console.error("Error during update:", error);
    }
  }

  startUpdateSchedule(): void {
    // Clear any existing interval
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
    }

    // Check for updates every 24 hours
    this.updateCheckInterval = setInterval(async () => {
      console.log("Running scheduled update check...");
      await this.checkForUpdates();
    }, 24 * 60 * 60 * 1000); // 24 hours

    console.log("Weekly update schedule started - checking daily for updates older than 7 days");
  }

  stopUpdateSchedule(): void {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
      this.updateCheckInterval = null;
      console.log("Update schedule stopped");
    }
  }
}

export const cardDatabaseService = new CardDatabaseService();