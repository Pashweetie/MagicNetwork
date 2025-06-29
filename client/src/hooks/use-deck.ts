import { useState, useCallback, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@shared/schema";
import { api } from "@/lib/api-client";

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
      // Basic lands and snow lands can have any number
      const typeLine = card.type_line?.toLowerCase() || '';
      if (typeLine.includes("basic") && typeLine.includes("land")) return 999;
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
      const typeLine = card.type_line?.toLowerCase() || '';
      if (typeLine.includes("basic") && typeLine.includes("land")) return 999;
      return 4;
    }
  },
  {
    name: "Modern",
    maxCopies: 4,
    isSingleton: false,
    allowMultipleBasics: true,
    specialRules: (card: Card) => {
      const typeLine = card.type_line?.toLowerCase() || '';
      if (typeLine.includes("basic") && typeLine.includes("land")) return 999;
      return 4;
    }
  },
  {
    name: "Legacy",
    maxCopies: 4,
    isSingleton: false,
    allowMultipleBasics: true,
    specialRules: (card: Card) => {
      const typeLine = card.type_line?.toLowerCase() || '';
      if (typeLine.includes("basic") && typeLine.includes("land")) return 999;
      return 4;
    }
  }
];

export function useDeck(initialFormat: DeckFormat = FORMATS[0]) {
  const [deckEntries, setDeckEntries] = useState<DeckEntry[]>([]);
  const [format, setFormat] = useState<DeckFormat>(initialFormat);
  const [commander, setCommander] = useState<Card | null>(null);
  const queryClient = useQueryClient();

  // Fetch deck data from backend
  const { data: deckData, isLoading: isDeckLoading } = useQuery({
    queryKey: ['/api/user/deck'],
    queryFn: () => api.get('/api/user/deck')
  });

  // Save deck mutation
  const saveDeckMutation = useMutation({
    mutationFn: (deckData: any) => api.put('/api/user/deck', deckData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/deck'] });
    },
  });

  // Update local state when deck data changes
  useEffect(() => {
    if (deckData) {
      setDeckEntries(deckData.entries || []);
      setCommander(deckData.commander || null);
      
      const deckFormat = FORMATS.find(f => f.name === deckData.deck?.format) || FORMATS[0];
      setFormat(deckFormat);
    }
  }, [deckData]);

  // Save deck changes to backend
  const saveDeckChanges = useCallback((newEntries: DeckEntry[], newCommander: Card | null, newFormat: DeckFormat) => {
    const cardsData = newEntries.map(entry => ({
      cardId: entry.card.id,
      quantity: entry.quantity
    }));

    saveDeckMutation.mutate({
      name: "My Deck",
      format: newFormat.name,
      commanderId: newCommander?.id || null,
      cards: cardsData
    });
  }, [saveDeckMutation]);

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

    const newEntries = deckEntries.slice();
    const existingIndex = newEntries.findIndex(e => e.card.id === card.id);
    
    if (existingIndex >= 0) {
      // Update existing entry
      newEntries[existingIndex] = {
        ...newEntries[existingIndex],
        quantity: newEntries[existingIndex].quantity + 1
      };
    } else {
      // Add new entry
      newEntries.push({ card, quantity: 1 });
    }
    
    setDeckEntries(newEntries);
    saveDeckChanges(newEntries, commander, format);
    
    return true;
  }, [getCardQuantity, getMaxCopies, format, commander, saveDeckChanges]);

  const removeCard = useCallback((cardId: string): boolean => {
    const currentQuantity = getCardQuantity(cardId);
    
    if (currentQuantity <= 0) {
      return false; // Nothing to remove
    }

    const newEntries = deckEntries.slice();
    const existingIndex = newEntries.findIndex(e => e.card.id === cardId);
    
    if (existingIndex >= 0) {
      if (newEntries[existingIndex].quantity <= 1) {
        // Remove entry completely
        newEntries.splice(existingIndex, 1);
      } else {
        // Decrease quantity
        newEntries[existingIndex] = {
          ...newEntries[existingIndex],
          quantity: newEntries[existingIndex].quantity - 1
        };
      }
      
      setDeckEntries(newEntries);
      saveDeckChanges(newEntries, commander, format);
    }
    
    return true;
  }, [getCardQuantity, commander, format, saveDeckChanges]);

  const clearDeck = useCallback(() => {
    const newEntries: DeckEntry[] = [];
    const newCommander = null;
    setDeckEntries(newEntries);
    setCommander(newCommander);
    saveDeckChanges(newEntries, newCommander, format);
  }, [format, saveDeckChanges]);

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

  const setFormatAndSave = useCallback((newFormat: DeckFormat) => {
    setFormat(newFormat);
    saveDeckChanges(deckEntries, commander, newFormat);
  }, [deckEntries, commander, saveDeckChanges]);

  const setCommanderAndSave = useCallback((newCommander: Card | null) => {
    setCommander(newCommander);
    saveDeckChanges(deckEntries, newCommander, format);
  }, [deckEntries, format, saveDeckChanges]);

  const addCardByName = useCallback(async (cardName: string): Promise<boolean> => {
    try {
      // Search for the card by name
      const searchResult = await api.get(`/api/cards/search?q=${encodeURIComponent(cardName)}&page=1`);
      const exactMatch = searchResult.data.find((card: Card) => 
        card.name.toLowerCase() === cardName.toLowerCase()
      );
      
      if (exactMatch && canAddCard(exactMatch)) {
        addCard(exactMatch);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error adding card by name:', error);
      return false;
    }
  }, [canAddCard, addCard]);

  const setCommanderFromCard = useCallback((card: Card) => {
    const typeLine = card.type_line?.toLowerCase() || '';
    const isLegendary = typeLine.includes('legendary');
    const isCreature = typeLine.includes('creature');
    const isPlaneswalker = typeLine.includes('planeswalker');
    
    // Check if card can be a commander (legendary creature or planeswalker)
    if (isLegendary && (isCreature || isPlaneswalker)) {
      let newEntries = deckEntries;
      
      // Add card to deck if not already present
      const currentQuantity = getCardQuantity(card.id);
      if (currentQuantity === 0) {
        newEntries = [...deckEntries, { card, quantity: 1 }];
        setDeckEntries(newEntries);
      }
      
      const newCommander = commander?.id === card.id ? null : card;
      setCommander(newCommander);
      saveDeckChanges(newEntries, newCommander, format);
      
      return true;
    }
    return false;
  }, [commander, getCardQuantity, deckEntries, format, saveDeckChanges]);

  const totalCards = deckEntries.reduce((sum, entry) => sum + entry.quantity, 0);
  const uniqueCards = deckEntries.length;
  const allCards = deckEntries.flatMap(entry => 
    Array(entry.quantity).fill(entry.card)
  );

  const isFormatValid = useCallback(() => {
    if (format.name === 'Commander') {
      return totalCards <= 100 && (commander ? true : false);
    }
    if (format.name === 'Standard' || format.name === 'Modern') {
      return totalCards >= 60;
    }
    return true;
  }, [totalCards, format.name, commander]);

  const averageCMC = useMemo(() => {
    if (allCards.length === 0) return 0;
    const totalCMC = allCards.reduce((sum, card) => sum + (card.cmc || 0), 0);
    return totalCMC / allCards.length;
  }, [allCards]);

  const exportToText = useCallback(() => {
    let text = `# ${format.name} Deck\n\n`;
    
    if (commander) {
      text += `Commander:\n1 ${commander.name}\n\n`;
    }
    
    text += `Main Deck:\n`;
    deckEntries.forEach(({ card, quantity }) => {
      if (card.id !== commander?.id) {
        text += `${quantity} ${card.name}\n`;
      }
    });
    
    return text;
  }, [deckEntries, commander, format.name]);

  const name = useMemo(() => {
    if (commander) return `${commander.name} ${format.name}`;
    return `${format.name} Deck`;
  }, [commander, format.name]);

  return {
    deckEntries,
    format,
    setFormat: setFormatAndSave,
    commander,
    setCommander: setCommanderAndSave,
    setCommanderFromCard,
    addCard,
    removeCard,
    clearDeck,
    getCardQuantity,
    getMaxCopies,
    canAddCard,
    totalCards,
    uniqueCards,
    allCards,
    isFormatValid,
    averageCMC,
    exportToText,
    name,
    addCardByName,
    isDeckLoading
  };
}