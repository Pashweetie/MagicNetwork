import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Lightbulb, GitMerge, Copy, AlertCircle, Plus, ThumbsUp, ThumbsDown } from "lucide-react";
import { ThemeSuggestions } from "./theme-suggestions";
import { CardTile } from "./card-tile";
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
function ThemeRecommendations({ cardId, onCardClick, onAddCard, currentFilters }: { cardId: string; onCardClick: (card: Card) => void; onAddCard?: (card: Card) => void; currentFilters?: any }) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
        <Lightbulb className="w-5 h-5 mr-2 text-purple-400" />
        Themes
      </h3>
      <ThemeSuggestions card={{ id: cardId } as Card} onCardClick={onCardClick} onAddCard={onAddCard} currentFilters={currentFilters} />
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
      return response.json();
    },
    enabled: !!cardId,
  });

  const handleRecommendationFeedback = async (recommendedCardId: string, feedback: 'helpful' | 'not_helpful', type: string) => {
    try {
      await fetch(`/api/cards/${cardId}/recommendation-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recommendedCardId,
          feedback,
          type,
          reason: feedback === 'not_helpful' ? 'Card does not synergize well' : 'Good synergy recommendation'
        })
      });
    } catch (error) {
      console.error('Failed to submit feedback:', error);
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
        <div className="text-center py-8 text-slate-400">
          <div className="animate-spin w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full mx-auto mb-2"></div>
          Finding synergistic cards...
        </div>
      ) : error ? (
        <div className="text-center py-8 text-red-400">
          <AlertCircle className="w-8 h-8 mx-auto mb-2" />
          Failed to load synergy cards
        </div>
      ) : availableCards.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {availableCards.map((rec: any, index: number) => (
            <div key={`synergy-${rec.card.id}-${index}`} className="relative group">
              <CardTile card={rec.card} onClick={onCardClick} />
              
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
        <div className="text-center py-8 text-slate-400">
          <GitMerge className="w-8 h-8 mx-auto mb-2 opacity-50" />
          No synergy cards found
        </div>
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
      return response.json();
    },
    enabled: !!cardId,
  });

  const handleRecommendationFeedback = async (recommendedCardId: string, feedback: 'helpful' | 'not_helpful', type: string) => {
    try {
      await fetch(`/api/cards/${cardId}/recommendation-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recommendedCardId,
          feedback,
          type,
          reason: feedback === 'not_helpful' ? 'Card is not functionally similar' : 'Good functional replacement'
        })
      });
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
        <div className="text-center py-8 text-slate-400">
          <div className="animate-spin w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full mx-auto mb-2"></div>
          Finding similar cards...
        </div>
      ) : error ? (
        <div className="text-center py-8 text-red-400">
          <AlertCircle className="w-8 h-8 mx-auto mb-2" />
          Failed to load similar cards
        </div>
      ) : availableCards.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {availableCards.map((rec: any, index: number) => (
            <div key={`similar-${rec.card.id}-${index}`} className="relative group">
              <CardTile card={rec.card} onClick={onCardClick} />
              
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
        <div className="text-center py-8 text-slate-400">
          <Copy className="w-8 h-8 mx-auto mb-2 opacity-50" />
          No similar cards found
        </div>
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
            {cardImage ? (
              <img
                src={cardImage}
                alt={card.name}
                className={modalStyles.image}
              />
            ) : (
              <div className={modalStyles.imagePlaceholder}>
                <span className={modalStyles.imagePlaceholderText}>No image available</span>
              </div>
            )}
          </div>

          {/* Card Details */}
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-400">Type:</span>
                <span className="text-white">{card.type_line}</span>
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
                <span className="text-white">{card.set_name} ({card.set.toUpperCase()})</span>
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

        {/* Three Recommendation Categories in Tabs */}
        <div className="mt-6">
          <Tabs defaultValue="themes" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-slate-800 border-slate-700">
              <TabsTrigger value="themes" className="data-[state=active]:bg-slate-700 flex items-center space-x-2">
                <Lightbulb className="w-4 h-4" />
                <span>Themes</span>
              </TabsTrigger>
              <TabsTrigger value="synergy" className="data-[state=active]:bg-slate-700 flex items-center space-x-2">
                <GitMerge className="w-4 h-4" />
                <span>Synergy</span>
              </TabsTrigger>
              <TabsTrigger value="similar" className="data-[state=active]:bg-slate-700 flex items-center space-x-2">
                <Copy className="w-4 h-4" />
                <span>Similar</span>
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="themes" className="mt-6">
              <ThemeRecommendations cardId={card.id} onCardClick={onCardClick || (() => onClose())} onAddCard={onAddCard} currentFilters={currentFilters} />
            </TabsContent>
            
            <TabsContent value="synergy" className="mt-6">
              <SynergyRecommendations 
                cardId={card.id} 
                onCardClick={onCardClick || (() => onClose())}
                onAddCard={onAddCard}
                currentFilters={currentFilters}
              />
            </TabsContent>
            
            <TabsContent value="similar" className="mt-6">
              <SimilarRecommendations 
                cardId={card.id} 
                onCardClick={onCardClick || (() => onClose())}
                onAddCard={onAddCard}
                currentFilters={currentFilters}
              />
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}