import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { X, Lightbulb, GitMerge, Copy, AlertCircle } from "lucide-react";
import { ThemeSuggestions } from "./theme-suggestions";
import { Card } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";

interface CardDetailModalProps {
  card: Card | null;
  isOpen: boolean;
  onClose: () => void;
}

// Theme Recommendations Component
function ThemeRecommendations({ cardId, onCardClick }: { cardId: string; onCardClick: () => void }) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
        <Lightbulb className="w-5 h-5 mr-2 text-purple-400" />
        Themes
      </h3>
      <ThemeSuggestions card={{ id: cardId } as Card} onCardClick={onCardClick} />
    </div>
  );
}

// Synergy Recommendations Component
function SynergyRecommendations({ cardId, onCardClick }: { cardId: string; onCardClick: () => void }) {
  const { data: recommendations, isLoading, error } = useQuery({
    queryKey: ['/api/cards', cardId, 'recommendations', 'synergy'],
    queryFn: async () => {
      const response = await fetch(`/api/cards/${cardId}/recommendations?type=synergy&limit=6`);
      if (!response.ok) throw new Error('Failed to fetch synergy recommendations');
      return response.json();
    },
    enabled: !!cardId,
  });

  return (
    <div>
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
        <GitMerge className="w-5 h-5 mr-2 text-yellow-400" />
        Synergy Cards
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
      ) : recommendations?.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {recommendations.map((rec: any) => (
            <div
              key={rec.card.id}
              className="bg-slate-800 rounded-lg p-3 border border-slate-700 hover:border-yellow-400/50 transition-colors cursor-pointer group"
              onClick={() => onCardClick()}
            >
              <div className="flex items-start space-x-3">
                <div className="w-12 h-16 bg-slate-700 rounded overflow-hidden flex-shrink-0">
                  {rec.card.image_uris?.small ? (
                    <img
                      src={rec.card.image_uris.small}
                      alt={rec.card.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                      {rec.card.name.substring(0, 2)}
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-white truncate group-hover:text-yellow-400 transition-colors">
                    {rec.card.name}
                  </h4>
                  <p className="text-xs text-slate-400 mb-1">
                    {rec.card.type_line}
                  </p>
                  <span className="text-xs text-yellow-400 font-medium">
                    {rec.score}% match
                  </span>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                    {rec.reason}
                  </p>
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
function SimilarRecommendations({ cardId, onCardClick }: { cardId: string; onCardClick: () => void }) {
  const { data: recommendations, isLoading, error } = useQuery({
    queryKey: ['/api/cards', cardId, 'recommendations', 'functional_similarity'],
    queryFn: async () => {
      const response = await fetch(`/api/cards/${cardId}/recommendations?type=functional_similarity&limit=6`);
      if (!response.ok) throw new Error('Failed to fetch similar recommendations');
      return response.json();
    },
    enabled: !!cardId,
  });

  return (
    <div>
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
        <Copy className="w-5 h-5 mr-2 text-blue-400" />
        Similar Cards
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
      ) : recommendations?.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {recommendations.map((rec: any) => (
            <div
              key={rec.card.id}
              className="bg-slate-800 rounded-lg p-3 border border-slate-700 hover:border-blue-400/50 transition-colors cursor-pointer group"
              onClick={() => onCardClick()}
            >
              <div className="flex items-start space-x-3">
                <div className="w-12 h-16 bg-slate-700 rounded overflow-hidden flex-shrink-0">
                  {rec.card.image_uris?.small ? (
                    <img
                      src={rec.card.image_uris.small}
                      alt={rec.card.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                      {rec.card.name.substring(0, 2)}
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-white truncate group-hover:text-blue-400 transition-colors">
                    {rec.card.name}
                  </h4>
                  <p className="text-xs text-slate-400 mb-1">
                    {rec.card.type_line}
                  </p>
                  <span className="text-xs text-blue-400 font-medium">
                    {rec.score}% match
                  </span>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                    {rec.reason}
                  </p>
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

export function CardDetailModal({ card, isOpen, onClose }: CardDetailModalProps) {
  if (!card) return null;

  const getCardImage = () => {
    if (card.image_uris?.large) {
      return card.image_uris.large;
    }
    if (card.card_faces?.[0]?.image_uris?.large) {
      return card.card_faces[0].image_uris.large;
    }
    return null;
  };

  const cardImage = getCardImage();
  const colors = card.colors || card.color_identity || [];
  const price = card.prices?.usd ? `$${card.prices.usd}` : 'N/A';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white text-xl">{card.name}</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card Image */}
          <div className="flex justify-center">
            {cardImage ? (
              <img
                src={cardImage}
                alt={card.name}
                className="rounded-lg shadow-lg max-w-full h-auto"
              />
            ) : (
              <div className="bg-slate-600 rounded-lg w-full aspect-[3/4] flex items-center justify-center">
                <span className="text-slate-400">No Image Available</span>
              </div>
            )}
          </div>

          {/* Card Details */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Type:</span>
                  <span className="text-white">{card.type_line}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Mana Value:</span>
                  <span className="text-white">{card.cmc}</span>
                </div>
                {card.mana_cost && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Mana Cost:</span>
                    <span className="text-white font-mono">{card.mana_cost}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-400">Rarity:</span>
                  <Badge variant="secondary" className="capitalize">
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

            {/* Oracle Text */}
            {card.oracle_text && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Oracle Text</h3>
                <div className="bg-slate-800 rounded-lg p-3 text-sm text-slate-200 whitespace-pre-wrap">
                  {card.oracle_text}
                </div>
              </div>
            )}

            {/* Card Faces (for double-faced cards) */}
            {card.card_faces && card.card_faces.length > 1 && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Card Faces</h3>
                <div className="space-y-3">
                  {card.card_faces.map((face, index) => (
                    <div key={index} className="bg-slate-800 rounded-lg p-3">
                      <h4 className="font-medium text-white mb-1">{face.name}</h4>
                      <p className="text-xs text-slate-400 mb-2">{face.type_line}</p>
                      {face.mana_cost && (
                        <p className="text-xs text-slate-300 mb-2 font-mono">{face.mana_cost}</p>
                      )}
                      {face.oracle_text && (
                        <p className="text-sm text-slate-200 whitespace-pre-wrap">{face.oracle_text}</p>
                      )}
                    </div>
                  ))}
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
          </div>
        </div>

        {/* Three Recommendation Categories */}
        <div className="space-y-8 mt-6">
          {/* Themes */}
          <ThemeRecommendations cardId={card.id} onCardClick={onClose} />
          
          {/* Synergy Cards */}
          <SynergyRecommendations cardId={card.id} onCardClick={onClose} />
          
          {/* Similar Cards */}
          <SimilarRecommendations cardId={card.id} onCardClick={onClose} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
