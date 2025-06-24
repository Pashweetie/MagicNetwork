import { Card } from "../schema";

export class CommanderUtils {
  /**
   * Check if a card is legal in a commander deck based on color identity
   */
  static isLegalInCommander(card: Card, commander: Card): boolean {
    if (!card || !commander) return false;
    
    const commanderColors = commander.color_identity || [];
    const cardColors = card.color_identity || [];
    
    // Card's color identity must be a subset of commander's color identity
    return cardColors.every(color => commanderColors.includes(color));
  }
  
  /**
   * Filter an array of cards to only include those legal under the commander
   */
  static filterLegalCards<T extends { card?: Card } | Card>(
    cards: T[], 
    commander: Card
  ): T[] {
    return cards.filter(item => {
      const card = 'card' in item ? item.card : item;
      return card ? this.isLegalInCommander(card, commander) : false;
    });
  }
  
  /**
   * Get the color identity string for display purposes
   */
  static getColorIdentityString(card: Card): string {
    const colors = card.color_identity || [];
    if (colors.length === 0) return 'Colorless';
    return colors.join('');
  }
}