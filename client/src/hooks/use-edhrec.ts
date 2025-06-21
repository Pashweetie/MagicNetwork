import { useQuery } from '@tanstack/react-query';
import { Card } from '@shared/schema';

export interface EdhrecCard {
  name: string;
  url: string;
  num_decks: number;
  synergy: number;
  price: number;
  color_identity: string[];
  type_line: string;
  cmc: number;
  oracle_text?: string;
}

export interface EdhrecRecommendations {
  commander: string;
  total_decks: number;
  updated_at: string;
  cards: {
    creatures: EdhrecCard[];
    instants: EdhrecCard[];
    sorceries: EdhrecCard[];
    artifacts: EdhrecCard[];
    enchantments: EdhrecCard[];
    planeswalkers: EdhrecCard[];
    lands: EdhrecCard[];
  };
  themes: Array<{
    name: string;
    url: string;
    num_decks: number;
    cards: EdhrecCard[];
  }>;
}

export function useEdhrecRecommendations(commander: Card | null) {
  return useQuery({
    queryKey: ['edhrec-recommendations', commander?.id],
    queryFn: async (): Promise<EdhrecRecommendations> => {
      if (!commander) throw new Error('No commander selected');
      
      const response = await fetch(`/api/edhrec/commander/${commander.id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch EDHREC recommendations');
      }
      return response.json();
    },
    enabled: !!commander?.id
  });
}

export function useEdhrecCards(recommendations: EdhrecRecommendations | undefined, categoryFilter?: string) {
  if (!recommendations) return [];
  
  const allCards: EdhrecCard[] = [];
  
  if (!categoryFilter) {
    // Return all cards from all categories
    Object.values(recommendations.cards).forEach(categoryCards => {
      allCards.push(...categoryCards);
    });
  } else {
    // Return cards from specific category
    const category = recommendations.cards[categoryFilter as keyof typeof recommendations.cards];
    if (category) {
      allCards.push(...category);
    }
  }
  
  return allCards;
}