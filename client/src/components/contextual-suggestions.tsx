import { useQuery } from "@tanstack/react-query";
import { Card } from "@shared/schema";
import { useState } from "react";
import { CardDetailModal } from "./card-detail-modal";
import { cardStyles } from "../styles/card.styles";

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
      <div className={cardStyles.suggestions.container}>
        <h3 className={cardStyles.suggestions.title}>Suggested for You</h3>
        <div className={cardStyles.suggestions.grid}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[5/7] bg-slate-700 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!suggestions || (suggestions as Card[]).length === 0) {
    return (
      <div className={cardStyles.suggestions.container}>
        <h3 className={cardStyles.suggestions.title}>Suggested for You</h3>
        <div className={cardStyles.suggestions.emptyState}>
          No personalized suggestions yet. Browse and interact with cards to get personalized recommendations.
        </div>
      </div>
    );
  }

  return (
    <div className={cardStyles.suggestions.container}>
      <h3 className={cardStyles.suggestions.title}>Suggested for You</h3>
      <p className={cardStyles.suggestions.subtitle}>
        Based on your card viewing patterns and preferences
      </p>
      
      <div className={cardStyles.suggestions.grid}>
        {(suggestions as Card[]).map((card: Card, index: number) => (
          <div 
            key={`contextual-${card.id}-${index}`}
            className={cardStyles.tile.container}
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
                <div className={cardStyles.tile.placeholder}>
                  <span className={cardStyles.tile.placeholderText}>{card.name}</span>
                </div>
              )}
            </div>
            
            <div className={cardStyles.tile.overlay}>
              <div className={cardStyles.tile.overlayContent}>
                <div className={cardStyles.tile.overlayTitle}>{card.name}</div>
                <div className={cardStyles.tile.overlayMeta}>{card.mana_cost}</div>
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