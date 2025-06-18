import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@shared/schema";
import { CardTile } from "./card-tile";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Wand2, Users, Crown, Plus, ThumbsUp, ThumbsDown } from "lucide-react";

interface ThemeSuggestionsProps {
  card: Card;
  onCardClick: (card: Card) => void;
  onAddCard?: (card: Card) => void;
  currentFilters?: any;
}

interface ThemeGroup {
  theme: string;
  description: string;
  confidence: number;
  cards: Card[];
}

export function ThemeSuggestions({ card, onCardClick, onAddCard, currentFilters }: ThemeSuggestionsProps) {
  const { data: themeGroups, isLoading, error } = useQuery({
    queryKey: ['/api/cards', card.id, 'theme-suggestions', currentFilters],
    queryFn: async () => {
      const filterParams = currentFilters ? `?filters=${encodeURIComponent(JSON.stringify(currentFilters))}` : '';
      const response = await fetch(`/api/cards/${card.id}/theme-suggestions${filterParams}`);
      if (!response.ok) throw new Error('Failed to fetch theme suggestions');
      return response.json();
    },
  });

  const handleThemeFeedback = async (themeName: string, feedback: 'helpful' | 'not_helpful') => {
    try {
      const response = await fetch(`/api/cards/${card.id}/theme-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          themeName: themeName, // Ensure we're sending the actual theme name
          feedback,
          reason: feedback === 'not_helpful' ? 'Theme does not match card strategy' : null
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        
        // Show visual feedback
        const button = document.activeElement as HTMLElement;
        if (button) {
          const originalClasses = button.className;
          const checkmark = feedback === 'helpful' ? '✓' : '✗';
          const bgColor = feedback === 'helpful' ? 'bg-green-500' : 'bg-red-500';
          
          button.innerHTML = `<span class="text-white">${checkmark}</span>`;
          button.className = `${originalClasses} ${bgColor} scale-110 transition-all duration-300`;
          
          const toast = document.createElement('div');
          toast.className = 'fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50';
          toast.textContent = result.message;
          document.body.appendChild(toast);
          
          setTimeout(() => {
            button.className = originalClasses;
            button.innerHTML = feedback === 'helpful' ? '<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z"></path></svg>' : '<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M18 9.5a1.5 1.5 0 11-3 0v-6a1.5 1.5 0 013 0v6zM14 9.667v-5.43a2 2 0 00-1.106-1.79l-.05-.025A4 4 0 0011.057 2H5.64a2 2 0 00-1.962 1.608l-1.2 6A2 2 0 004.44 12H8v4a2 2 0 002 2 1 1 0 001-1v-.667a4 4 0 01.8-2.4l1.4-1.866a4 4 0 00.8-2.4z"></path></svg>';
            toast.remove();
          }, 2000);
        }
      }
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    }
  };

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
          <h3 className="text-lg font-semibold text-white">AI Synergies</h3>
        </div>
        <div className="text-center py-6 text-slate-400">
          <p className="text-sm">
            {error ? 'Error loading synergy suggestions' : 'No strategic synergies detected for this card'}
          </p>
          <p className="text-xs mt-2 text-slate-500">
            The AI is still learning strategic patterns for this card type
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">AI Synergies</h3>
          <div className="text-xs text-green-300 bg-green-900/30 px-2 py-1 rounded">
            AI Generated
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
            <div className="flex items-center space-x-2">
              <div className="flex items-center gap-2">
                <div className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                  {Math.round(group.confidence || 50)}% confidence
                </div>
                <div className="text-xs text-blue-300 bg-blue-900/30 px-2 py-1 rounded">
                  {group.cards.length} cards
                </div>
              </div>
              <Button
                variant="outline" 
                size="sm"
                onClick={() => handleThemeFeedback(group.theme, 'helpful')}
                className="text-green-400 hover:text-green-300 text-xs px-2 py-1"
              >
                👍
              </Button>
              <Button
                variant="outline"
                size="sm" 
                onClick={() => handleThemeFeedback(group.theme, 'not_helpful')}
                className="text-red-400 hover:text-red-300 text-xs px-2 py-1"
              >
                👎
              </Button>
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
                
                {/* Add to deck button */}
                {onAddCard && (
                  <div className="absolute top-1 left-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddCard(themeCard);
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white p-1.5 rounded-md shadow-lg transition-colors"
                      title="Add to deck"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                )}

                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-white truncate flex-1">
                      {themeCard.name}
                    </div>
                    <div className="flex items-center space-x-1 ml-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleThemeFeedback(group.theme, 'helpful');
                        }}
                        className="text-green-400 hover:text-green-300 p-1 hover:bg-green-400/20 rounded"
                        title="This recommendation is helpful"
                      >
                        <ThumbsUp className="w-3 h-3" />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleThemeFeedback(group.theme, 'not_helpful');
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
        </div>
      ))}
    </div>
  );
}