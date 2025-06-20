import { Card } from "@shared/schema";
import { AIUtils } from "@shared/utils/ai-utils";
import { CardUtils } from "@shared/utils/card-utils";
import { db } from "../db";
import { cardThemes } from "@shared/schema";
import { sql, eq } from "drizzle-orm";

// Unified AI service that consolidates theme and tag generation
export class UnifiedAIService {
  private textGenerator: any = null;
  private isReady = false;
  private provider = 'none';

  constructor() {
    this.initializeAI();
  }

  public async initializeAI() {
    if (this.isReady) return;
    
    const { generator, isReady, provider } = await AIUtils.initializeAIProvider();
    this.textGenerator = generator;
    this.isReady = isReady;
    this.provider = provider;
  }

  // Generate both themes and tags in a single AI call to reduce API usage
  async analyzeCard(card: Card): Promise<{
    themes: Array<{theme: string, description: string}>,
    tags: Array<{tag: string, confidence: number}>
  }> {
    if (!this.isReady) {
      await this.initializeAI();
      if (!this.isReady) {
        return { themes: this.getFallbackThemes(card), tags: this.getFallbackTags(card) };
      }
    }

    try {
      const cardContext = CardUtils.getCardContext(card);
      const { PREDEFINED_THEMES } = await import('@shared/predefined-themes');
      const themeList = PREDEFINED_THEMES.join(', ');
      
      const prompt = `Analyze this Magic: The Gathering card and identify which themes it fits from this EXACT list:

${themeList}

Card Details:
${cardContext}

Provide your analysis in this exact format:

THEMES:
[Theme from list]: [Why this card fits this theme]
[Theme from list]: [Why this card fits this theme]
[Theme from list]: [Why this card fits this theme]

Rules:
- Only use themes from the provided list above
- Choose 1-3 most relevant themes
- Each theme must be spelled exactly as shown in the list
- Explain why the card fits each theme`;

      const response = await AIUtils.generateWithAI(this.textGenerator, this.provider, prompt);
      if (response) {
        return await this.parseUnifiedResponse(response, card);
      }
    } catch (error) {
      console.error('Unified AI analysis failed:', error);
    }

    return { themes: this.getFallbackThemes(card), tags: this.getFallbackTags(card) };
  }

  // Get cached themes or generate new ones
  async getCardThemes(card: Card): Promise<Array<{theme: string, description: string}>> {
    try {
      const existingThemes = await db
        .select()
        .from(cardThemes)
        .where(eq(cardThemes.card_id, card.id))
        .limit(5);

      if (existingThemes.length > 0) {
        return existingThemes.map(theme => ({
          theme: theme.theme_name,
          description: theme.description || `${theme.theme_name} strategy`
        }));
      }

      const analysis = await this.analyzeCard(card);
      
      // Store themes in database
      for (const theme of analysis.themes) {
        try {
          await db.insert(cardThemes).values({
            card_id: card.id,
            theme_name: theme.theme,
            theme_category: 'AI-Generated',
            description: theme.description,
            confidence: 0.8,
            keywords: [theme.theme.toLowerCase()]
          }).onConflictDoNothing();
        } catch (error) {
          console.error('Failed to store theme:', error);
        }
      }

      return analysis.themes;
    } catch (error) {
      console.error('Error getting card themes:', error);
      return this.getFallbackThemes(card);
    }
  }

  // Get cached tags or generate new ones
  async getCardThemes(card: Card): Promise<Array<{theme: string, description: string, confidence: number, category: string}>> {
    try {
      const existingThemes = await db
        .select()
        .from(cardThemes)
        .where(eq(cardThemes.card_id, card.id))
        .limit(8);

      if (existingThemes.length > 0) {
        return existingThemes.map(t => ({
          theme: t.theme_name,
          description: t.description || '',
          confidence: t.confidence / 100, // Convert from 0-100 to 0-1
          category: t.theme_category
        }));
      }

      const analysis = await this.analyzeCard(card);
      
      // Store themes in database
      for (const themeData of analysis.themes || []) {
        try {
          // Clean and validate theme data
          let themeName = themeData.theme;
          if (typeof themeName !== 'string' || !themeName.trim()) {
            console.error('Invalid theme name:', themeName);
            continue;
          }
          
          // Clean and validate theme name against predefined list
          themeName = themeName
            .replace(/^\*+\s*\d*\.?\s*/, '') // Remove markdown and numbering
            .replace(/^\d+\.\s*/, '') // Remove numbering
            .replace(/\*+/g, '') // Remove asterisks
            .trim();
          
          if (!themeName) {
            console.error('Empty theme name after cleaning');
            continue;
          }
          
          // Validate theme is from predefined list
          const { findClosestTheme } = await import('@shared/predefined-themes');
          const validTheme = findClosestTheme(themeName);
          
          if (!validTheme) {
            console.warn(`Invalid theme "${themeName}" not in predefined list, skipping`);
            continue;
          }
          
          // Use the standardized theme name
          themeName = validTheme;
          
          // AI always sets default confidence of 50 for consistency
          const confidenceScore = 50;
          
          // Validate other fields
          const category = themeData.category || 'strategy';
          const description = themeData.description || 'Theme description';
          
          await db.insert(cardThemes).values({
            card_id: card.id,
            theme_name: themeName,
            theme_category: category,
            base_confidence: confidenceScore,
            final_score: confidenceScore, // Initialize final_score to base_confidence
            description: description,
            keywords: []
          }).onConflictDoNothing();
        } catch (error) {
          console.error('Failed to store theme:', error);
        }
      }

      return analysis.themes;
    } catch (error) {
      console.error('Error getting card themes:', error);
      return this.getFallbackThemes(card);
    }
  }

  private parseUnifiedResponse(response: string, card: Card): {
    themes: Array<{theme: string, description: string}>,
    tags: Array<{tag: string, confidence: number}>
  } {
    const themes: Array<{theme: string, description: string}> = [];
    const tags: Array<{tag: string, confidence: number}> = [];

    const lines = response.split('\n');
    let currentSection = '';

    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.toUpperCase().includes('THEMES:')) {
        currentSection = 'themes';
        continue;
      }
      
      if (trimmed.toUpperCase().includes('TAGS:')) {
        currentSection = 'tags';
        continue;
      }

      if (currentSection === 'themes' && trimmed.includes(':')) {
        const [theme, description] = trimmed.split(':').map(s => s.trim());
        if (theme && description) {
          themes.push({ theme, description });
        }
      }

      if (currentSection === 'tags' && trimmed.includes(',')) {
        const parsedTags = AIUtils.parseDelimitedResponse(trimmed, ',');
        for (const tag of parsedTags.slice(0, 8)) {
          tags.push({
            tag: tag,
            confidence: 0.8 + Math.random() * 0.2
          });
        }
      }
    }

    return { themes, tags };
  }
}

export const unifiedAIService = new UnifiedAIService();