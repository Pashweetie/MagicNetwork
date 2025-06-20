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
      const prompt = `Analyze this Magic: The Gathering card and provide both strategic themes and gameplay tags.

${cardContext}

Provide your analysis in this exact format:

THEMES:
[Theme 1]: [Description of theme strategy]
[Theme 2]: [Description of theme strategy]
[Theme 3]: [Description of theme strategy]

TAGS:
[tag1, tag2, tag3, tag4, tag5, tag6]

For THEMES, focus on:
- Deck archetypes this card enables (aggro, control, combo, midrange)
- Strategic synergies and build-around potential
- Win condition strategies

For TAGS, focus on:
- Mechanical keywords (flying, trample, etc.)
- Strategic categories (removal, ramp, draw, etc.)
- Tribal types and artifact/enchantment synergies
- Single words or short phrases only`;

      const response = await AIUtils.generateWithAI(this.textGenerator, this.provider, prompt);
      if (response) {
        return this.parseUnifiedResponse(response, card);
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
          await db.insert(cardThemes).values({
            card_id: card.id,
            theme_name: themeData.theme,
            theme_category: themeData.category,
            confidence: Math.round(themeData.confidence * 100), // Convert 0-1 to 0-100
            description: themeData.description,
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

    // Fallback if parsing failed
    if (themes.length === 0) {
      themes.push(...this.getFallbackThemes(card));
    }
    if (tags.length === 0) {
      tags.push(...this.getFallbackTags(card));
    }

    return { themes, tags };
  }

  private getFallbackThemes(card: Card): Array<{theme: string, description: string}> {
    const themes: Array<{theme: string, description: string}> = [];
    const typeLine = card.type_line?.toLowerCase() || '';
    
    if (typeLine.includes('creature')) {
      themes.push({ theme: 'Creature-based', description: 'Build around creature synergies' });
    }
    if (typeLine.includes('artifact')) {
      themes.push({ theme: 'Artifact', description: 'Artifact-based strategies' });
    }
    if (typeLine.includes('enchantment')) {
      themes.push({ theme: 'Enchantment', description: 'Enchantment synergies' });
    }
    
    return themes;
  }

  private getFallbackTags(card: Card): Array<{tag: string, confidence: number}> {
    const tags: Array<{tag: string, confidence: number}> = [];
    const typeLine = card.type_line?.toLowerCase() || '';
    
    if (typeLine.includes('creature')) tags.push({ tag: 'creature', confidence: 0.9 });
    if (typeLine.includes('artifact')) tags.push({ tag: 'artifact', confidence: 0.9 });
    if (typeLine.includes('enchantment')) tags.push({ tag: 'enchantment', confidence: 0.9 });
    if (typeLine.includes('instant')) tags.push({ tag: 'instant', confidence: 0.9 });
    if (typeLine.includes('sorcery')) tags.push({ tag: 'sorcery', confidence: 0.9 });
    
    return tags;
  }
}

export const unifiedAIService = new UnifiedAIService();