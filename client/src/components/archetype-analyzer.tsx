import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card as UICard, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Brain, TrendingUp, Target, Lightbulb } from "lucide-react";

interface ArchetypeAnalyzerProps {
  cards: Card[];
  onSuggestCard?: (card: Card) => void;
}

interface ArchetypePrediction {
  archetype: string;
  confidence: number;
  reasoning: string[];
}

interface CardCompatibility {
  card: string;
  archetypeCompatibility: { [archetype: string]: number };
}

export function ArchetypeAnalyzer({ cards, onSuggestCard }: ArchetypeAnalyzerProps) {
  const [selectedArchetype, setSelectedArchetype] = useState<string | null>(null);

  // Predict deck archetype
  const { data: predictions, isLoading: predictionsLoading } = useQuery({
    queryKey: ['/api/ml/predict-archetype', cards.map(c => c.id).sort()],
    queryFn: async () => {
      if (cards.length === 0) return [];
      
      const response = await fetch('/api/ml/predict-archetype', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cards })
      });
      
      if (!response.ok) throw new Error('Failed to predict archetype');
      return response.json() as Promise<ArchetypePrediction[]>;
    },
    enabled: cards.length > 0,
  });

  // Get archetype suggestions for selected archetype
  const { data: suggestions, isLoading: suggestionsLoading } = useQuery({
    queryKey: ['/api/ml/archetype-suggestions', selectedArchetype, cards.map(c => c.id).sort()],
    queryFn: async () => {
      if (!selectedArchetype) return null;
      
      const response = await fetch(
        `/api/ml/archetype-suggestions/${selectedArchetype}?deck=${encodeURIComponent(JSON.stringify(cards))}`
      );
      
      if (!response.ok) throw new Error('Failed to get suggestions');
      return response.json();
    },
    enabled: !!selectedArchetype,
  });

  const getArchetypeColor = (archetype: string) => {
    const colors: { [key: string]: string } = {
      'Aggro': 'bg-red-600',
      'Control': 'bg-blue-600', 
      'Midrange': 'bg-green-600',
      'Combo': 'bg-purple-600',
      'Ramp': 'bg-emerald-600',
      'Tribal': 'bg-orange-600'
    };
    return colors[archetype] || 'bg-slate-600';
  };

  const getArchetypeIcon = (archetype: string) => {
    switch (archetype) {
      case 'Aggro': return '⚡';
      case 'Control': return '🛡️';
      case 'Midrange': return '⚖️';
      case 'Combo': return '🔄';
      case 'Ramp': return '🌱';
      case 'Tribal': return '👥';
      default: return '🎯';
    }
  };

  if (cards.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Archetype Predictions */}
      <UICard className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-white">
            <Brain className="w-5 h-5 text-purple-400" />
            <span>Deck Archetype Analysis</span>
            <Badge variant="secondary" className="ml-2">
              {cards.length} cards
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {predictionsLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-24 bg-slate-700" />
                    <Skeleton className="h-4 w-12 bg-slate-700" />
                  </div>
                  <Skeleton className="h-2 w-full bg-slate-700" />
                </div>
              ))}
            </div>
          ) : predictions && predictions.length > 0 ? (
            <div className="space-y-4">
              {predictions.slice(0, 5).map((prediction, index) => (
                <div key={prediction.archetype} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-lg">{getArchetypeIcon(prediction.archetype)}</span>
                      <div>
                        <h4 className="font-medium text-white">{prediction.archetype}</h4>
                        <p className="text-xs text-slate-400">
                          {Math.round(prediction.confidence * 100)}% match
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-slate-300">
                        {Math.round(prediction.confidence * 100)}%
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedArchetype(prediction.archetype)}
                        className="text-xs"
                      >
                        Optimize
                      </Button>
                    </div>
                  </div>
                  <Progress 
                    value={prediction.confidence * 100} 
                    className="h-2"
                  />
                  {index === 0 && prediction.reasoning.length > 0 && (
                    <div className="mt-2 p-3 bg-slate-900 rounded">
                      <p className="text-xs text-slate-300 mb-2">Key factors:</p>
                      <ul className="text-xs text-slate-400 space-y-1">
                        {prediction.reasoning.slice(0, 3).map((reason, i) => (
                          <li key={i} className="flex items-start space-x-1">
                            <span className="text-blue-400 mt-0.5">•</span>
                            <span>{reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-slate-400">
              <p>Unable to determine archetype</p>
              <p className="text-sm mt-1">Add more cards for better analysis</p>
            </div>
          )}
        </CardContent>
      </UICard>

      {/* Archetype Optimization Suggestions */}
      {selectedArchetype && (
        <UICard className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-white">
              <Target className="w-5 h-5 text-green-400" />
              <span>Optimize for {selectedArchetype}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedArchetype(null)}
                className="ml-auto text-slate-400 hover:text-white"
              >
                ✕
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {suggestionsLoading ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="aspect-[2.5/3.5] bg-slate-700" />
                  ))}
                </div>
              </div>
            ) : suggestions && suggestions.suggestions.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center space-x-2 mb-4">
                  <Lightbulb className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm text-slate-300">
                    Cards that would improve your {selectedArchetype.toLowerCase()} strategy
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {suggestions.suggestions.slice(0, 12).map((card: Card) => (
                    <div
                      key={card.id}
                      className="group relative cursor-pointer"
                      onClick={() => onSuggestCard?.(card)}
                    >
                      <div className="aspect-[2.5/3.5] bg-slate-700 rounded-lg overflow-hidden">
                        {card.image_uris?.small ? (
                          <img
                            src={card.image_uris.small}
                            alt={card.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400">
                            <span className="text-xs text-center p-2">{card.name}</span>
                          </div>
                        )}
                      </div>
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-xs text-white font-medium truncate">{card.name}</p>
                        <p className="text-xs text-slate-300">{card.type_line}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-slate-400">
                <p>No optimization suggestions available</p>
                <p className="text-sm mt-1">Your deck is already well-optimized for {selectedArchetype}</p>
              </div>
            )}
          </CardContent>
        </UICard>
      )}
    </div>
  );
}