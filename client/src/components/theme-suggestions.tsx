import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@shared/schema";
import { SharedCardTile } from "./shared-card-tile";
import { Button } from "@/components/ui/button";
import { Sparkles, Users, Plus, ThumbsUp, ThumbsDown } from "lucide-react";
import { UIUtils, VoteHandler } from "@shared/utils/ui-utils";

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
  const [userHasVoted, setUserHasVoted] = useState<{[theme: string]: boolean}>({});
  
  // Reset vote state when card changes
  const [currentCardId, setCurrentCardId] = useState(card.id);
  if (currentCardId !== card.id) {
    setCurrentCardId(card.id);
    setUserHasVoted({});
  }
  
  const { data: themeGroups, isLoading, error } = useQuery({
    queryKey: ['/api/cards', card.id, 'theme-suggestions', currentFilters],
    queryFn: async () => {
      const filterParams = currentFilters ? `?filters=${encodeURIComponent(JSON.stringify(currentFilters))}` : '';
      const response = await fetch(`/api/cards/${card.id}/theme-suggestions${filterParams}`);
      if (!response.ok) throw new Error('Failed to fetch theme suggestions');
      return response.json();
    },
  });

  const handleThemeVote = async (themeName: string, vote: 'up' | 'down') => {
    const voteKey = `${card.id}-${themeName}`;
    const result = await VoteHandler.handleVote(
      card.id,
      'theme-vote',
      { themeName, vote },
      userHasVoted,
      setUserHasVoted,
      voteKey
    );
    
    if (result) {
      UIUtils.updateConfidenceDisplay(themeName, result.newConfidence);
      UIUtils.disableVoteButtons(`[data-theme="${themeName}"]`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
        <span className="ml-2 text-slate-400">Loading theme suggestions...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-slate-400">Failed to load theme suggestions</p>
      </div>
    );
  }

  if (!themeGroups || themeGroups.length === 0) {
    return (
      <div className="text-center py-8">
        <Sparkles className="w-12 h-12 text-slate-600 mx-auto mb-4" />
        <p className="text-slate-400">No theme suggestions found</p>
        <p className="text-sm text-slate-500 mt-2">Try adjusting your search filters</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-purple-400" />
        <h3 className="text-lg font-semibold text-white">AI Theme Analysis</h3>
      </div>

      {themeGroups.map((group: ThemeGroup, index: number) => (
        <div key={index} className="bg-slate-800 rounded-lg p-4 border border-slate-700" data-theme={group.theme}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <h4 className="text-white font-medium">{group.theme}</h4>
              <span className="confidence-display text-sm text-slate-300 bg-slate-700 px-2 py-1 rounded">
                {Math.round(group.confidence * 100)}%
              </span>
            </div>
            
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 hover:bg-green-600"
                onClick={() => handleThemeVote(group.theme, 'up')}
                title="Vote theme as helpful"
              >
                <ThumbsUp className="w-3 h-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 hover:bg-red-600"
                onClick={() => handleThemeVote(group.theme, 'down')}
                title="Vote theme as not helpful"
              >
                <ThumbsDown className="w-3 h-3" />
              </Button>
            </div>
          </div>
          
          <p className="text-sm text-slate-400 mb-4">{group.description}</p>
          
          {group.cards && group.cards.length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-1">
                <Users className="w-4 h-4" />
                Similar Cards ({group.cards.length})
              </h5>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {group.cards.slice(0, 12).map((card) => (
                  <div key={card.id} className="relative">
                    <SharedCardTile
                      variant="search"
                      card={card}
                      onClick={onCardClick}
                    />
                    {onAddCard && (
                      <Button
                        size="sm"
                        className="absolute bottom-1 right-1 w-6 h-6 p-0 bg-blue-600 hover:bg-blue-700 z-10"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddCard(card);
                        }}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}