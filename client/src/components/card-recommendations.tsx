import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@shared/schema";
import { CardTile } from "./card-tile";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThumbsUp, ThumbsDown, X, Lightbulb, GitMerge, Copy, Plus } from "lucide-react";

interface CardRecommendationsProps {
  cardId: string;
  onCardClick: (card: Card) => void;
  onAddCard?: (card: Card) => void;
  currentFilters?: any;
}

interface RecommendationWithCard {
  card: Card;
  score: number;
  reason: string;
}

export function CardRecommendations({ cardId, onCardClick, onAddCard, currentFilters }: CardRecommendationsProps) {
  const [activeTab, setActiveTab] = useState<'synergy' | 'functional_similarity' | 'themes'>('themes');
  
  const { data: recommendations, isLoading, error } = useQuery({
    queryKey: ['/api/cards', cardId, 'recommendations', activeTab],
    queryFn: async () => {
      try {
        if (activeTab === 'themes') {
          const response = await fetch(`/api/cards/${cardId}/theme-suggestions`);
          if (!response.ok) throw new Error('Failed to fetch theme suggestions');
          const data = await response.json();
          return data
            .filter((theme: any) => (theme.confidence || 0.8) >= 0.7)
            .flatMap((theme: any) => 
              theme.cards.map((card: any) => ({
                card,
                score: theme.confidence || 0.8,
                reason: `${theme.theme}: ${theme.description}`
              }))
            );
        } else {
          const filterParams = currentFilters ? `&filters=${encodeURIComponent(JSON.stringify(currentFilters))}` : '';
          const response = await fetch(`/api/cards/${cardId}/recommendations?type=${activeTab}&limit=8${filterParams}`);
          if (!response.ok) throw new Error('Failed to fetch recommendations');
          return response.json();
        }
      } catch (err) {
        console.error('Error fetching recommendations:', err);
        return [];
      }
    },
    enabled: !!cardId,
  });

  const submitFeedback = async (recommendedCardId: string, feedback: 'helpful' | 'not_helpful' | 'irrelevant') => {
    try {
      await fetch(`/api/cards/${cardId}/recommendations/${recommendedCardId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback, type: activeTab })
      });
    } catch (error) {
      console.error('Error submitting feedback:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Lightbulb className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Similar Cards</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[2.5/3.5] bg-slate-700" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !recommendations || !Array.isArray(recommendations) || recommendations.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Lightbulb className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Similar Cards</h3>
        </div>
        <div className="text-center py-8 text-slate-400">
          No recommendations available for this card yet.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'synergy' | 'functional_similarity' | 'themes')} className="w-full">
        <div className="flex items-center justify-between mb-4">
          <TabsList className="grid w-full grid-cols-3 bg-slate-800 border-slate-700 max-w-lg">
            <TabsTrigger value="themes" className="data-[state=active]:bg-slate-700 flex items-center space-x-1">
              <Lightbulb className="w-4 h-4" />
              <span>Themes</span>
            </TabsTrigger>
            <TabsTrigger value="synergy" className="data-[state=active]:bg-slate-700 flex items-center space-x-1">
              <GitMerge className="w-4 h-4" />
              <span>Synergies</span>
            </TabsTrigger>
            <TabsTrigger value="functional_similarity" className="data-[state=active]:bg-slate-700 flex items-center space-x-1">
              <Copy className="w-4 h-4" />
              <span>Similar</span>
            </TabsTrigger>
          </TabsList>
          
          <div className="text-sm text-slate-400">
            {recommendations?.length || 0} cards
          </div>
        </div>

        <TabsContent value="themes" className="mt-0">
          <div className="mb-2">
            <p className="text-sm text-slate-300">Cards that share strategic themes and deck archetypes</p>
          </div>
        </TabsContent>

        <TabsContent value="synergy" className="mt-0">
          <div className="mb-2">
            <p className="text-sm text-slate-300">Cards that create specific combos and interactions with this card</p>
          </div>
        </TabsContent>
        
        <TabsContent value="functional_similarity" className="mt-0">
          <div className="mb-2">
            <p className="text-sm text-slate-300">Cards that do similar things (alternatives/substitutes)</p>
          </div>
        </TabsContent>
      </Tabs>
      
      {!recommendations || recommendations.length === 0 ? (
        <div className="text-center py-8 text-slate-400">
          No recommendations available for this card yet.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {recommendations
            .filter((rec: any, index: number, self: any[]) => 
              self.findIndex((r: any) => r.card.id === rec.card.id) === index
            )
            .map((rec: any, index: number) => (
            <div key={`${rec.card.id}-${activeTab}-${index}`} className="relative group">
              <CardTile
                card={rec.card}
                onClick={onCardClick}
              />
              {onAddCard && (
                <Button
                  size="sm"
                  className="absolute top-2 right-2 h-5 w-5 p-0 bg-blue-600 hover:bg-blue-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddCard(rec.card);
                  }}
                >
                  <Plus className="w-2.5 h-2.5" />
                </Button>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="text-xs text-white">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{rec.score}% match</span>
                    <div className="flex space-x-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          submitFeedback(rec.card.id, 'helpful');
                        }}
                        className="p-1 rounded hover:bg-green-600/20"
                        title="Helpful"
                      >
                        <ThumbsUp className="w-3 h-3 text-green-400" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          submitFeedback(rec.card.id, 'not_helpful');
                        }}
                        className="p-1 rounded hover:bg-red-600/20"
                        title="Not helpful"
                      >
                        <ThumbsDown className="w-3 h-3 text-red-400" />
                      </button>
                    </div>
                  </div>
                  <div className="text-slate-300 truncate">
                    {rec.reason}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}