import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card as UICard, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CachedImage } from '@/components/cached-image';
import { Loader2, TrendingUp, Users, DollarSign, ExternalLink, Plus } from 'lucide-react';

interface EdhrecCard {
  name: string;
  url: string;
  num_decks: number;
  synergy: number;
  price: number;
  color_identity: string[];
  type_line: string;
  cmc: number;
  oracle_text?: string;
}

interface EdhrecRecommendations {
  commander: string;
  total_decks: number;
  updated_at: string;
  cards: {
    creatures: EdhrecCard[];
    instants: EdhrecCard[];
    sorceries: EdhrecCard[];
    artifacts: EdhrecCard[];
    enchantments: EdhrecCard[];
    planeswalkers: EdhrecCard[];
    lands: EdhrecCard[];
  };
  themes: Array<{
    name: string;
    url: string;
    num_decks: number;
    cards: EdhrecCard[];
  }>;
}

interface EdhrecRecommendationsProps {
  commander: Card;
  onAddCard?: (cardName: string) => void;
}

function EdhrecCardDisplay({ 
  card, 
  onAddCard 
}: { 
  card: EdhrecCard; 
  onAddCard?: (cardName: string) => void;
}) {
  return (
    <div className="flex items-center space-x-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700 hover:bg-slate-800/70 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2">
          <h4 className="font-medium text-white truncate">{card.name}</h4>
          <Badge variant="secondary" className="text-xs">
            CMC {card.cmc}
          </Badge>
        </div>
        <p className="text-sm text-slate-400 truncate">{card.type_line}</p>
        <div className="flex items-center space-x-4 mt-1">
          <div className="flex items-center space-x-1 text-xs text-slate-500">
            <Users className="w-3 h-3" />
            <span>{card.num_decks.toLocaleString()}</span>
          </div>
          {card.synergy > 0 && (
            <div className="flex items-center space-x-1 text-xs text-green-400">
              <TrendingUp className="w-3 h-3" />
              <span>{card.synergy.toFixed(1)}%</span>
            </div>
          )}
          {card.price > 0 && (
            <div className="flex items-center space-x-1 text-xs text-yellow-400">
              <DollarSign className="w-3 h-3" />
              <span>${card.price.toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center space-x-2">
        {onAddCard && (
          <Button
            size="sm"
            variant="ghost"
            className="w-8 h-8 p-0 text-green-400 hover:text-green-300 hover:bg-green-900/20"
            onClick={() => onAddCard(card.name)}
          >
            <Plus className="w-4 h-4" />
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="w-8 h-8 p-0 text-slate-400 hover:text-slate-300"
          onClick={() => window.open(card.url, '_blank')}
        >
          <ExternalLink className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

export function EdhrecRecommendations({ commander, onAddCard }: EdhrecRecommendationsProps) {
  const [selectedTab, setSelectedTab] = useState('creatures');
  const [displayCounts, setDisplayCounts] = useState<{[key: string]: number}>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const ITEMS_PER_PAGE = 20;

  const { data: recommendations, isLoading, error } = useQuery({
    queryKey: ['edhrec-recommendations', commander.id],
    queryFn: async (): Promise<EdhrecRecommendations> => {
      const response = await fetch(`/api/edhrec/commander/${commander.id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch EDHREC recommendations');
      }
      return response.json();
    },
    enabled: !!commander.id
  });

  // Initialize display counts for each category
  useEffect(() => {
    if (recommendations) {
      const initialCounts: {[key: string]: number} = {};
      Object.keys(recommendations.cards).forEach(key => {
        initialCounts[key] = ITEMS_PER_PAGE;
      });
      setDisplayCounts(initialCounts);
    }
  }, [recommendations]);

  // Infinite scroll handler
  const handleScroll = (event: React.UIEvent<HTMLDivElement>, categoryKey: string) => {
    const target = event.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = target;
    const isNearBottom = scrollTop + clientHeight >= scrollHeight - 100;

    if (isNearBottom && recommendations) {
      const currentCount = displayCounts[categoryKey] || ITEMS_PER_PAGE;
      const totalCards = recommendations.cards[categoryKey as keyof typeof recommendations.cards]?.length || 0;
      
      if (currentCount < totalCards) {
        setDisplayCounts(prev => ({
          ...prev,
          [categoryKey]: Math.min(currentCount + ITEMS_PER_PAGE, totalCards)
        }));
      }
    }
  };

  if (isLoading) {
    return (
      <UICard>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading EDHREC Recommendations...</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-slate-400">
            Fetching recommendations from EDHREC for {commander.name}
          </div>
        </CardContent>
      </UICard>
    );
  }

  if (error) {
    return (
      <UICard>
        <CardHeader>
          <CardTitle className="text-red-400">EDHREC Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-red-400 mb-2">Failed to load EDHREC recommendations</p>
            <p className="text-slate-400 text-sm">
              This commander might not have EDHREC data available
            </p>
          </div>
        </CardContent>
      </UICard>
    );
  }

  if (!recommendations) {
    return null;
  }

  const cardCategories = [
    { key: 'creatures', label: 'Creatures', cards: recommendations.cards.creatures },
    { key: 'instants', label: 'Instants', cards: recommendations.cards.instants },
    { key: 'sorceries', label: 'Sorceries', cards: recommendations.cards.sorceries },
    { key: 'artifacts', label: 'Artifacts', cards: recommendations.cards.artifacts },
    { key: 'enchantments', label: 'Enchantments', cards: recommendations.cards.enchantments },
    { key: 'planeswalkers', label: 'Planeswalkers', cards: recommendations.cards.planeswalkers },
    { key: 'lands', label: 'Lands', cards: recommendations.cards.lands }
  ].filter(category => category.cards.length > 0);

  return (
    <UICard>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>EDHREC Recommendations</span>
          <div className="flex items-center space-x-4 text-sm text-slate-400">
            <div className="flex items-center space-x-1">
              <Users className="w-4 h-4" />
              <span>{recommendations.total_decks.toLocaleString()} decks</span>
            </div>
            <Badge variant="outline" className="text-xs">
              {commander.name}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-7 mb-4">
            {cardCategories.map(category => (
              <TabsTrigger key={category.key} value={category.key} className="text-xs">
                {category.label} ({category.cards.length})
              </TabsTrigger>
            ))}
          </TabsList>
          
          {cardCategories.map(category => {
            const displayCount = displayCounts[category.key] || ITEMS_PER_PAGE;
            const displayCards = category.cards.slice(0, displayCount);
            const hasMore = displayCount < category.cards.length;
            
            return (
              <TabsContent key={category.key} value={category.key}>
                <div 
                  className="h-96 overflow-y-auto"
                  onScroll={(e) => handleScroll(e, category.key)}
                >
                  <div className="space-y-2 pr-4">
                    {displayCards.map((card, index) => (
                      <EdhrecCardDisplay
                        key={`${card.name}-${index}`}
                        card={card}
                        onAddCard={onAddCard}
                      />
                    ))}
                    
                    {hasMore && (
                      <div className="text-center py-4">
                        <div className="flex items-center justify-center space-x-2 text-slate-400">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm">Loading more cards...</span>
                        </div>
                      </div>
                    )}
                    
                    {category.cards.length === 0 && (
                      <div className="text-center py-8 text-slate-400">
                        No {category.label.toLowerCase()} recommendations available
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            );
          })}
        </Tabs>

        {recommendations.themes.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-medium text-white mb-3">Popular Themes</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {recommendations.themes.slice(0, 4).map((theme, index) => (
                <div
                  key={index}
                  className="p-3 bg-slate-800/30 rounded-lg border border-slate-700 hover:bg-slate-800/50 transition-colors cursor-pointer"
                  onClick={() => window.open(theme.url, '_blank')}
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-white">{theme.name}</h4>
                    <div className="flex items-center space-x-1 text-xs text-slate-400">
                      <Users className="w-3 h-3" />
                      <span>{theme.num_decks}</span>
                    </div>
                  </div>
                  <p className="text-sm text-slate-400 mt-1">
                    {theme.cards.length} recommended cards
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </UICard>
  );
}