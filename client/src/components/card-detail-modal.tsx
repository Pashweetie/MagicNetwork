import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Lightbulb, GitMerge, Copy, AlertCircle, Plus, ThumbsUp, ThumbsDown } from "lucide-react";
import { ThemeSuggestions } from "./theme-suggestions";
import { ThemeBasedSynergies } from "./theme-based-synergies";
import { SharedCardTile } from "./shared-card-tile";
import { LoadingSpinner } from "./shared/LoadingSpinner";
import { EmptyState } from "./shared/EmptyState";
import { CardImage } from "./shared/CardImage";
import { DualFacedCardModal } from "@/components/dual-faced-card";
import { Card } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { useDeck } from "@/hooks/use-deck";

interface CardDetailModalProps {
  card: Card | null;
  isOpen: boolean;
  onClose: () => void;
  onCardClick?: (card: Card) => void;
  onAddCard?: (card: Card) => void;
  currentFilters?: any;
}

// Theme Recommendations Component
function ThemeRecommendations({ card, onCardClick, onAddCard, currentFilters }: { card: Card; onCardClick: (card: Card) => void; onAddCard?: (card: Card) => void; currentFilters?: any }) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
        <Lightbulb className="w-5 h-5 mr-2 text-purple-400" />
        Themes
      </h3>
      <ThemeSuggestions card={card} onCardClick={onCardClick} onAddCard={onAddCard} currentFilters={currentFilters} />
    </div>
  );
}

// Synergy Recommendations Component
function SynergyRecommendations({ cardId, onCardClick, onAddCard, currentFilters }: { cardId: string; onCardClick: (card: Card) => void; onAddCard?: (card: Card) => void; currentFilters?: any }) {
  const { data: recommendations, isLoading, error } = useQuery({
    queryKey: ['/api/cards', cardId, 'recommendations', 'synergy', currentFilters],
    queryFn: async () => {
      const filterParams = currentFilters ? `&filters=${encodeURIComponent(JSON.stringify(currentFilters))}` : '';
      const response = await fetch(`/api/cards/${cardId}/recommendations?type=synergy&limit=15${filterParams}`);
      if (!response.ok) throw new Error('Failed to fetch synergy recommendations');
      const data = await response.json();
      return data;
    },
    enabled: !!cardId,
  });

  const handleRecommendationFeedback = async (recommendedCardId: string, feedback: 'helpful' | 'not_helpful', type: string) => {
    try {
      const response = await fetch(`/api/cards/${cardId}/recommendation-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recommendedCardId,
          helpful: feedback === 'helpful',
          recommendationType: type,
          userId: 1
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Feedback recorded:', result.message);
        
        // Show visual feedback to user
        const button = document.activeElement as HTMLElement;
        if (button) {
          const originalClasses = button.className;
          const checkmark = feedback === 'helpful' ? '✓' : '✗';
          const bgColor = feedback === 'helpful' ? 'bg-green-500' : 'bg-red-500';
          
          // Add success styling
          button.innerHTML = `<span class="text-white">${checkmark}</span>`;
          button.className = `${originalClasses} ${bgColor} scale-110 transition-all duration-300`;
          
          // Show toast-like message
          const toast = document.createElement('div');
          toast.className = 'fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-in slide-in-from-right';
          toast.textContent = result.message;
          document.body.appendChild(toast);
          
          // Reset after delay
          setTimeout(() => {
            button.className = originalClasses;
            button.innerHTML = feedback === 'helpful' ? '<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z"></path></svg>' : '<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M18 9.5a1.5 1.5 0 11-3 0v-6a1.5 1.5 0 013 0v6zM14 9.667v-5.43a2 2 0 00-1.106-1.79l-.05-.025A4 4 0 0011.057 2H5.64a2 2 0 00-1.962 1.608l-1.2 6A2 2 0 004.44 12H8v4a2 2 0 002 2 1 1 0 001-1v-.667a4 4 0 01.8-2.4l1.4-1.866a4 4 0 00.8-2.4z"></path></svg>';
            if (toast.parentNode) {
              toast.remove();
            }
          }, 2000);
        }
      }
    } catch (error) {
      console.error('Failed to submit synergy feedback:', error);
    }
  };

  // Filter recommendations - no deck filtering here, just show all results
  const availableCards = recommendations || [];

  return (
    <div>
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
        <GitMerge className="w-5 h-5 mr-2 text-yellow-400" />
        Synergy Cards
        <span className="text-sm text-slate-400 ml-2">({availableCards.length} available)</span>
      </h3>
      {isLoading ? (
        <LoadingSpinner 
          size="lg" 
          color="yellow" 
          message="Finding synergistic cards..." 
          className="py-8 text-slate-400" 
        />
      ) : error ? (
        <div className="text-center py-8 text-red-400">
          <AlertCircle className="w-8 h-8 mx-auto mb-2" />
          Failed to load synergy cards
        </div>
      ) : availableCards.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {availableCards.map((rec: any, index: number) => (
            <div key={`synergy-${rec.card.id}-${index}`} className="relative group">
              <SharedCardTile variant="search" card={rec.card} onClick={onCardClick} />
              
              {/* Add to deck button */}
              {onAddCard && (
                <div className="absolute top-1 left-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddCard(rec.card);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white p-1.5 rounded-md shadow-lg transition-colors"
                    title="Add to deck"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Score and Feedback - Bottom overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-2">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-yellow-400 text-xs font-medium">
                      {rec.score ? `${(rec.score * 100).toFixed(0)}%` : 'N/A'}
                    </span>
                    <span className="text-slate-300 text-xs truncate">{rec.reason}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRecommendationFeedback(rec.card.id, 'helpful', 'synergy');
                      }}
                      className="text-green-400 hover:text-green-300 p-1 hover:bg-green-400/20 rounded"
                      title="This recommendation is helpful"
                    >
                      <ThumbsUp className="w-3 h-3" />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRecommendationFeedback(rec.card.id, 'not_helpful', 'synergy');
                      }}
                      className="text-red-400 hover:text-red-300 p-1 hover:bg-red-400/20 rounded"
                      title="This recommendation is not helpful"
                    >
                      <ThumbsDown className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState 
          icon={GitMerge}
          title="No synergy cards found"
        />
      )}
    </div>
  );
}

// Similar Recommendations Component
function SimilarRecommendations({ cardId, onCardClick, onAddCard, currentFilters }: { cardId: string; onCardClick: (card: Card) => void; onAddCard?: (card: Card) => void; currentFilters?: any }) {
  const { data: recommendations, isLoading, error } = useQuery({
    queryKey: ['/api/cards', cardId, 'recommendations', 'functional_similarity', currentFilters],
    queryFn: async () => {
      const filterParams = currentFilters ? `&filters=${encodeURIComponent(JSON.stringify(currentFilters))}` : '';
      const response = await fetch(`/api/cards/${cardId}/recommendations?type=functional_similarity&limit=15${filterParams}`);
      if (!response.ok) throw new Error('Failed to fetch similar recommendations');
      const data = await response.json();
      return data;
    },
    enabled: !!cardId,
  });

  const handleRecommendationFeedback = async (recommendedCardId: string, feedback: 'helpful' | 'not_helpful', type: string) => {
    try {
      const response = await fetch(`/api/cards/${cardId}/recommendation-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recommendedCardId,
          helpful: feedback === 'helpful',
          recommendationType: type,
          userId: 1
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Feedback recorded:', result.message);
        
        // Show visual feedback
        const button = document.activeElement as HTMLElement;
        if (button) {
          const originalClasses = button.className;
          const checkmark = feedback === 'helpful' ? '✓' : '✗';
          const bgColor = feedback === 'helpful' ? 'bg-green-500' : 'bg-red-500';
          
          button.innerHTML = `<span class="text-white">${checkmark}</span>`;
          button.className = `${originalClasses} ${bgColor} scale-110 transition-all duration-300`;
          
          const toast = document.createElement('div');
          toast.className = 'fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50';
          toast.textContent = result.message;
          document.body.appendChild(toast);
          
          setTimeout(() => {
            button.className = originalClasses;
            button.innerHTML = feedback === 'helpful' ? '<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z"></path></svg>' : '<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M18 9.5a1.5 1.5 0 11-3 0v-6a1.5 1.5 0 013 0v6zM14 9.667v-5.43a2 2 0 00-1.106-1.79l-.05-.025A4 4 0 0011.057 2H5.64a2 2 0 00-1.962 1.608l-1.2 6A2 2 0 004.44 12H8v4a2 2 0 002 2 1 1 0 001-1v-.667a4 4 0 01.8-2.4l1.4-1.866a4 4 0 00.8-2.4z"></path></svg>';
            toast.remove();
          }, 2000);
        }
      }
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    }
  };

  // Filter recommendations - no deck filtering here, just show all results
  const availableCards = recommendations || [];

  return (
    <div>
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
        <Copy className="w-5 h-5 mr-2 text-blue-400" />
        Similar Cards
        <span className="text-sm text-slate-400 ml-2">({availableCards.length} available)</span>
      </h3>
      {isLoading ? (
        <LoadingSpinner 
          size="lg" 
          color="blue" 
          message="Finding similar cards..." 
          className="py-8 text-slate-400" 
        />
      ) : error ? (
        <div className="text-center py-8 text-red-400">
          <AlertCircle className="w-8 h-8 mx-auto mb-2" />
          Failed to load similar cards
        </div>
      ) : availableCards.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {availableCards.map((rec: any, index: number) => (
            <div key={`similar-${rec.card.id}-${index}`} className="relative group">
              <SharedCardTile variant="search" card={rec.card} onClick={onCardClick} />
              
              {/* Add to Deck Button */}
              {onAddCard && (
                <div className="absolute top-2 right-2">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddCard(rec.card);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white p-1.5 rounded-md shadow-lg transition-colors"
                    title="Add to deck"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Score and Feedback - Bottom overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-2">
                <div className="flex items-center justify-between">
                  <span className="text-white text-xs font-medium">
                    {rec.score ? `${(rec.score * 100).toFixed(0)}%` : 'N/A'}
                  </span>
                  <div className="flex items-center space-x-1">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRecommendationFeedback(rec.card.id, 'helpful', 'functional_similarity');
                      }}
                      className="text-green-400 hover:text-green-300 p-1 hover:bg-green-400/20 rounded"
                      title="This recommendation is helpful"
                    >
                      <ThumbsUp className="w-3 h-3" />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRecommendationFeedback(rec.card.id, 'not_helpful', 'functional_similarity');
                      }}
                      className="text-red-400 hover:text-red-300 p-1 hover:bg-red-400/20 rounded"
                      title="This recommendation is not helpful"
                    >
                      <ThumbsDown className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState 
          icon={Copy}
          title="No similar cards found"
        />
      )}
    </div>
  );
}

export function CardDetailModal({ card, isOpen, onClose, onCardClick, onAddCard, currentFilters }: CardDetailModalProps) {
  if (!card) return null;

  const getCardImage = () => {
    if (card.image_uris?.large) {
      return card.image_uris.large;
    } else if (card.card_faces?.[0]?.image_uris?.large) {
      return card.card_faces[0].image_uris.large;
    } else if (card.image_uris?.normal) {
      return card.image_uris.normal;
    } else if (card.card_faces?.[0]?.image_uris?.normal) {
      return card.card_faces[0].image_uris.normal;
    }
    return null;
  };

  const cardImage = getCardImage();
  const colors = card.colors || card.color_identity || [];
  const price = card.prices?.usd ? `$${card.prices.usd}` : 'N/A';

  const modalStyles = {
    container: "max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700",
    title: "text-white text-xl",
    grid: "grid grid-cols-1 lg:grid-cols-2 gap-6",
    imageContainer: "flex justify-center",
    image: "rounded-lg shadow-lg max-w-full h-auto",
    imagePlaceholder: "bg-slate-600 rounded-lg w-full aspect-[3/4] flex items-center justify-center",
    imagePlaceholderText: "text-slate-400"
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={modalStyles.container}>
        <DialogHeader>
          <DialogTitle className={modalStyles.title}>{card.name}</DialogTitle>
        </DialogHeader>
        
        <div className={modalStyles.grid}>
          {/* Card Image */}
          <div className={modalStyles.imageContainer}>
            <CardImage
              src={cardImage}
              alt={card.name}
              className={modalStyles.image}
              priority={true}
            />
          </div>

          {/* Card Details */}
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-400">Type:</span>
                <span className="text-white">{card.type_line || 'Unknown Type'}</span>
              </div>
              {card.mana_cost && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Mana Cost:</span>
                  <span className="text-white font-mono">{card.mana_cost}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400">CMC:</span>
                <span className="text-white">{card.cmc}</span>
              </div>
              {card.power !== undefined && card.toughness !== undefined && (
                <div className="flex justify-between">
                  <span className="text-slate-400">P/T:</span>
                  <span className="text-white">{card.power}/{card.toughness}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400">Rarity:</span>
                <Badge variant="outline" className="capitalize">
                  {card.rarity}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Set:</span>
                <span className="text-white">{card.set_name} ({card.set?.toUpperCase() || 'UNKNOWN'})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Colors:</span>
                <div className="flex space-x-1">
                  {colors.length > 0 ? (
                    colors.map((color, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {color}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-slate-500">Colorless</span>
                  )}
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Price:</span>
                <span className="text-white font-semibold">{price}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Oracle Text */}
        {card.oracle_text && (
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">Oracle Text</h3>
            <div className="bg-slate-800 rounded-lg p-3 text-sm text-slate-200 whitespace-pre-wrap">
              {card.oracle_text}
            </div>
          </div>
        )}

        {/* Format Legalities */}
        {card.legalities && (
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">Format Legality</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {Object.entries(card.legalities).map(([format, legality]) => (
                <div key={format} className="flex justify-between">
                  <span className="text-slate-400 capitalize">{format}:</span>
                  <Badge 
                    variant={legality === 'legal' ? 'default' : 'destructive'}
                    className="text-xs"
                  >
                    {legality}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Two Recommendation Categories in Tabs */}
        <div className="mt-6">
          <Tabs defaultValue="themes" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-slate-800 border-slate-700">
              <TabsTrigger value="themes" className="data-[state=active]:bg-slate-700 flex items-center space-x-2">
                <Lightbulb className="w-4 h-4" />
                <span>Themes</span>
              </TabsTrigger>
              <TabsTrigger value="synergy" className="data-[state=active]:bg-slate-700 flex items-center space-x-2">
                <GitMerge className="w-4 h-4" />
                <span>Synergy</span>
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="themes" className="mt-6">
              <ThemeRecommendations card={card} onCardClick={onCardClick || (() => onClose())} onAddCard={onAddCard} currentFilters={currentFilters} />
            </TabsContent>
            
            <TabsContent value="synergy" className="mt-6">
              <div className="space-y-4">
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-slate-200 mb-2">Theme-Based Synergies</h3>
                  <p className="text-sm text-slate-400 mb-4">
                    Cards that share the most strategic themes with this card
                  </p>
                </div>
                <ThemeBasedSynergies 
                  cardId={card.id} 
                  onCardClick={(clickedCard) => {
                    if (onCardClick) {
                      onCardClick(clickedCard);
                    }
                  }}
                  onAddCard={onAddCard}
                  currentFilters={currentFilters}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}