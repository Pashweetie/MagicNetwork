import { db } from "../db";
import { sql } from "drizzle-orm";
import { Card } from "@shared/schema";

export class BulkImportService {
  async findCardsByNames(cardNames: string[]): Promise<Map<string, Card>> {
    const cardMap = new Map<string, Card>();
    
    try {
      // Fallback to individual queries since complex ANY queries had issues
        for (const row of result.rows) {
          const card = this.convertRowToCard(row as any);
          cardMap.set(card.name.toLowerCase(), card);
          
          // Also map double-faced card names
          if (card.name.includes(' // ')) {
            const mainName = card.name.split(' // ')[0];
            cardMap.set(mainName.toLowerCase(), card);
          }
        }
      }
    } catch (error) {
      console.error('Bulk import service error:', error);
    }
    
    // Always use individual queries for reliability
      for (const cardName of cardNames) {
        try {
          const result = await db.execute(sql`
            SELECT id, name, mana_cost, cmc, type_line, oracle_text, colors, 
                   color_identity, power, toughness, rarity, set_code, set_name,
                   image_uris, card_faces, prices, legalities
            FROM cards 
            WHERE name = ${cardName}
            LIMIT 1
          `);
          
          if (result.rows && result.rows.length > 0) {
            const card = this.convertRowToCard(result.rows[0] as any);
            cardMap.set(card.name.toLowerCase(), card);
          }
        } catch (individualError) {
          console.error(`Failed to find card "${cardName}":`, individualError);
        }
      }
    
    return cardMap;
  }

  private convertRowToCard(row: any): Card {
    return {
      id: row.id,
      name: row.name,
      mana_cost: row.mana_cost,
      cmc: row.cmc,
      type_line: row.type_line,
      oracle_text: row.oracle_text,
      colors: row.colors || [],
      color_identity: row.color_identity || [],
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

export const bulkImportService = new BulkImportService();