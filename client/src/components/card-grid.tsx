import { useEffect, useRef, useState } from "react";
import { Card } from "@shared/schema";
import { SharedCardTile } from "./shared-card-tile";
import { CardDetailModal } from "./card-detail-modal";
import { EmptyState } from "./shared/EmptyState";
import { LoadingSpinner } from "./shared/LoadingSpinner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface CardGridProps {
  cards: Card[];
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onRetry?: () => void;
  error?: string | null;
  viewMode?: string;
  deck?: any;
  onCardClick?: (card: Card) => void;
}

export function CardGrid({ cards, isLoading, hasMore, onLoadMore, onRetry, error, viewMode = "grid", deck, onCardClick }: CardGridProps) {
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const observerRef = useRef<HTMLDivElement>(null);

  const handleCardClick = (card: Card) => {
    if (onCardClick) {
      onCardClick(card);
    } else {
      setSelectedCard(card);
      setIsModalOpen(true);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedCard(null);
  };

  // Intersection Observer for infinite scroll
  useEffect(() => {
    console.log('📺 CardGrid intersection observer setup:', { 
      hasObserverRef: !!observerRef.current, 
      hasMore, 
      isLoading,
      cardsCount: cards.length 
    });
    
    if (!observerRef.current || !hasMore || cards.length === 0) {
      console.log('❌ CardGrid observer not created:', { 
        noRef: !observerRef.current, 
        noMore: !hasMore,
        noCards: cards.length === 0
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        console.log('👁️ CardGrid intersection triggered:', { 
          isIntersecting: entries[0].isIntersecting, 
          hasMore, 
          isLoading 
        });
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          console.log('🚀 CardGrid calling onLoadMore...');
          // Add small delay to prevent rapid firing during initial render
          setTimeout(() => {
            if (hasMore && !isLoading) {
              onLoadMore();
            }
          }, 500);
        }
      },
      {
        rootMargin: '100px',
        threshold: 0.1,
      }
    );

    observer.observe(observerRef.current);

    return () => observer.disconnect();
  }, [hasMore, isLoading, onLoadMore, cards.length]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="text-red-400 mb-4">
          <span className="text-lg">⚠️ Search Error</span>
        </div>
        <p className="text-slate-400 mb-4 max-w-md">
          {error}
        </p>
        {onRetry && (
          <Button
            onClick={onRetry}
            variant="outline"
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        )}
      </div>
    );
  }

  if (cards.length === 0 && !isLoading) {
    return (
      <EmptyState 
        icon="🔍"
        title="No cards found"
        description="Try adjusting your search query or filters to find more cards."
        className="py-12"
      />
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
        {cards.filter(card => card && card.type_line && card.name).map((card, index) => (
          <SharedCardTile
            key={`${card.id}-${index}`}
            variant={deck ? "deck" : "search"}
            card={card}
            quantity={deck?.getCardQuantity(card.id)}
            maxCopies={deck?.getMaxCopies(card)}
            onAdd={deck ? () => deck.addCard(card) : undefined}
            onRemove={deck ? () => deck.removeCard(card.id) : undefined}
            onClick={handleCardClick}
            onSetCommander={deck?.format?.name === 'Commander' ? deck.setCommanderFromCard : undefined}
            isCommander={deck?.commander?.id === card.id}
          />
        ))}
        
        {/* Loading skeletons */}
        {isLoading && (
          <>
            {Array.from({ length: 12 }).map((_, index) => (
              <div key={`skeleton-${index}`} className="bg-slate-800 rounded-lg overflow-hidden">
                <Skeleton className="aspect-[3/4] bg-slate-600" />
                <div className="p-3 space-y-2">
                  <Skeleton className="h-4 bg-slate-600" />
                  <Skeleton className="h-3 bg-slate-700 w-2/3" />
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-3 bg-slate-700 w-12" />
                    <Skeleton className="h-3 w-3 rounded-full bg-slate-700" />
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Loading indicator for infinite scroll */}
      {hasMore && (
        <div
          ref={observerRef}
          className="flex justify-center py-8 min-h-[60px]"
        >
          {isLoading ? (
            <LoadingSpinner size="md" color="slate" message="Loading more cards..." />
          ) : (
            <div className="text-slate-500 text-sm opacity-50">↓ Scroll for more cards ↓</div>
          )}
        </div>
      )}

      {/* End of results indicator */}
      {!hasMore && cards.length > 0 && (
        <div className="text-center py-8 text-slate-500">
          <p>You've reached the end of the results</p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 text-blue-400 hover:text-blue-300"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            Back to top
          </Button>
        </div>
      )}

      {/* Card Detail Modal */}
      <CardDetailModal
        card={selectedCard}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </>
  );
}
