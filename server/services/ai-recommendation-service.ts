import { Card } from "@shared/schema";
import { AIUtils } from "@shared/utils/ai-utils";
import { db } from "../db";
import { cardThemes, cardCache } from "@shared/schema";
import { eq, and, ne, sql, inArray, desc } from "drizzle-orm";
import { cardMatchesFilters } from "../utils/card-filters";

export class AIRecommendationService {
  private textGenerator: any = null;
  private isReady = false;
  private provider = 'none';

  constructor() {
    this.initializeAI();
  }

  private async initializeAI() {
    if (this.isReady) return;
    
    const { generator, isReady, provider } = await AIUtils.initializeAIProvider();
    this.textGenerator = generator;
    this.isReady = isReady;
    this.provider = provider;
  }

  // Generate themes for a card using predefined list + AI
  async generateCardThemes(card: Card): Promise<void> {
    // Skip theme generation for basic lands
    const { CardUtils } = await import('@shared/utils/card-utils');
    if (CardUtils.isBasicLand(card)) {
      console.log(`Skipping theme generation for basic land: ${card.name}`);
      return;
    }

    // Get oracle_id from the card data
    const oracleId = (card as any).oracle_id || (card as any).oracleId;
    if (!oracleId) {
      console.log(`No oracle_id found for card: ${card.name}`);
      return;
    }

    // Check if themes already exist for this card_id
    const existingThemes = await db
      .select()
      .from(cardThemes)
      .where(eq(cardThemes.card_id, card.id));

    if (existingThemes.length > 0) {
      console.log(`Themes already exist for card: ${card.name}`);
      return;
    }

    if (!this.isReady) {
      await this.initializeAI();
      if (!this.isReady) {
        console.log('AI not available for theme generation');
        return;
      }
    }

    try {
      const { PREDEFINED_THEMES } = await import('@shared/predefined-themes');
      const themeList = PREDEFINED_THEMES.join(', ');
      
      const cardContext = `Name: ${card.name}
Type: ${card.type_line}
Mana Cost: ${card.mana_cost || 'None'}
Oracle Text: ${card.oracle_text || 'No text'}`;

      const prompt = `Analyze this Magic: The Gathering card and identify which themes it fits from this EXACT list:

${themeList}

Card Details:
${cardContext}

Pick ALL relevant themes that apply to this card and give each a confidence percentage (1-100).
Respond in this exact format:
Theme1: 85%
Theme2: 70%
Theme3: 45%
Theme4: 60%

Only use themes from the provided list. Each theme must be spelled exactly as shown.`;

      const response = await AIUtils.generateWithAI(this.textGenerator, this.provider, prompt);
      
      if (response) {
        await this.parseAndStoreThemes(card.id, card.name, response);
      }
    } catch (error) {
      console.error('AI theme generation failed:', error);
    }
  }

  private async parseAndStoreThemes(cardId: string, cardName: string, response: string): Promise<void> {
    const lines = response.split('\n').filter(line => line.includes(':'));
    
    for (const line of lines) {
      const match = line.match(/(.+?):\s*(\d+)%/);
      if (match) {
        const [, themeName, confidenceStr] = match;
        const confidence = parseInt(confidenceStr);
        
        if (confidence >= 25 && confidence <= 100) {
          try {
            await db.insert(cardThemes).values({
              card_id: cardId,
              card_name: cardName,
              theme_name: themeName.trim(),
              confidence: confidence,
            }).onConflictDoNothing();
          } catch (error) {
            console.error('Failed to store theme:', error);
          }
        }
      }
    }
  }

  // Calculate synergy percentage between two cards using your algorithm
  calculateSynergy(cardAThemes: Array<{theme: string, confidence: number}>, 
                   cardBThemes: Array<{theme: string, confidence: number}>): number {
    if (cardAThemes.length === 0 || cardBThemes.length === 0) {
      return 0;
    }

    // Use lower theme count as denominator
    const denominator = Math.min(cardAThemes.length, cardBThemes.length);
    
    // Create maps for easy lookup
    const themeMapA = new Map(cardAThemes.map(t => [t.theme, t.confidence]));
    const themeMapB = new Map(cardBThemes.map(t => [t.theme, t.confidence]));
    
    let totalSimilarity = 0;
    
    // Find shared themes and calculate confidence similarity
    for (const [theme, confidenceA] of themeMapA) {
      const confidenceB = themeMapB.get(theme);
      if (confidenceB !== undefined) {
        // Calculate similarity: 1 - |confidenceA - confidenceB|/100
        const similarity = 1 - Math.abs(confidenceA - confidenceB) / 100;
        totalSimilarity += similarity;
      }
    }
    
    // Convert to percentage
    return (totalSimilarity / denominator) * 100;
  }

  // Find synergy recommendations for a card
  async findSynergyRecommendations(cardId: string, filters?: any): Promise<Array<{card: Card, synergyScore: number}>> {
    // Get source card oracle_id
    const sourceCardData = await db
      .select()
      .from(cardCache)
      .where(eq(cardCache.id, cardId))
      .limit(1);

    if (sourceCardData.length === 0) {
      return [];
    }

    const sourceCard = sourceCardData[0].cardData;
    const sourceOracleId = (sourceCard as any).oracle_id;
    
    if (!sourceOracleId) {
      return [];
    }

    // Get source card themes using card_id (until we migrate)
    const sourceThemes = await db
      .select()
      .from(cardThemes)
      .where(eq(cardThemes.card_id, cardId));

    if (sourceThemes.length === 0) {
      return [];
    }

    // Get all cards that share at least one theme
    const sharedThemeNames = sourceThemes.map(t => t.theme_name);
    const candidateCards = await db
      .select({ card_id: cardThemes.card_id })
      .from(cardThemes)
      .where(and(
        inArray(cardThemes.theme_name, sharedThemeNames),
        ne(cardThemes.card_id, cardId)
      ));

    // Get unique card IDs
    const uniqueCardIds = [...new Set(candidateCards.map(c => c.card_id))];
    
    // Group cards by oracle_id to avoid duplicates
    const oracleIdToCard = new Map<string, {card: Card, synergyScore: number}>();

    // Calculate synergy for each candidate card
    for (const candidateCardId of uniqueCardIds) {
      const candidateThemes = await db
        .select()
        .from(cardThemes)
        .where(eq(cardThemes.card_id, candidateCardId));

      const synergyScore = this.calculateSynergy(
        sourceThemes.map(t => ({ theme: t.theme_name, confidence: t.confidence })),
        candidateThemes.map(t => ({ theme: t.theme_name, confidence: t.confidence }))
      );

      // Only include if synergy is 25% or higher
      if (synergyScore >= 25) {
        // Get the actual card data
        const cardData = await db
          .select()
          .from(cardCache)
          .where(eq(cardCache.id, candidateCardId))
          .limit(1);

        if (cardData.length > 0) {
          const card = cardData[0].cardData as Card;
          const cardOracleId = (card as any).oracle_id;
          
          // Skip if we don't have oracle_id
          if (!cardOracleId) continue;
          
          // Apply filters if provided
          if (!filters || cardMatchesFilters(card, filters)) {
            // Only keep the highest synergy score per oracle_id
            const existing = oracleIdToCard.get(cardOracleId);
            if (!existing || synergyScore > existing.synergyScore) {
              oracleIdToCard.set(cardOracleId, { card, synergyScore });
            }
          }
        }
      }
    }

    // Convert map to array and sort by synergy score
    return Array.from(oracleIdToCard.values())
      .sort((a, b) => b.synergyScore - a.synergyScore)
      .slice(0, 20);
  }

  // Get cards for a specific theme (for themes tab)
  async getCardsForTheme(themeName: string, sourceCardId: string, filters?: any): Promise<Array<{card: Card, confidence: number}>> {
    // Get source card oracle_id to exclude all its printings
    const sourceCardData = await db
      .select()
      .from(cardCache)
      .where(eq(cardCache.id, sourceCardId))
      .limit(1);

    const sourceOracleId = sourceCardData.length > 0 ? (sourceCardData[0].cardData as any).oracle_id : null;

    // Get all cards with this theme, excluding source card
    const themeCards = await db
      .select()
      .from(cardThemes)
      .where(and(
        eq(cardThemes.theme_name, themeName),
        ne(cardThemes.card_id, sourceCardId)
      ))
      .orderBy(desc(cardThemes.confidence));

    // Group by oracle_id to avoid duplicates
    const oracleIdToCard = new Map<string, {card: Card, confidence: number}>();

    for (const themeCard of themeCards) {
      try {
        const cardData = await db
          .select()
          .from(cardCache)
          .where(eq(cardCache.id, themeCard.card_id))
          .limit(1);

        if (cardData.length > 0) {
          const card = cardData[0].cardData as Card;
          const cardOracleId = (card as any).oracle_id;
          
          // Skip if it's the same oracle_id as source card
          if (cardOracleId && cardOracleId === sourceOracleId) continue;
          
          // Apply filters if provided
          if (!filters || cardMatchesFilters(card, filters)) {
            // Use oracle_id for deduplication if available, otherwise use card_id
            const dedupeKey = cardOracleId || themeCard.card_id;
            
            // Only keep the highest confidence per deduplication key
            const existing = oracleIdToCard.get(dedupeKey);
            if (!existing || themeCard.confidence > existing.confidence) {
              oracleIdToCard.set(dedupeKey, { card, confidence: themeCard.confidence });
            }
          }
        }
      } catch (error) {
        console.error(`Error fetching card ${themeCard.card_id}:`, error);
        continue;
      }
    }

    return Array.from(oracleIdToCard.values())
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 50);
  }
}

export const aiRecommendationService = new AIRecommendationService();