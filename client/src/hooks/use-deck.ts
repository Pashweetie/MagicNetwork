import { useState, useCallback } from "react";
import { Card } from "@shared/schema";

export interface DeckEntry {
  card: Card;
  quantity: number;
}

export interface DeckFormat {
  name: string;
  maxCopies: number;
  isSingleton: boolean;
  allowMultipleBasics: boolean;
  specialRules?: (card: Card) => number; // Return max allowed copies for this card
}

export const FORMATS: DeckFormat[] = [
  {
    name: "Commander",
    maxCopies: 1,
    isSingleton: true,
    allowMultipleBasics: true,
    specialRules: (card: Card) => {
      // Basic lands can have any number
      if (card.type_line?.includes("Basic Land")) return 999;
      // Cards that say "any number" in their text
      if (card.oracle_text?.includes("any number") || 
          card.oracle_text?.includes("A deck can have any number")) return 999;
      // Relentless Rats, Shadowborn Apostle, etc.
      if (card.name === "Relentless Rats" || 
          card.name === "Shadowborn Apostle" ||
          card.name === "Rat Colony" ||
          card.name === "Persistent Petitioners") return 999;
      return 1;
    }
  },
  {
    name: "Standard",
    maxCopies: 4,
    isSingleton: false,
    allowMultipleBasics: true,
    specialRules: (card: Card) => {
      if (card.type_line?.includes("Basic Land")) return 999;
      return 4;
    }
  },
  {
    name: "Modern",
    maxCopies: 4,
    isSingleton: false,
    allowMultipleBasics: true,
    specialRules: (card: Card) => {
      if (card.type_line?.includes("Basic Land")) return 999;
      return 4;
    }
  },
  {
    name: "Legacy",
    maxCopies: 4,
    isSingleton: false,
    allowMultipleBasics: true,
    specialRules: (card: Card) => {
      if (card.type_line?.includes("Basic Land")) return 999;
      return 4;
    }
  }
];

export function useDeck(initialFormat: DeckFormat = FORMATS[0]) {
  const [deckEntries, setDeckEntries] = useState<DeckEntry[]>([]);
  const [format, setFormat] = useState<DeckFormat>(initialFormat);
  const [commander, setCommander] = useState<Card | null>(null);
  const [deckName, setDeckName] = useState("My Deck");
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  const getMaxCopies = useCallback((card: Card): number => {
    if (format.specialRules) {
      return format.specialRules(card);
    }
    return format.maxCopies;
  }, [format]);

  const getCardQuantity = useCallback((cardId: string): number => {
    const entry = deckEntries.find(e => e.card.id === cardId);
    return entry?.quantity || 0;
  }, [deckEntries]);

  const addCard = useCallback((card: Card): boolean => {
    const currentQuantity = getCardQuantity(card.id);
    const maxAllowed = getMaxCopies(card);
    
    // Check color identity constraints for Commander format
    if (format.name === 'Commander' && commander) {
      const commanderColors = commander.color_identity || [];
      const cardColors = card.color_identity || [];
      
      if (!cardColors.every(color => commanderColors.includes(color))) {
        return false; // Card color identity doesn't match commander
      }
    }
    
    if (currentQuantity >= maxAllowed) {
      return false; // Can't add more
    }

    setDeckEntries(prev => {
      const existingIndex = prev.findIndex(e => e.card.id === card.id);
      
      if (existingIndex >= 0) {
        // Update existing entry
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + 1
        };
        return updated;
      } else {
        // Add new entry
        return [...prev, { card, quantity: 1 }];
      }
    });
    
    return true;
  }, [getCardQuantity, getMaxCopies, format, commander]);

  const removeCard = useCallback((cardId: string): boolean => {
    const currentQuantity = getCardQuantity(cardId);
    
    if (currentQuantity <= 0) {
      return false; // Nothing to remove
    }

    setDeckEntries(prev => {
      const existingIndex = prev.findIndex(e => e.card.id === cardId);
      
      if (existingIndex >= 0) {
        const updated = [...prev];
        
        if (updated[existingIndex].quantity <= 1) {
          // Remove entry completely
          updated.splice(existingIndex, 1);
        } else {
          // Decrease quantity
          updated[existingIndex] = {
            ...updated[existingIndex],
            quantity: updated[existingIndex].quantity - 1
          };
        }
        
        return updated;
      }
      
      return prev;
    });
    
    return true;
  }, [getCardQuantity]);

  const clearDeck = useCallback(() => {
    setDeckEntries([]);
  }, []);

  const canAddCard = useCallback((card: Card): boolean => {
    const currentQuantity = getCardQuantity(card.id);
    const maxAllowed = getMaxCopies(card);
    
    // Check color identity constraints for Commander format
    if (format.name === 'Commander' && commander) {
      const commanderColors = commander.color_identity || [];
      const cardColors = card.color_identity || [];
      
      if (!cardColors.every(color => commanderColors.includes(color))) {
        return false;
      }
    }
    
    return currentQuantity < maxAllowed;
  }, [getCardQuantity, getMaxCopies, format, commander]);

  const setCommanderFromCard = useCallback((card: Card) => {
    const typeLine = card.type_line?.toLowerCase() || '';
    const isLegendary = typeLine.includes('legendary');
    const isCreature = typeLine.includes('creature');
    const isPlaneswalker = typeLine.includes('planeswalker');
    
    // Check if card can be a commander (legendary creature or planeswalker)
    if (isLegendary && (isCreature || isPlaneswalker)) {
      // Add card to deck if not already present
      const currentQuantity = getCardQuantity(card.id);
      if (currentQuantity === 0) {
        addCard(card);
      }
      
      if (commander?.id === card.id) {
        setCommander(null); // Remove if already commander
      } else {
        setCommander(card); // Set as new commander
      }
      return true;
    }
    return false;
  }, [commander, getCardQuantity, addCard]);

  const totalCards = deckEntries.reduce((sum, entry) => sum + entry.quantity, 0);
  const uniqueCards = deckEntries.length;
  const allCards = deckEntries.flatMap(entry => 
    Array(entry.quantity).fill(entry.card)
  );

  return {
    deckEntries,
    format,
    setFormat,
    commander,
    setCommander,
    setCommanderFromCard,
    addCard,
    removeCard,
    clearDeck,
    getCardQuantity,
    getMaxCopies,
    canAddCard,
    totalCards,
    uniqueCards,
    allCards
  };
}