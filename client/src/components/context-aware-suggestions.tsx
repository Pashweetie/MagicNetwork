import { useQuery } from "@tanstack/react-query";
import { Card } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, User, Heart } from "lucide-react";

interface ContextualSuggestionsProps {
  userId: number;
  onCardClick: (card: Card) => void;
}

export function ContextualSuggestions({ userId, onCardClick }: ContextualSuggestionsProps) {
  const { data: suggestions, isLoading } = useQuery({
    queryKey: ['/api/suggestions/contextual', userId],
    queryFn: async () => {
      const response = await fetch(`/api/suggestions/contextual?userId=${userId}&limit=12`);
      return response.json();
    },
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Personalized Suggestions
        </h3>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {Array(12).fill(null).map((_, i) => (
            <div key={i} className="aspect-[5/7] bg-slate-700 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!suggestions?.length) {
    return (
      <div className="text-center py-8 text-slate-400">
        <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Start exploring cards to get personalized suggestions!</p>
        <p className="text-sm mt-2">The system learns from your interactions to recommend cards you'll love.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Heart className="w-5 h-5 text-red-400" />
          Tailored for You
        </h3>
        <Badge variant="secondary" className="text-xs">
          Based on your preferences
        </Badge>
      </div>
      
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
        {suggestions.map((card: Card) => (
          <div
            key={card.id}
            className="relative group cursor-pointer transform transition-all duration-200 hover:scale-105"
            onClick={() => onCardClick(card)}
          >
            {card.image_uris?.normal ? (
              <img
                src={card.image_uris.normal}
                alt={card.name}
                className="w-full aspect-[5/7] object-cover rounded-lg shadow-lg group-hover:shadow-xl"
                loading="lazy"
              />
            ) : (
              <div className="w-full aspect-[5/7] bg-slate-700 rounded-lg flex items-center justify-center">
                <span className="text-xs text-slate-300 text-center p-2">{card.name}</span>
              </div>
            )}
            
            {/* Hover overlay with card name */}
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 transition-all duration-200 rounded-lg flex items-end">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-2 w-full">
                <p className="text-white text-xs font-medium truncate">{card.name}</p>
                <p className="text-slate-300 text-xs truncate">
                  {card.mana_cost && (
                    <span className="inline-block mr-2">{card.mana_cost}</span>
                  )}
                  {card.cmc && <span className="text-slate-400">CMC {card.cmc}</span>}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="text-center">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => window.location.reload()}
          className="text-slate-300 border-slate-600 hover:bg-slate-700"
        >
          Refresh Suggestions
        </Button>
      </div>
    </div>
  );
}