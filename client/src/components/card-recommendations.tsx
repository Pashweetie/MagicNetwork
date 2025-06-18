import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@shared/schema";
import { CardTile } from "./card-tile";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { Lightbulb, TrendingUp } from "lucide-react";

interface CardRecommendationsProps {
  cardId: string;
  onCardClick: (card: Card) => void;
}

interface RecommendationWithCard {
  card: Card;
  score: number;
  reason: string;
}

export function CardRecommendations({ cardId, onCardClick }: CardRecommendationsProps) {
  const { data: recommendations, isLoading, error } = useQuery({
    queryKey: ['/api/cards', cardId, 'recommendations'],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/cards/${cardId}/recommendations?limit=8`);
        if (!response.ok) throw new Error('Failed to fetch recommendations');
        return response.json();
      } catch (err) {
        console.error('Error fetching recommendations:', err);
        return [];
      }
    },
    enabled: !!cardId,
  });

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
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Lightbulb className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Similar Cards</h3>
        </div>
        <div className="text-sm text-slate-400">
          {recommendations.length} recommendations
        </div>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {recommendations.map((rec: any) => (
          <div key={rec.card.id} className="relative group">
            <CardTile
              card={rec.card}
              onClick={onCardClick}
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="text-xs text-white">
                <div className="flex items-center space-x-1 mb-1">
                  <TrendingUp className="w-3 h-3" />
                  <span className="font-medium">{rec.score}% match</span>
                </div>
                <div className="text-slate-300 truncate">
                  {rec.reason}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}