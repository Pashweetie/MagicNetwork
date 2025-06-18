import { db } from "./db";
import { cardCache } from "@shared/schema";
import { Card } from "@shared/schema";

interface ScryfallBulkData {
  object: string;
  id: string;
  type: string;
  updated_at: string;
  uri: string;
  name: string;
  description: string;
  size: number;
  download_uri: string;
  content_type: string;
  content_encoding: string;
}

export class CardDownloader {
  private async getBulkDataInfo(): Promise<ScryfallBulkData[]> {
    const response = await fetch('https://api.scryfall.com/bulk-data');
    const data = await response.json();
    return data.data;
  }

  private async downloadBulkData(downloadUri: string): Promise<Card[]> {
    console.log(`Downloading cards from: ${downloadUri}`);
    const response = await fetch(downloadUri);
    
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.status}`);
    }

    const cards = await response.json();
    console.log(`Downloaded ${cards.length} cards`);
    return cards;
  }

  async downloadAllCards(): Promise<void> {
    try {
      console.log('Starting bulk card download...');
      
      // Get bulk data info
      const bulkData = await this.getBulkDataInfo();
      const defaultCards = bulkData.find(item => item.type === 'default_cards');
      
      if (!defaultCards) {
        throw new Error('Default cards bulk data not found');
      }

      console.log(`Bulk data size: ${(defaultCards.size / 1024 / 1024).toFixed(2)} MB`);
      
      // Download all cards
      const cards = await this.downloadBulkData(defaultCards.download_uri);
      
      // Process in batches to avoid memory issues
      const batchSize = 1000;
      let processed = 0;
      
      for (let i = 0; i < cards.length; i += batchSize) {
        const batch = cards.slice(i, i + batchSize);
        await this.processBatch(batch);
        processed += batch.length;
        console.log(`Processed ${processed}/${cards.length} cards (${((processed / cards.length) * 100).toFixed(1)}%)`);
      }
      
      console.log('Bulk download completed successfully!');
      
    } catch (error) {
      console.error('Error downloading cards:', error);
      throw error;
    }
  }

  private async processBatch(cards: Card[]): Promise<void> {
    const values = cards.map(card => ({
      id: card.id,
      cardData: card,
      lastUpdated: new Date(),
      searchCount: 0
    }));

    try {
      await db.insert(cardCache)
        .values(values)
        .onConflictDoUpdate({
          target: cardCache.id,
          set: {
            cardData: (excluded: any) => excluded.cardData,
            lastUpdated: new Date()
          }
        });
    } catch (error) {
      console.error('Error inserting batch:', error);
      // Continue with next batch
    }
  }

  async getDownloadStatus(): Promise<{ total: number, hasData: boolean }> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(cardCache);
    
    return {
      total: result[0]?.count || 0,
      hasData: (result[0]?.count || 0) > 0
    };
  }
}

// CLI usage
if (require.main === module) {
  const downloader = new CardDownloader();
  downloader.downloadAllCards()
    .then(() => {
      console.log('Download complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Download failed:', error);
      process.exit(1);
    });
}