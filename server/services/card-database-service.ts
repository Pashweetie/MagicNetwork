import { db } from "../db";
import { cards, cardSets, cardImages, cardPrices, cardLegalities, cardRulings } from "@shared/schema";
import { Card, InsertCard, CardSet, InsertCardSet, InsertCardRuling } from "@shared/schema";
import { eq, sql, and, or, ilike, inArray, desc, asc } from "drizzle-orm";
import { SearchFilters, SearchResponse } from "@shared/schema";
import { cardMatchesFilters } from "../utils/card-filters";

const SCRYFALL_BULK_API = "https://api.scryfall.com/bulk-data";

interface BulkDataItem {
  type: 'oracle_cards' | 'unique_artwork' | 'default_cards' | 'all_cards' | 'rulings';
  name: string;
  description: string;
  download_uri: string;
  compressed_size?: number;
}

// Configuration for card filtering - can be adjusted without code changes
const CARD_FILTER_CONFIG = {
  excludedLayouts: ['token', 'art_series', 'emblem'],
  excludedSetTypes: ['memorabilia', 'token'],
  excludedBorderColors: ['gold'],
  excludeDigital: true,
  excludeOversized: true,
  // Add new exclusions here as needed
};

export class CardDatabaseService {
  private isDownloading = false;
  private downloadProgress = { current: 0, total: 0, status: 'idle' };
  private updateCheckInterval: NodeJS.Timeout | null = null;
  private isDownloadingRulings = false;

  async initializeDatabase(): Promise<void> {
    console.log("Initializing card database...");
    
    // Check if we have any cards in the database
    const cardCount = await this.getCardCount();
    
    if (cardCount < 50000) { // Consider incomplete if less than ~50k cards
      console.log(`Database has ${cardCount} cards. Completing download...`);
      await this.downloadAllCards();
    } else {
      console.log(`Database already contains ${cardCount} cards`);
      // Check if we need to update
      await this.checkForUpdates();
    }
    
    // Check and download rulings
    await this.checkAndDownloadRulings();
    
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
      
      // Use oracle_cards for best deduplication and latest card text
      // This avoids duplicate printings and ensures we get canonical card data
      let cardsData = bulkData.data.find((item: BulkDataItem) => item.type === 'oracle_cards');
      if (!cardsData) {
        console.warn("Oracle cards not available, falling back to default_cards (may include duplicates)");
        cardsData = bulkData.data.find((item: BulkDataItem) => item.type === 'default_cards');
      }
      if (!cardsData) {
        throw new Error("Could not find suitable cards bulk data");
      }
      
      console.log(`Using ${cardsData.type} bulk data for better card consistency`);

      console.log(`Downloading ${Math.round((cardsData.compressed_size || 0) / 1024 / 1024)}MB of card data...`);
      
      // Download the bulk card data
      const cardsResponse = await fetch(cardsData.download_uri);
      const cardsArray = await cardsResponse.json();

      this.downloadProgress.total = cardsArray.length;
      console.log(`Processing ${cardsArray.length} cards (${currentCount} already in database)...`);

      // Process cards in smaller batches to be more efficient
      const batchSize = 500;
      let processedNew = 0;
      
      for (let i = 0; i < cardsArray.length; i += batchSize) {
        const batch = cardsArray.slice(i, i + batchSize);
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

      // Skip digital-only cards, tokens, art cards, and other non-playable variants
      if (cardData.digital || 
          cardData.layout === 'token' || 
          cardData.layout === 'art_series' ||
          cardData.layout === 'emblem' ||
          cardData.set_type === 'memorabilia' ||
          cardData.set_type === 'token' ||
          cardData.border_color === 'gold' ||
          cardData.oversized === true) {
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

      // Convert Scryfall card to our enhanced format
      const card: InsertCard = {
        id: cardData.id,
        oracleId: cardData.oracle_id || null,
        name: cardData.name,
        printedName: cardData.printed_name || null,
        manaCost: cardData.mana_cost || null,
        cmc: Math.floor(cardData.cmc || 0),
        typeLine: cardData.type_line || 'Unknown',
        printedTypeLine: cardData.printed_type_line || null,
        oracleText: cardData.oracle_text || null,
        printedText: cardData.printed_text || null,
        flavorText: cardData.flavor_text || null,
        colors: cardData.colors || [],
        colorIdentity: cardData.color_identity || [],
        colorIndicator: cardData.color_indicator || null,
        power: cardData.power || null,
        toughness: cardData.toughness || null,
        loyalty: cardData.loyalty || null,
        defense: cardData.defense || null,
        handModifier: cardData.hand_modifier || null,
        lifeModifier: cardData.life_modifier || null,
        rarity: cardData.rarity,
        setCode: cardData.set,
        setName: cardData.set_name,
        setId: cardData.set_id || null,
        collectorNumber: cardData.collector_number,
        releasedAt: cardData.released_at,
        artist: cardData.artist || null,
        artistIds: cardData.artist_ids || null,
        illustrationId: cardData.illustration_id || null,
        borderColor: cardData.border_color || 'black',
        frame: cardData.frame || '2015',
        frameEffects: cardData.frame_effects || null,
        securityStamp: cardData.security_stamp || null,
        watermark: cardData.watermark || null,
        layout: cardData.layout || 'normal',
        highresImage: cardData.highres_image || false,
        gameFormat: cardData.games?.includes('arena') ? 'arena' : cardData.games?.includes('mtgo') ? 'mtgo' : 'paper',
        lang: cardData.lang || 'en',
        mtgoId: parseIntSafe(cardData.mtgo_id),
        mtgoFoilId: parseIntSafe(cardData.mtgo_foil_id),
        arenaId: parseIntSafe(cardData.arena_id),
        tcgplayerId: parseIntSafe(cardData.tcgplayer_id),
        cardmarketId: parseIntSafe(cardData.cardmarket_id),
        keywords: cardData.keywords || [],
        producedMana: cardData.produced_mana || [],
        allParts: cardData.all_parts || null,
        cardFaces: cardData.card_faces || null,
        imageUris: cardData.image_uris || null,
        prices: cardData.prices || null,
        legalities: cardData.legalities || null,
        edhrecRank: parseIntSafe(cardData.edhrec_rank),
        pennyRank: parseIntSafe(cardData.penny_rank),
        preview: cardData.preview || null,
        reprint: cardData.reprint || false,
        digital: cardData.digital || false,
        booster: cardData.booster !== false, // Default to true unless explicitly false
        storySpotlight: cardData.story_spotlight || false,
        promo: cardData.promo || false,
        promoTypes: cardData.promo_types || null,
        variation: cardData.variation || false,
        variationOf: cardData.variation_of || null,
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
    const limit = 50;
    const offset = (page - 1) * limit;
    
    console.log(`🔍 Database search: page=${page}, limit=${limit}, offset=${offset}, filters=`, JSON.stringify(filters));

    // Build WHERE conditions
    const whereParts: string[] = [];
    
    // Text search
    if (filters.query) {
      whereParts.push(`(name ILIKE '%${filters.query.replace(/'/g, "''")}%' OR oracle_text ILIKE '%${filters.query.replace(/'/g, "''")}%' OR type_line ILIKE '%${filters.query.replace(/'/g, "''")}%')`);
    }
    
    // Type filters - use AND logic for multiple types (e.g., "Instant Creature")
    if (filters.types && filters.types.length > 0) {
      const typeFilters = filters.types.map(type => `type_line ILIKE '%${type.replace(/'/g, "''")}%'`).join(' AND ');
      whereParts.push(`(${typeFilters})`);
    }
    
    // Rarity filters
    if (filters.rarities && filters.rarities.length > 0) {
      const rarityList = filters.rarities.map(r => `'${r.replace(/'/g, "''")}'`).join(',');
      whereParts.push(`rarity IN (${rarityList})`);
    }
    
    // Mana value filters
    if (filters.minMv !== undefined) {
      whereParts.push(`cmc >= ${filters.minMv}`);
    }
    if (filters.maxMv !== undefined) {
      whereParts.push(`cmc <= ${filters.maxMv}`);
    }
    
    // Set filter
    if (filters.set) {
      whereParts.push(`set_code = '${filters.set.replace(/'/g, "''")}'`);
    }
    
    // Power/Toughness filters
    if (filters.power) {
      whereParts.push(`power = '${filters.power.replace(/'/g, "''")}'`);
    }
    if (filters.toughness) {
      whereParts.push(`toughness = '${filters.toughness.replace(/'/g, "''")}'`);
    }
    
    // Oracle text filter
    if (filters.oracleText) {
      whereParts.push(`oracle_text ILIKE '%${filters.oracleText.replace(/'/g, "''")}%'`);
    }
    
    // Color filter (for sidebar color selection)
    if (filters.colors && filters.colors.length > 0) {
      // Check that the card contains ALL selected colors (AND logic)
      const colorList = filters.colors.map(c => `'${c.replace(/'/g, "''")}'`).join(',');
      const colorClause = `(color_identity @> ARRAY[${colorList}]::text[])`;
      console.log(`🎨 Color filter: selected colors=[${filters.colors.join(',')}], SQL clause: ${colorClause}`);
      whereParts.push(colorClause);
    }
    
    // Color identity filter (for Commander format)
    if (filters.colorIdentity && filters.colorIdentity.length > 0) {
      // Check that card's color identity is a subset of commander's color identity
      const colorList = filters.colorIdentity.map(c => `'${c.replace(/'/g, "''")}'`).join(',');
      const colorClause = `(color_identity <@ ARRAY[${colorList}]::text[])`;
      console.log(`🎨 Color identity filter: commander colors=[${filters.colorIdentity.join(',')}], SQL clause: ${colorClause}`);
      whereParts.push(colorClause);
    }
    
    const whereClause = whereParts.length > 0 ? 'WHERE ' + whereParts.join(' AND ') : '';

    // Simple query - show all cards matching filters (like Scryfall does)
    const searchQuery = `
      SELECT * FROM cards
      ${whereClause}
      ORDER BY name
      LIMIT ${limit} OFFSET ${offset}
    `;

    // Count query for total cards
    const countQuery = `
      SELECT COUNT(*) as count
      FROM cards
      ${whereClause}
    `;

    console.log(`🔍 Executing search query with WHERE: ${whereClause}`);

    // Execute both queries
    const [resultsResponse, countResponse] = await Promise.all([
      db.execute(sql.raw(searchQuery)),
      db.execute(sql.raw(countQuery))
    ]);

    const results = resultsResponse.rows;
    const totalCards = parseInt(countResponse.rows[0]?.count as string) || 0;
    
    console.log(`📊 Search results: found ${results.length} cards, totalCards=${totalCards}`);

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
    try {
      // Defensive checks for required fields
      if (!dbCard.id) {
        throw new Error('Card missing required id field');
      }
      if (!dbCard.name) {
        throw new Error(`Card ${dbCard.id} missing required name field`);
      }
      if (!dbCard.setCode) {
        console.warn(`Card ${dbCard.id} (${dbCard.name}) missing set_code, using 'unknown'`);
      }
      
      return {
        id: dbCard.id,
        oracle_id: dbCard.oracleId || dbCard.oracle_id,
        name: dbCard.name,
        mana_cost: dbCard.manaCost || dbCard.mana_cost,
        cmc: dbCard.cmc || 0,
        type_line: dbCard.typeLine || dbCard.type_line,
        oracle_text: dbCard.oracleText || dbCard.oracle_text,
        colors: dbCard.colors || [],
        color_identity: dbCard.colorIdentity || dbCard.color_identity || [],
        power: dbCard.power,
        toughness: dbCard.toughness,
        rarity: dbCard.rarity || 'common',
        set: dbCard.setCode || dbCard.set_code || 'unknown',
        set_name: dbCard.setName || dbCard.set_name || 'Unknown Set',
        image_uris: dbCard.imageUris || dbCard.image_uris,
        card_faces: dbCard.cardFaces || dbCard.card_faces,
        prices: dbCard.prices,
        legalities: dbCard.legalities,
      };
    } catch (error) {
      console.error('Error converting DB card to Card format:', error, 'dbCard:', dbCard);
      throw error;
    }
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

  async checkAndDownloadRulings(): Promise<void> {
    if (this.isDownloadingRulings) {
      console.log("Rulings download already in progress");
      return;
    }

    try {
      // Check if we have any rulings in the database
      const rulingsCount = await db.select({ count: sql<number>`count(*)` }).from(cardRulings);
      const currentRulingsCount = rulingsCount[0]?.count || 0;

      if (currentRulingsCount > 1000) {
        console.log(`Database already contains ${currentRulingsCount} rulings`);
        return;
      }

      console.log("Downloading card rulings...");
      this.isDownloadingRulings = true;

      // Get rulings bulk data
      const bulkResponse = await fetch(SCRYFALL_BULK_API);
      const bulkData = await bulkResponse.json();
      
      const rulingsData = bulkData.data.find((item: BulkDataItem) => item.type === 'rulings');
      if (!rulingsData) {
        console.log("No rulings bulk data available");
        return;
      }

      console.log(`Downloading ${Math.round((rulingsData.compressed_size || 0) / 1024 / 1024)}MB of rulings data...`);

      // Download the rulings data
      const rulingsResponse = await fetch(rulingsData.download_uri);
      const rulingsArray = await rulingsResponse.json();

      console.log(`Processing ${rulingsArray.length} rulings...`);

      // Process rulings in batches
      const batchSize = 1000;
      let processed = 0;

      for (let i = 0; i < rulingsArray.length; i += batchSize) {
        const batch = rulingsArray.slice(i, i + batchSize);
        const rulingsToInsert: InsertCardRuling[] = batch.map((ruling: any) => ({
          oracleId: ruling.oracle_id,
          publishedAt: ruling.published_at,
          comment: ruling.comment,
          source: ruling.source,
        }));

        await db.insert(cardRulings).values(rulingsToInsert).onConflictDoNothing();
        processed += batch.length;

        if (i % 5000 === 0) {
          console.log(`Processed ${processed}/${rulingsArray.length} rulings`);
        }
      }

      console.log(`Rulings download complete! Added ${rulingsArray.length} rulings.`);

    } catch (error) {
      console.error("Error downloading rulings:", error);
    } finally {
      this.isDownloadingRulings = false;
    }
  }

  async getRulingsForCard(oracleId: string): Promise<any[]> {
    if (!oracleId) return [];

    try {
      const rulings = await db.select()
        .from(cardRulings)
        .where(eq(cardRulings.oracleId, oracleId))
        .orderBy(sql`published_at DESC`);
      
      return rulings;
    } catch (error) {
      console.error("Error fetching rulings:", error);
      return [];
    }
  }

  async cleanupNonPlayableCards(): Promise<void> {
    console.log("Cleaning up non-playable cards from database...");
    
    try {
      // Remove art cards, tokens, and other non-playable variants
      const deleteResult = await db.delete(cards)
        .where(
          or(
            eq(cards.digital, true),
            eq(cards.layout, 'token'),
            eq(cards.layout, 'art_series'),
            eq(cards.layout, 'emblem'),
            sql`set_type = 'memorabilia'`,
            sql`set_type = 'token'`,
            eq(cards.borderColor, 'gold'),
            eq(cards.oversized, true)
          )
        );
      
      console.log(`Removed ${deleteResult.rowCount || 0} non-playable cards from database`);
      
      // Get updated card count
      const newCount = await this.getCardCount();
      console.log(`Database now contains ${newCount} playable cards`);
      
    } catch (error) {
      console.error("Error cleaning up database:", error);
    }
  }

  async downloadMissingData(): Promise<void> {
    console.log("Starting comprehensive data download...");
    
    // Clean up existing problematic cards first
    await this.cleanupNonPlayableCards();
    
    // Check what bulk data types are available
    const bulkResponse = await fetch(SCRYFALL_BULK_API);
    const bulkData = await bulkResponse.json();
    
    console.log("Available Scryfall bulk data types:");
    bulkData.data.forEach((item: BulkDataItem) => {
      console.log(`- ${item.type}: ${item.name} (${Math.round((item.compressed_size || 0) / 1024 / 1024)}MB)`);
    });
    
    // Download rulings if not already downloaded
    await this.checkAndDownloadRulings();
    
    console.log("Database cleanup and optimization complete!");
  }
}

export const cardDatabaseService = new CardDatabaseService();