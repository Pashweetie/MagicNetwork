import { Card } from "@shared/schema";
import { db } from "../db";
import { cardCache } from "@shared/schema";
import { sql } from "drizzle-orm";

export class PureAIRecommendationService {
  private textGenerator: any = null;
  private isReady = false;

  constructor() {
    this.initializeAI();
  }

  private async initializeAI() {
    if (this.isReady) return;
    
    try {
      const { pipeline } = await import('@xenova/transformers');
      console.log('Loading neural network for pure AI analysis...');
      this.textGenerator = await pipeline('text2text-generation', 'Xenova/flan-t5-small');
      this.isReady = true;
      console.log('Neural network ready for semantic analysis');
    } catch (error) {
      console.error('Failed to load neural network:', error);
    }
  }

  // Pure AI theme detection - no hardcoded patterns
  async analyzeCardThemes(card: Card): Promise<Array<{theme: string, description: string}>> {
    if (!this.isReady || !this.textGenerator) {
      console.log('Neural network not available');
      return [];
    }

    try {
      const prompt = `Analyze this Magic card for strategic deck themes. Card: "${card.name}" Type: "${card.type_line}" Text: "${card.oracle_text || 'No text'}" Mana: "${card.mana_cost || 'None'}" - List 2-3 strategic themes this supports like Token Generation, Graveyard Value, Control, Aggro, etc. Format: Theme1: Brief description. Theme2: Brief description.`;

      const response = await this.textGenerator(prompt, {
        max_new_tokens: 80,
        temperature: 0.4
      });

      const themes = this.parseAIThemeResponse(response[0]?.generated_text || '');
      console.log(`AI neural network identified ${themes.length} themes for ${card.name}`);
      return themes;

    } catch (error) {
      console.error('Neural network theme analysis failed:', error);
      return [];
    }
  }

  private parseAIThemeResponse(aiText: string): Array<{theme: string, description: string}> {
    const themes: Array<{theme: string, description: string}> = [];
    
    // Parse AI response for theme patterns
    const themeMatches = aiText.match(/([^:]+):\s*([^.]+\.?)/g);
    
    if (themeMatches) {
      for (const match of themeMatches.slice(0, 3)) {
        const colonIndex = match.indexOf(':');
        if (colonIndex > 0) {
          const themeName = match.substring(0, colonIndex).trim();
          const description = match.substring(colonIndex + 1).trim();
          
          if (themeName.length > 2 && themeName.length < 40 && description.length > 5) {
            themes.push({
              theme: themeName,
              description: description
            });
          }
        }
      }
    }

    return themes;
  }

  // Pure AI card matching for themes
  async findCardsForTheme(theme: {theme: string, description: string}, sourceCard: Card, filters?: any): Promise<Card[]> {
    if (!this.isReady || !this.textGenerator) return [];

    try {
      const candidates = await db
        .select()
        .from(cardCache)
        .where(sql`card_data->>'id' != ${sourceCard.id}`)
        .limit(600);

      const scoredCards: Array<{card: Card, score: number}> = [];

      for (const cached of candidates) {
        const card = cached.cardData as Card;
        if (!card?.id) continue;

        // Apply filters early to reduce AI processing
        if (filters && !this.cardMatchesFilters(card, filters)) continue;

        const aiScore = await this.scoreCardForThemeWithAI(card, theme);
        if (aiScore > 0.6) {
          scoredCards.push({ card, score: aiScore });
        }
      }

      return scoredCards
        .sort((a, b) => b.score - a.score)
        .slice(0, 12)
        .map(item => item.card);

    } catch (error) {
      console.error('AI card matching failed:', error);
      return [];
    }
  }

  private async scoreCardForThemeWithAI(card: Card, theme: {theme: string, description: string}): Promise<number> {
    try {
      const prompt = `Rate 0-100 how well this Magic card fits the "${theme.theme}" strategy: "${theme.description}". Card: "${card.name}" Type: "${card.type_line}" Text: "${card.oracle_text || 'No text'}" - Answer only a number 0-100:`;

      const response = await this.textGenerator(prompt, {
        max_new_tokens: 8,
        temperature: 0.1
      });

      const text = response[0]?.generated_text || '0';
      const scoreMatch = text.match(/\b([0-9]{1,3})\b/);
      return scoreMatch ? Math.min(parseInt(scoreMatch[1]) / 100, 1) : 0;

    } catch (error) {
      return 0;
    }
  }

  // Pure AI synergy analysis
  async analyzeSynergy(sourceCard: Card, targetCard: Card): Promise<{score: number, reason: string}> {
    if (!this.isReady || !this.textGenerator) {
      return { score: 0, reason: 'AI unavailable' };
    }

    try {
      const prompt = `Rate synergy 0-100 between Magic cards. Source: "${sourceCard.name}" (${sourceCard.type_line}) "${sourceCard.oracle_text || 'No text'}" Target: "${targetCard.name}" (${targetCard.type_line}) "${targetCard.oracle_text || 'No text'}" - Do they enable each other? Share strategies? Format: NUMBER|reason`;

      const response = await this.textGenerator(prompt, {
        max_new_tokens: 40,
        temperature: 0.3
      });

      const text = response[0]?.generated_text || '';
      const match = text.match(/(\d{1,3})\|(.+)/);

      if (match) {
        return {
          score: Math.min(parseInt(match[1]) || 0, 100),
          reason: match[2].trim()
        };
      }

      return { score: 0, reason: 'no synergy found' };

    } catch (error) {
      return { score: 0, reason: 'analysis failed' };
    }
  }

  // Pure AI functional similarity
  async analyzeFunctionalSimilarity(sourceCard: Card, targetCard: Card): Promise<{score: number, reason: string}> {
    if (!this.isReady || !this.textGenerator) {
      return { score: 0, reason: 'AI unavailable' };
    }

    try {
      const prompt = `Rate functional similarity 0-100 between Magic cards. Source: "${sourceCard.name}" (${sourceCard.type_line}) "${sourceCard.oracle_text || 'No text'}" Target: "${targetCard.name}" (${targetCard.type_line}) "${targetCard.oracle_text || 'No text'}" - Do they serve similar deck purposes? Format: NUMBER|reason`;

      const response = await this.textGenerator(prompt, {
        max_new_tokens: 40,
        temperature: 0.3
      });

      const text = response[0]?.generated_text || '';
      const match = text.match(/(\d{1,3})\|(.+)/);

      if (match) {
        return {
          score: Math.min(parseInt(match[1]) || 0, 100),
          reason: match[2].trim()
        };
      }

      return { score: 0, reason: 'not similar' };

    } catch (error) {
      return { score: 0, reason: 'analysis failed' };
    }
  }

  private cardMatchesFilters(card: Card, filters: any): boolean {
    if (!filters) return true;

    if (filters.colors && filters.colors.length > 0) {
      const cardColors = card.color_identity || card.colors || [];
      const hasMatchingColor = filters.colors.some((filterColor: string) => 
        cardColors.includes(filterColor)
      );
      if (!hasMatchingColor) return false;
    }

    if (filters.type) {
      if (!card.type_line.toLowerCase().includes(filters.type.toLowerCase())) return false;
    }

    if (filters.cmc !== undefined) {
      if (card.cmc !== filters.cmc) return false;
    }

    return true;
  }
}

export const pureAIService = new PureAIRecommendationService();