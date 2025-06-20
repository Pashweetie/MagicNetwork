import { useState, useEffect } from "react";
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
  cards: Array<{card: Card, confidence: number}>;
}

export function ThemeSuggestions({ card, onCardClick, onAddCard, currentFilters }: ThemeSuggestionsProps) {
  const [userHasVoted, setUserHasVoted] = useState<{[theme: string]: boolean}>({});
  const [cardVotes, setCardVotes] = useState<{[cardId: string]: {[themeName: string]: 'up' | 'down'}}>({});
  
  // Reset vote state when card changes
  const [currentCardId, setCurrentCardId] = useState(card.id);
  if (currentCardId !== card.id) {
    setCurrentCardId(card.id);
    setUserHasVoted({});
    setCardVotes({});
  }
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/cards', card.id, 'theme-suggestions', currentFilters],
    queryFn: async () => {
      const filterParams = currentFilters ? `?filters=${encodeURIComponent(JSON.stringify(currentFilters))}` : '';
      const response = await fetch(`/api/cards/${card.id}/theme-suggestions${filterParams}`);
      if (!response.ok) throw new Error('Failed to fetch theme suggestions');
      const result = await response.json();
      
      // Handle both old format (array) and new format (object with themeGroups and userVotes)
      if (Array.isArray(result)) {
        return { themeGroups: result, userVotes: [] };
      }
      return result;
    },
  });

  const themeGroups = data?.themeGroups || [];
  const existingUserVotes = data?.userVotes || [];

  // Initialize card votes and main theme votes from existing user votes
  useEffect(() => {
    if (existingUserVotes.length > 0) {
      const voteMap: {[cardId: string]: {[themeName: string]: 'up' | 'down'}} = {};
      const themeVoteMap: {[key: string]: boolean} = {};
      
      existingUserVotes.forEach((vote: any) => {
        // For card-specific votes
        if (!voteMap[vote.card_id]) {
          voteMap[vote.card_id] = {};
        }
        voteMap[vote.card_id][vote.theme_name] = vote.vote;
        
        // For main theme votes (theme headers)
        if (vote.card_id === card.id) {
          const themeVoteKey = `${vote.card_id}-${vote.theme_name}`;
          themeVoteMap[themeVoteKey] = true;
        }
      });
      
      setCardVotes(voteMap);
      setUserHasVoted(themeVoteMap);
    }
  }, [existingUserVotes, card.id]);

  const handleThemeVote = async (themeName: string, vote: 'up' | 'down') => {
    try {
      const response = await fetch(`/api/cards/${card.id}/theme-vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          themeName, 
          vote
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        
        // Update the userHasVoted state
        const voteKey = `${card.id}-${themeName}`;
        setUserHasVoted(prev => ({
          ...prev,
          [voteKey]: true
        }));
        
        if (result.removed) {
          UIUtils.showToast(result.message || 'Theme removed', 'warning');
          setTimeout(() => window.location.reload(), 1000);
        } else {
          UIUtils.showToast(`Theme confidence updated to ${Math.round(result.newScore)}%`);
          UIUtils.updateConfidenceDisplay(themeName, result.newScore);
          UIUtils.disableVoteButtons(`[data-theme="${themeName}"]`);
        }
      } else if (response.status === 400) {
        const error = await response.json();
        if (error.sameVote) {
          UIUtils.showToast(error.error, 'warning');
        } else {
          UIUtils.showToast(error.error || 'Failed to record vote', 'error');
        }
      } else {
        UIUtils.showToast('Failed to record vote', 'error');
      }
    } catch (error) {
      console.error('Failed to vote on theme:', error);
      UIUtils.showToast('Failed to record vote', 'error');
    }
  };

  const handleCardThemeVote = async (targetCard: Card, themeName: string, vote: 'up' | 'down') => {
    try {
      const response = await fetch(`/api/cards/${targetCard.id}/theme-vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          themeName, 
          vote
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        setCardVotes(prev => ({
          ...prev,
          [targetCard.id]: {
            ...prev[targetCard.id],
            [themeName]: vote
          }
        }));
        
        if (result.removed) {
          UIUtils.showToast(result.message || 'Theme removed', 'warning');
          setTimeout(() => window.location.reload(), 1000);
        } else {
          UIUtils.showToast(`Theme confidence updated to ${Math.round(result.newScore)}%`);
        }
      } else if (response.status === 400) {
        const error = await response.json();
        if (error.sameVote) {
          UIUtils.showToast(error.error, 'warning');
        } else {
          UIUtils.showToast(error.error || 'Failed to record vote', 'error');
        }
      } else {
        UIUtils.showToast('Failed to record vote', 'error');
      }
    } catch (error) {
      console.error('Failed to vote on card theme:', error);
      UIUtils.showToast('Failed to record vote', 'error');
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
                {Math.round(group.confidence)}%
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
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {group.cards.slice(0, 10).map((cardData) => {
                  // Handle both old format (Card) and new format ({card: Card, confidence: number})
                  const card = cardData.card || cardData;
                  const confidence = cardData.confidence || group.confidence;
                  
                  if (!card || !card.id) return null;
                  
                  return (
                    <div key={card.id} className="relative group">
                      <SharedCardTile
                        variant="search"
                        card={card}
                        onClick={onCardClick}
                      />
                      
                      {/* Individual card confidence rating in center */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="bg-black/75 text-white text-sm font-bold px-3 py-2 rounded-full border-2 border-purple-400">
                          {Math.round(confidence)}%
                        </div>
                      </div>
                      
                      {/* Compact button overlay at bottom */}
                      <div className="absolute bottom-1 left-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex items-center justify-between">
                          {/* Vote buttons for theme relevance */}
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className={`w-4 h-4 p-0 rounded-full ${
                                cardVotes[card.id]?.[group.theme] === 'up'
                                  ? 'bg-green-600 text-white'
                                  : 'bg-black/70 text-green-400 hover:bg-green-600'
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCardThemeVote(card, group.theme, 'up');
                              }}
                              title={`This card fits the ${group.theme} theme`}
                            >
                              <ThumbsUp className="w-2 h-2" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className={`w-4 h-4 p-0 rounded-full ${
                                cardVotes[card.id]?.[group.theme] === 'down'
                                  ? 'bg-red-600 text-white'
                                  : 'bg-black/70 text-red-400 hover:bg-red-600'
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCardThemeVote(card, group.theme, 'down');
                              }}
                              title={`This card doesn't fit the ${group.theme} theme`}
                            >
                              <ThumbsDown className="w-2 h-2" />
                            </Button>
                          </div>

                          {/* Add to deck button */}
                          {onAddCard && (
                            <Button
                              size="sm"
                              className="w-5 h-5 p-0 bg-blue-600 hover:bg-blue-700 rounded-full"
                              onClick={(e) => {
                                e.stopPropagation();
                                onAddCard(card);
                              }}
                              title="Add to deck"
                            >
                              <Plus className="w-2.5 h-2.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}