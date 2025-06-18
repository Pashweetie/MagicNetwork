import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@shared/schema";
import { Loader2, GitMerge, ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CardTile } from "./card-tile";
import { queryClient } from "@/lib/queryClient";

interface ThemeBasedSynergiesProps {
  cardId: string;
  onCardClick: (card: Card) => void;
  onAddCard?: (card: Card) => void;
  currentFilters?: any;
}

interface ThemeMatch {
  theme: string;
  confidence: number;
}

interface SynergyCard {
  card: Card;
  sharedThemes: ThemeMatch[];
  synergyScore: number;
  reason: string;
}

export function ThemeBasedSynergies({ cardId, onCardClick, onAddCard, currentFilters }: ThemeBasedSynergiesProps) {
  const [feedback, setFeedback] = useState<Record<string, 'helpful' | 'not_helpful'>>({});

  const { data: synergyData, isLoading, error } = useQuery({
    queryKey: ['/api/cards', cardId, 'theme-synergies', currentFilters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (currentFilters) {
        params.append('filters', JSON.stringify(currentFilters));
      }
      
      const response = await fetch(`/api/cards/${cardId}/theme-synergies?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch theme synergies');
      }
      return response.json();
    },
  });

  const handleFeedback = async (recommendedCardId: string, helpful: boolean) => {
    try {
      const response = await fetch(`/api/cards/${cardId}/recommendation-feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recommendedCardId,
          type: 'theme_synergy',
          helpful: helpful ? 'helpful' : 'not_helpful'
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to record feedback');
      }
      
      setFeedback(prev => ({
        ...prev,
        [recommendedCardId]: helpful ? 'helpful' : 'not_helpful'
      }));
    } catch (error) {
      console.error('Failed to record feedback:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        <span className="ml-2 text-slate-400">Finding theme synergies...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-slate-400">Failed to load theme synergies</p>
      </div>
    );
  }

  if (!synergyData || synergyData.length === 0) {
    return (
      <div className="text-center py-8">
        <GitMerge className="w-12 h-12 text-slate-600 mx-auto mb-4" />
        <p className="text-slate-400">No theme synergies found</p>
        <p className="text-sm text-slate-500 mt-2">
          Try adjusting your search filters
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {synergyData.map((synergy: SynergyCard, index: number) => (
          <div
            key={synergy.card.id}
            className="group relative overflow-visible rounded-lg bg-slate-800 border border-slate-600 hover:border-blue-400 transition-all duration-300 cursor-pointer hover:scale-200 hover:z-50 hover:shadow-2xl"
            onClick={(e) => {
              e.stopPropagation();
              onCardClick(synergy.card);
            }}
            style={{ transformOrigin: 'center' }}
          >
            <div className="aspect-[5/7] relative">
              <img
                src={synergy.card.image_uris?.normal || synergy.card.image_uris?.large}
                alt={synergy.card.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              
              {/* Card name overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <h4 className="text-white text-base font-semibold leading-tight line-clamp-2">
                  {synergy.card.name}
                </h4>
              </div>
            </div>

            {/* Synergy details overlay */}
            <div className="absolute top-3 right-3 bg-black/90 rounded-md px-3 py-2 border border-blue-400/30">
              <div className="text-sm text-blue-300 font-bold">
                {Math.round(synergy.synergyScore * 100)}%
              </div>
            </div>

            {/* Theme badges overlay */}
            <div className="absolute top-3 left-3 flex flex-col gap-2">
              {synergy.sharedThemes.slice(0, 2).map((theme, themeIndex) => (
                <span
                  key={themeIndex}
                  className="text-sm bg-purple-600/90 text-white px-3 py-1 rounded-md font-medium border border-purple-400/30"
                >
                  {theme.theme}
                </span>
              ))}
              {synergy.sharedThemes.length > 2 && (
                <span className="text-sm bg-slate-600/90 text-white px-3 py-1 rounded-md border border-slate-400/30">
                  +{synergy.sharedThemes.length - 2}
                </span>
              )}
            </div>

            {/* Hover info with actions */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/70 transition-all duration-300 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100">
              <div className="text-center text-white p-4">
                <p className="text-sm font-medium mb-3">{synergy.reason}</p>
                <div className="flex flex-wrap gap-2 justify-center mb-4">
                  {synergy.sharedThemes.map((theme, idx) => (
                    <span key={idx} className="text-sm bg-purple-500/90 px-3 py-1 rounded-md border border-purple-400/30">
                      {theme.theme}
                    </span>
                  ))}
                </div>
                
                {/* Action buttons */}
                <div className="flex items-center justify-center gap-3">
                  {onAddCard && (
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddCard(synergy.card);
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4"
                    >
                      Add to Deck
                    </Button>
                  )}
                  
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFeedback(synergy.card.id, true);
                      }}
                      className={`h-8 w-8 p-0 ${
                        feedback[synergy.card.id] === 'helpful' 
                          ? 'text-green-400 bg-green-400/20' 
                          : 'text-slate-400 hover:text-green-400'
                      }`}
                    >
                      <ThumbsUp className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFeedback(synergy.card.id, false);
                      }}
                      className={`h-8 w-8 p-0 ${
                        feedback[synergy.card.id] === 'not_helpful' 
                          ? 'text-red-400 bg-red-400/20' 
                          : 'text-slate-400 hover:text-red-400'
                      }`}
                    >
                      <ThumbsDown className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}