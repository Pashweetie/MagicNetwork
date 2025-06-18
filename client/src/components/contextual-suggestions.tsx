import { useQuery } from "@tanstack/react-query";
import { Card } from "@shared/schema";
import { useState } from "react";
import { CardDetailModal } from "./card-detail-modal";

interface ContextualSuggestionsProps {
  limit?: number;
}

export function ContextualSuggestions({ limit = 20 }: ContextualSuggestionsProps) {
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: suggestions = [], isLoading } = useQuery<Card[]>({
    queryKey: ['/api/suggestions/contextual', limit],
    enabled: true,
  });

  const handleCardClick = (card: Card) => {
    setSelectedCard(card);
    setIsModalOpen(true);
    
    // Track interaction for learning
    fetch('/api/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cardId: card.id,
        interactionType: 'contextual_click',
        metadata: { source: 'contextual_suggestions' }
      })
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Suggested for You</h3>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[5/7] bg-slate-700 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!suggestions || (suggestions as Card[]).length === 0) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Suggested for You</h3>
        <div className="text-slate-400 text-center py-8">
          No personalized suggestions yet. Browse and interact with cards to get personalized recommendations.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Suggested for You</h3>
      <p className="text-sm text-slate-400">
        Based on your card viewing patterns and preferences
      </p>
      
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {(suggestions as Card[]).map((card: Card, index: number) => (
          <div 
            key={`contextual-${card.id}-${index}`}
            className="relative group cursor-pointer hover:scale-105 transition-transform"
            onClick={() => handleCardClick(card)}
          >
            <div className="aspect-[5/7] bg-slate-700 rounded overflow-hidden">
              {card.image_uris?.normal ? (
                <img
                  src={card.image_uris.normal}
                  alt={card.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-600 text-slate-300 text-xs text-center p-2">
                  {card.name}
                </div>
              )}
            </div>
            
            {/* Hover overlay with card info */}
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-75 transition-opacity rounded flex items-end p-2 opacity-0 group-hover:opacity-100">
              <div className="text-white text-xs">
                <div className="font-bold">{card.name}</div>
                <div className="text-slate-300">{card.mana_cost}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <CardDetailModal
        card={selectedCard}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCardClick={handleCardClick}
      />
    </div>
  );
}