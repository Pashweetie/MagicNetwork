import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CardRecommendations } from "./card-recommendations";
import { ThemeSuggestions } from "./theme-suggestions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface CardDetailModalProps {
  card: Card | null;
  isOpen: boolean;
  onClose: () => void;
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

        {/* Recommendations and Theme Suggestions */}
        <div className="px-6 pb-6">
          <Tabs defaultValue="similar" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-slate-800 border-slate-700">
              <TabsTrigger value="similar" className="data-[state=active]:bg-slate-700">
                Similar Cards
              </TabsTrigger>
              <TabsTrigger value="themes" className="data-[state=active]:bg-slate-700">
                Theme Suggestions
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="similar" className="mt-6">
              <CardRecommendations 
                cardId={card.id} 
                onCardClick={(newCard) => {
                  onClose();
                }}
              />
            </TabsContent>
            
            <TabsContent value="themes" className="mt-6">
              <ThemeSuggestions 
                card={card} 
                onCardClick={(newCard) => {
                  onClose();
                }}
              />
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
