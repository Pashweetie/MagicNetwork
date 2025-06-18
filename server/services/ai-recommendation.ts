import { storage } from "../storage";
import { Card, cardThemes } from "@shared/schema";
import { db } from "../db";
import { cardCache } from "@shared/schema";
import { sql } from "drizzle-orm";

export class AIRecommendationService {
  private textGenerator: any = null;
  private isInitializing = false;

  constructor() {
    this.initializeAI();
  }

  private async initializeAI() {
    if (this.isInitializing || this.textGenerator) return;
    this.isInitializing = true;

    try {
      const { pipeline } = await import('@xenova/transformers');
      console.log('Loading AI model for semantic analysis...');
      this.textGenerator = await pipeline('text2text-generation', 'Xenova/flan-t5-small');
      console.log('AI model loaded for recommendations');
    } catch (error) {
      console.error('Failed to load AI model:', error);
    } finally {
      this.isInitializing = false;
    }
  }

  // AI-driven theme detection
  async analyzeCardThemes(card: Card): Promise<Array<{name: string, description: string}>> {
    if (!this.textGenerator) {
      console.log('AI model not available for theme analysis');
      return [];
    }

    try {
      const prompt = `Analyze this Magic card for strategic themes. Card: ${card.name}. Type: ${card.type_line}. Text: ${card.oracle_text || 'No text'}. List 2-3 strategic themes this card supports like "Artifact Synergy", "Token Generation", "Graveyard Value". Format: Theme1: Description1. Theme2: Description2.`;

      const response = await this.textGenerator(prompt, {
        max_new_tokens: 100,
        temperature: 0.3
      });

      return this.parseThemeResponse(response[0]?.generated_text || '');
    } catch (error) {
      console.error('AI theme analysis failed:', error);
      return [];
    }
  }

  private parseThemeResponse(text: string): Array<{name: string, description: string}> {
    const themes: Array<{name: string, description: string}> = [];
    
    // Parse theme responses in format "Theme: Description"
    const themeMatches = text.match(/([^:]+):\s*([^.]+)/g);
    
    if (themeMatches) {
      for (const match of themeMatches.slice(0, 3)) {
        const [themeName, description] = match.split(':').map(s => s.trim());
        if (themeName && description && themeName.length < 50) {
          themes.push({
            name: themeName,
            description: description
          });
        }
      }
    }

    return themes;
  }

  // AI-driven card similarity for themes
  async findCardsForTheme(theme: {name: string, description: string}, sourceCard: Card, filters?: any): Promise<Card[]> {
    if (!this.textGenerator) return [];

    try {
      console.log(`AI finding cards for theme: ${theme.name}`);
      
      // Get candidate cards from database
      const candidates = await db
        .select()
        .from(cardCache)
        .where(sql`card_data->>'id' != ${sourceCard.id}`)
        .limit(800);

      const matchingCards: Array<{card: Card, score: number}> = [];

      // Use AI to score each card's relevance to the theme
      for (const cached of candidates) {
        const card = cached.cardData as Card;
        if (!card || !card.id) continue;

        // Apply filters early
        if (filters && !this.cardMatchesFilters(card, filters)) continue;

        const score = await this.scoreCardForTheme(card, theme);
        if (score > 0.5) {
          matchingCards.push({ card, score });
        }
      }

      return matchingCards
        .sort((a, b) => b.score - a.score)
        .slice(0, 12)
        .map(item => item.card);

    } catch (error) {
      console.error('AI card finding failed:', error);
      return [];
    }
  }

  private async scoreCardForTheme(card: Card, theme: {name: string, description: string}): Promise<number> {
    try {
      const prompt = `Does this Magic card fit the "${theme.name}" theme? Card: ${card.name}. Type: ${card.type_line}. Text: ${card.oracle_text || 'No text'}. Theme description: ${theme.description}. Answer with a number 0-100 only.`;

      const response = await this.textGenerator(prompt, {
        max_new_tokens: 5,
        temperature: 0.1
      });

      const text = response[0]?.generated_text || '0';
      const scoreMatch = text.match(/\b([0-9]{1,3})\b/);
      return scoreMatch ? Math.min(parseInt(scoreMatch[1]) / 100, 1) : 0;

    } catch (error) {
      return 0;
    }
  }

  // AI-driven synergy analysis
  async analyzeSynergy(sourceCard: Card, targetCard: Card): Promise<{score: number, reason: string}> {
    if (!this.textGenerator) {
      return { score: 0, reason: 'AI unavailable' };
    }

    try {
      const prompt = `Rate synergy 0-100 between these Magic cards. Source: ${sourceCard.name} (${sourceCard.type_line}) - ${sourceCard.oracle_text || 'No text'}. Target: ${targetCard.name} (${targetCard.type_line}) - ${targetCard.oracle_text || 'No text'}. Do they enable each other or share strategies? Format: SCORE|REASON`;

      const response = await this.textGenerator(prompt, {
        max_new_tokens: 40,
        temperature: 0.2
      });

      const text = response[0]?.generated_text || '';
      const match = text.match(/(\d{1,3})\|(.+)/);

      if (match) {
        return {
          score: Math.min(parseInt(match[1]) || 0, 100),
          reason: match[2].trim()
        };
      }

      return { score: 0, reason: 'no synergy detected' };

    } catch (error) {
      return { score: 0, reason: 'analysis failed' };
    }
  }

  // AI-driven functional similarity
  async analyzeFunctionalSimilarity(sourceCard: Card, targetCard: Card): Promise<{score: number, reason: string}> {
    if (!this.textGenerator) {
      return { score: 0, reason: 'AI unavailable' };
    }

    try {
      const prompt = `Rate functional similarity 0-100 between these Magic cards. Source: ${sourceCard.name} (${sourceCard.type_line}) - ${sourceCard.oracle_text || 'No text'}. Target: ${targetCard.name} (${targetCard.type_line}) - ${targetCard.oracle_text || 'No text'}. Do they serve similar strategic purposes? Format: SCORE|REASON`;

      const response = await this.textGenerator(prompt, {
        max_new_tokens: 40,
        temperature: 0.2
      });

      const text = response[0]?.generated_text || '';
      const match = text.match(/(\d{1,3})\|(.+)/);

      if (match) {
        return {
          score: Math.min(parseInt(match[1]) || 0, 100),
          reason: match[2].trim()
        };
      }

      return { score: 0, reason: 'not functionally similar' };

    } catch (error) {
      return { score: 0, reason: 'analysis failed' };
    }
  }

  private cardMatchesFilters(card: Card, filters: any): boolean {
    if (!filters) return true;

    // Color filtering
    if (filters.colors && filters.colors.length > 0) {
      const cardColors = card.color_identity || card.colors || [];
      const hasMatchingColor = filters.colors.some((filterColor: string) => 
        cardColors.includes(filterColor)
      );
      if (!hasMatchingColor) return false;
    }

    // Type filtering
    if (filters.type) {
      if (!card.type_line.toLowerCase().includes(filters.type.toLowerCase())) return false;
    }

    // Mana cost filtering
    if (filters.cmc !== undefined) {
      if (card.cmc !== filters.cmc) return false;
    }

    return true;
  }

  // Cache verified themes from user feedback
  async cacheVerifiedTheme(cardId: string, theme: string, description: string): Promise<void> {
    try {
      // Store user-verified theme in database for future use
      await db.insert(cardThemes).values({
        cardId,
        name: theme,
        description,
        keywords: [],
        searchTerms: []
      });
      console.log(`Cached verified theme: ${theme} for card ${cardId}`);
    } catch (error) {
      console.error('Failed to cache verified theme:', error);
    }
  }
}

export const aiRecommendationService = new AIRecommendationService();