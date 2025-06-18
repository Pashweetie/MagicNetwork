import { Card } from "@shared/schema";
import { storage } from "../storage";
import { pureAIService } from "./pure-ai-recommendations";

export class TagSystem {
  // Generate AI-powered tags for a card
  async generateCardTags(card: Card): Promise<Array<{tag: string, confidence: number}>> {
    try {
      // Check if we already have tags for this card
      const existingTags = await storage.getCardTags(card.id);
      if (existingTags.length > 0) {
        return existingTags.map(t => ({tag: t.tag, confidence: t.confidence || 0.8}));
      }

      // Use AI to generate tags
      const tags = await this.generateTagsWithAI(card);
      
      // Store tags in database
      for (const tagData of tags) {
        await storage.createCardTag({
          cardId: card.id,
          tag: tagData.tag,
          confidence: tagData.confidence,
          aiGenerated: true,
          upvotes: 0,
          downvotes: 0
        });
      }

      return tags;
    } catch (error) {
      console.error('Error generating card tags:', error);
      return this.getFallbackTags(card);
    }
  }

  private async generateTagsWithAI(card: Card): Promise<Array<{tag: string, confidence: number}>> {
    if (!pureAIService.isReady) {
      await pureAIService.initializeAI();
      if (!pureAIService.isReady) {
        return this.getFallbackTags(card);
      }
    }

    try {
      const cardContext = `Card: ${card.name}
Type: ${card.type_line}
Mana Cost: ${card.mana_cost || 'None'}
Oracle Text: ${card.oracle_text || 'No text'}
Power/Toughness: ${card.power && card.toughness ? `${card.power}/${card.toughness}` : 'N/A'}`;

      if (pureAIService.textGenerator?.getGenerativeModel) {
        const model = pureAIService.textGenerator.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `Analyze this Magic: The Gathering card and generate 5-8 strategic tags that describe its mechanics, themes, and deck archetypes.

${cardContext}

Return tags as a comma-separated list of single words or short phrases (2-3 words max). Focus on:
- Mechanical keywords (flying, trample, etc.)
- Strategic archetypes (aggro, control, combo, midrange)
- Tribal types (if relevant)
- Resource types (artifacts, enchantments, etc.)
- Win conditions (burn, mill, voltron, etc.)

Example: flying, aggro, tempo, evasion, tribal-birds, early-game

Tags:`;

        const result = await model.generateContent(prompt);
        const response = result.response.text() || '';
        
        return this.parseAITagResponse(response);
      }
    } catch (error) {
      console.error('AI tag generation failed:', error);
    }

    return this.getFallbackTags(card);
  }

  private parseAITagResponse(response: string): Array<{tag: string, confidence: number}> {
    const tags: Array<{tag: string, confidence: number}> = [];
    
    // Extract tags from response
    const tagLine = response.split('\n').find(line => 
      line.toLowerCase().includes('tags:') || 
      line.includes(',') ||
      !line.includes(':')
    ) || response;
    
    const rawTags = tagLine
      .replace(/tags:/i, '')
      .split(',')
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => tag.length > 0 && tag.length < 20);

    for (const tag of rawTags.slice(0, 8)) {
      tags.push({
        tag: tag,
        confidence: 0.8 + Math.random() * 0.2 // 0.8-1.0 range
      });
    }

    return tags;
  }

  private getFallbackTags(card: Card): Array<{tag: string, confidence: number}> {
    const tags: Array<{tag: string, confidence: number}> = [];
    const text = (card.oracle_text || '').toLowerCase();
    const type = (card.type_line || '').toLowerCase();

    // Basic type tags
    if (type.includes('creature')) tags.push({tag: 'creature', confidence: 0.9});
    if (type.includes('instant')) tags.push({tag: 'instant', confidence: 0.9});
    if (type.includes('sorcery')) tags.push({tag: 'sorcery', confidence: 0.9});
    if (type.includes('artifact')) tags.push({tag: 'artifact', confidence: 0.9});
    if (type.includes('enchantment')) tags.push({tag: 'enchantment', confidence: 0.9});
    if (type.includes('planeswalker')) tags.push({tag: 'planeswalker', confidence: 0.9});

    // Keyword abilities
    const keywords = ['flying', 'trample', 'haste', 'vigilance', 'lifelink', 'deathtouch', 'first strike', 'double strike'];
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        tags.push({tag: keyword, confidence: 0.8});
      }
    }

    // Mana cost based
    const cmc = card.cmc || 0;
    if (cmc <= 2) tags.push({tag: 'early-game', confidence: 0.7});
    else if (cmc >= 6) tags.push({tag: 'late-game', confidence: 0.7});
    else tags.push({tag: 'mid-game', confidence: 0.7});

    return tags.slice(0, 6);
  }

  // Find cards with similar tags
  async findCardsWithSimilarTags(cardId: string, filters?: any): Promise<Card[]> {
    const cardTags = await storage.getCardTags(cardId);
    if (cardTags.length === 0) return [];

    const tagNames = cardTags.map(t => t.tag);
    return await storage.findCardsByTags(tagNames, filters);
  }

  // Find synergistic cards based on tag relationships
  async findSynergisticCards(cardId: string, filters?: any): Promise<Array<{card: Card, score: number, reason: string}>> {
    const cardTags = await storage.getCardTags(cardId);
    if (cardTags.length === 0) return [];

    const synergisticCards: Array<{card: Card, score: number, reason: string}> = [];
    
    for (const tag of cardTags) {
      const relationships = await storage.getTagRelationships(tag.tag);
      
      for (const relationship of relationships) {
        if (relationship.synergyScore > 0.6) {
          const relatedCards = await storage.findCardsByTags([relationship.targetTag], filters);
          
          for (const card of relatedCards) {
            if (card.id !== cardId) {
              synergisticCards.push({
                card,
                score: relationship.synergyScore,
                reason: `${tag.tag} synergizes with ${relationship.targetTag}`
              });
            }
          }
        }
      }
    }

    // Sort by score and remove duplicates
    return synergisticCards
      .sort((a, b) => b.score - a.score)
      .filter((card, index, arr) => 
        arr.findIndex(c => c.card.id === card.card.id) === index
      )
      .slice(0, 20);
  }

  // Generate tag relationships using AI
  async generateTagRelationships(tag1: string, tag2: string): Promise<{synergyScore: number, relationshipType: string}> {
    try {
      if (pureAIService.textGenerator?.getGenerativeModel) {
        const model = pureAIService.textGenerator.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `Analyze the synergy between these two Magic: The Gathering strategy tags:

Tag 1: ${tag1}
Tag 2: ${tag2}

Rate their synergy from 0-100 and classify the relationship:
- synergy: Tags work well together (60-100)
- neutral: Tags are independent (40-59)
- antagony: Tags work against each other (0-39)

Respond with: SCORE|TYPE
Example: 85|synergy`;

        const result = await model.generateContent(prompt);
        const response = result.response.text() || '';
        
        const match = response.match(/(\d+)\s*\|\s*(synergy|neutral|antagony)/i);
        if (match) {
          return {
            synergyScore: parseInt(match[1]) / 100,
            relationshipType: match[2].toLowerCase()
          };
        }
      }
    } catch (error) {
      console.error('AI relationship generation failed:', error);
    }

    // Fallback: basic relationship analysis
    return this.getBasicTagRelationship(tag1, tag2);
  }

  private getBasicTagRelationship(tag1: string, tag2: string): {synergyScore: number, relationshipType: string} {
    // Simple heuristics for tag relationships
    const synergisticPairs = [
      ['flying', 'aggro'],
      ['artifact', 'artifact'],
      ['creature', 'tribal'],
      ['control', 'late-game'],
      ['aggro', 'early-game']
    ];

    const antagonisticPairs = [
      ['aggro', 'late-game'],
      ['control', 'early-game'],
      ['artifact', 'enchantment']
    ];

    for (const [t1, t2] of synergisticPairs) {
      if ((tag1.includes(t1) && tag2.includes(t2)) || (tag1.includes(t2) && tag2.includes(t1))) {
        return { synergyScore: 0.7, relationshipType: 'synergy' };
      }
    }

    for (const [t1, t2] of antagonisticPairs) {
      if ((tag1.includes(t1) && tag2.includes(t2)) || (tag1.includes(t2) && tag2.includes(t1))) {
        return { synergyScore: 0.3, relationshipType: 'antagony' };
      }
    }

    return { synergyScore: 0.5, relationshipType: 'neutral' };
  }
}

export const tagSystem = new TagSystem();