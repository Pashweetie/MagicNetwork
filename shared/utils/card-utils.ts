import { Card } from "../schema";

// Shared card utility functions to reduce duplication across components
export class CardUtils {
  static getCardImage(card: Card): string | null {
    if (card.image_uris?.normal) {
      return card.image_uris.normal;
    }
    if (card.image_uris?.small) {
      return card.image_uris.small;
    }
    if (card.card_faces?.[0]?.image_uris?.normal) {
      return card.card_faces[0].image_uris.normal;
    }
    if (card.card_faces?.[0]?.image_uris?.small) {
      return card.card_faces[0].image_uris.small;
    }
    return null;
  }

  static getPrice(card: Card): string | null {
    if (card.prices?.usd) {
      return `$${card.prices.usd}`;
    }
    return null;
  }

  static getColors(card: Card): string[] {
    return card.colors || card.color_identity || [];
  }

  static canBeCommander(card: Card): boolean {
    const typeLine = card.type_line?.toLowerCase() || '';
    const isLegendary = typeLine.includes('legendary');
    const isCreature = typeLine.includes('creature');
    const isPlaneswalker = typeLine.includes('planeswalker');
    return isLegendary && (isCreature || isPlaneswalker);
  }

  static isValidCard(card: Card): boolean {
    return !!(card && card.type_line && card.name);
  }

  static getCardContext(card: Card): string {
    return `Card: ${card.name}
Type: ${card.type_line}
Mana Cost: ${card.mana_cost || 'None'}
Oracle Text: ${card.oracle_text || 'No text'}
Power/Toughness: ${card.power && card.toughness ? `${card.power}/${card.toughness}` : 'N/A'}`;
  }
}

// Color mapping constants
export const COLOR_MAPPING: Record<string, string> = {
  'W': 'bg-yellow-200',
  'U': 'bg-blue-500',
  'B': 'bg-gray-800',
  'R': 'bg-red-500',
  'G': 'bg-green-500',
};