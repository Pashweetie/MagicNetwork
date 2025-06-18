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
    <div className="space-y-4">
      {synergyData.map((synergy: SynergyCard, index: number) => (
        <div
          key={synergy.card.id}
          className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 hover:border-slate-600 transition-all duration-200"
        >
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <div className="w-20 h-28">
                <CardTile
                  card={synergy.card}
                  onClick={() => onCardClick(synergy.card)}
                />
              </div>
            </div>
            
            <div className="flex-grow min-w-0">
              <div className="flex items-start justify-between">
                <div className="flex-grow">
                  <h4 className="font-semibold text-slate-200 mb-2">
                    {synergy.card.name}
                  </h4>
                  
                  <div className="flex items-center space-x-2 mb-3">
                    <Badge variant="outline" className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                      {Math.round(synergy.synergyScore * 100)}% Synergy
                    </Badge>
                    <span className="text-xs text-slate-500">
                      {synergy.sharedThemes.length} shared theme{synergy.sharedThemes.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  
                  <div className="mb-3">
                    <p className="text-sm text-slate-300 mb-2">{synergy.reason}</p>
                    
                    <div className="flex flex-wrap gap-1">
                      {synergy.sharedThemes.map((theme, themeIndex) => (
                        <Badge
                          key={themeIndex}
                          variant="secondary"
                          className="text-xs bg-slate-700 text-slate-300 hover:bg-slate-600"
                        >
                          {theme.theme}
                          <span className="ml-1 text-slate-400">
                            ({Math.round(theme.confidence)}%)
                          </span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {onAddCard && (
                      <Button
                        size="sm"
                        onClick={() => onAddCard(synergy.card)}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        Add to Deck
                      </Button>
                    )}
                    
                    <div className="flex items-center space-x-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleFeedback(synergy.card.id, true)}
                        className={`h-8 w-8 p-0 ${
                          feedback[synergy.card.id] === 'helpful' 
                            ? 'text-green-400 bg-green-400/20' 
                            : 'text-slate-400 hover:text-green-400'
                        }`}
                      >
                        <ThumbsUp className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleFeedback(synergy.card.id, false)}
                        className={`h-8 w-8 p-0 ${
                          feedback[synergy.card.id] === 'not_helpful' 
                            ? 'text-red-400 bg-red-400/20' 
                            : 'text-slate-400 hover:text-red-400'
                        }`}
                      >
                        <ThumbsDown className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}