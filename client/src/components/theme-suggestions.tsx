import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@shared/schema";
import { CardTile } from "./card-tile";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Wand2, Users, Crown } from "lucide-react";

interface ThemeSuggestionsProps {
  card: Card;
  onCardClick: (card: Card) => void;
}

interface ThemeGroup {
  theme: string;
  description: string;
  cards: Card[];
  icon: React.ReactNode;
}

export function ThemeSuggestions({ card, onCardClick }: ThemeSuggestionsProps) {
  const [isEnabled, setIsEnabled] = useState(false);

  const { data: themeGroups, isLoading, error } = useQuery({
    queryKey: ['/api/cards', card.id, 'theme-suggestions'],
    queryFn: async () => {
      const response = await fetch(`/api/cards/${card.id}/theme-suggestions`);
      if (!response.ok) throw new Error('Failed to fetch theme suggestions');
      return response.json();
    },
    enabled: isEnabled,
  });

  const getThemeIcon = (theme: string) => {
    const themeLower = theme.toLowerCase();
    if (themeLower.includes('stax') || themeLower.includes('control')) {
      return <Crown className="w-4 h-4 text-purple-400" />;
    }
    if (themeLower.includes('death') || themeLower.includes('taxes')) {
      return <Users className="w-4 h-4 text-yellow-400" />;
    }
    if (themeLower.includes('combo') || themeLower.includes('engine')) {
      return <Wand2 className="w-4 h-4 text-green-400" />;
    }
    return <Sparkles className="w-4 h-4 text-blue-400" />;
  };

  if (!isEnabled) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Smart Theme Suggestions</h3>
          </div>
          <Button 
            onClick={() => setIsEnabled(true)}
            variant="outline"
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 border-blue-500 text-white"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Enable Smart Suggestions
          </Button>
        </div>
        <div className="text-center py-6 text-slate-400">
          <p className="text-sm">
            AI-powered theme analysis will suggest cards based on deck archetypes like
          </p>
          <p className="text-sm mt-1 text-blue-300">
            Death & Taxes, Stax, Combo Engines, and more strategic themes
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Smart Theme Suggestions</h3>
          <div className="text-xs text-blue-300 bg-blue-900/30 px-2 py-1 rounded">
            AI Analyzing...
          </div>
        </div>
        
        <div className="space-y-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="flex items-center space-x-2">
                <Skeleton className="w-4 h-4 bg-slate-700" />
                <Skeleton className="h-4 w-32 bg-slate-700" />
              </div>
              <Skeleton className="h-3 w-64 bg-slate-700" />
              <div className="grid grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, j) => (
                  <Skeleton key={j} className="aspect-[2.5/3.5] bg-slate-700" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !themeGroups || themeGroups.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Smart Theme Suggestions</h3>
        </div>
        <div className="text-center py-6 text-slate-400">
          <p className="text-sm">
            {error ? 'Unable to generate theme suggestions' : 'No themes found for this card'}
          </p>
          <Button 
            onClick={() => setIsEnabled(false)}
            variant="ghost" 
            size="sm" 
            className="mt-2 text-slate-400 hover:text-white"
          >
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Smart Theme Suggestions</h3>
          <div className="text-xs text-green-300 bg-green-900/30 px-2 py-1 rounded">
            AI Powered
          </div>
        </div>
        <div className="text-sm text-slate-400">
          {themeGroups.length} theme{themeGroups.length !== 1 ? 's' : ''} detected
        </div>
      </div>
      
      {themeGroups.map((group: ThemeGroup, index: number) => (
        <div key={index} className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {getThemeIcon(group.theme)}
              <h4 className="font-semibold text-white text-base">{group.theme}</h4>
            </div>
            <div className="text-xs text-blue-300 bg-blue-900/30 px-2 py-1 rounded">
              {group.cards.length} cards
            </div>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">
            {group.description}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {group.cards.map((themeCard) => (
              <div key={themeCard.id} className="relative group">
                <CardTile
                  card={themeCard}
                  onClick={onCardClick}
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="text-xs text-white truncate">
                    {themeCard.name}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}