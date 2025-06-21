import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { StackedDeckDisplay } from "@/components/stacked-deck-display";
import { SharedCardTile } from "@/components/shared-card-tile";
import { Card } from "@shared/schema";
import { useDeck, FORMATS } from "@/hooks/use-deck";
import { X, Crown, Grid, List, Package, Download, Upload, Trash2 } from "lucide-react";

interface DeckFullscreenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCardClick: (card: Card) => void;
}

export function DeckFullscreenModal({ isOpen, onClose, onCardClick }: DeckFullscreenModalProps) {
  const deck = useDeck();
  const [viewMode, setViewMode] = useState<"grid" | "stacked">("stacked");

  const handleExportDeck = () => {
    const deckText = deck.exportToText();
    const blob = new Blob([deckText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${deck.name || 'deck'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClearDeck = () => {
    if (confirm('Are you sure you want to clear your entire deck?')) {
      deck.clearDeck();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[95vh] w-[95vw] bg-slate-900 border-slate-700">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <DialogTitle className="text-2xl font-bold text-white flex items-center">
            <Package className="w-6 h-6 mr-2" />
            {deck.name || 'My Deck'} ({deck.totalCards} cards)
          </DialogTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </Button>
        </DialogHeader>

        <div className="space-y-4">
          {/* Deck Controls */}
          <div className="flex items-center justify-between flex-wrap gap-4 p-4 bg-slate-800 rounded-lg border border-slate-700">
            <div className="flex items-center space-x-4">
              {/* Format Selector */}
              <div className="flex items-center space-x-2">
                <span className="text-sm text-slate-400">Format:</span>
                <Select 
                  value={deck.format.name} 
                  onValueChange={(value) => {
                    const format = FORMATS.find(f => f.name === value);
                    if (format) deck.setFormat(format);
                  }}
                >
                  <SelectTrigger className="w-32 bg-slate-700 border-slate-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMATS.map(format => (
                      <SelectItem key={format.name} value={format.name}>
                        {format.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Commander Display */}
              {deck.commander && (
                <div className="flex items-center space-x-2 px-3 py-2 bg-yellow-900/30 border border-yellow-600/50 rounded-lg">
                  <Crown className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm text-yellow-200">Commander: {deck.commander.name}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 w-5 p-0 text-yellow-400 hover:text-yellow-300"
                    onClick={() => deck.setCommander(null)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              )}

              {/* Deck Stats */}
              <div className="flex items-center space-x-4 text-sm text-slate-400">
                <span>Valid: {deck.isFormatValid() ? "✓" : "✗"}</span>
                <span>Avg CMC: {deck.averageCMC.toFixed(1)}</span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {/* View Mode Toggle */}
              <div className="flex bg-slate-700 rounded overflow-hidden">
                <Button
                  variant={viewMode === "stacked" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("stacked")}
                  className={viewMode === "stacked" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}
                >
                  <Package className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                  className={viewMode === "grid" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}
                >
                  <Grid className="h-4 w-4" />
                </Button>
              </div>

              {/* Deck Actions */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportDeck}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearDeck}
                className="border-red-600 text-red-400 hover:bg-red-900/30"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear
              </Button>
            </div>
          </div>

          {/* Deck Content */}
          <div className="max-h-[70vh] overflow-y-auto">
            {deck.totalCards === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="text-slate-500 mb-4">
                  <Package className="w-16 h-16 mx-auto opacity-50" />
                </div>
                <h3 className="text-xl font-semibold text-slate-300 mb-2">Your deck is empty</h3>
                <p className="text-slate-400 max-w-md">
                  Search for cards and add them to your deck to get started building.
                </p>
              </div>
            ) : viewMode === "stacked" ? (
              <StackedDeckDisplay 
                deckEntries={deck.deckEntries}
                onAdd={deck.addCard}
                onRemove={deck.removeCard}
                onClick={onCardClick}
                onSetCommander={deck.format.name === 'Commander' ? deck.setCommanderFromCard : undefined}
                commander={deck.commander}
                getMaxCopies={deck.getMaxCopies}
              />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 p-4">
                {deck.deckEntries.map(({ card, quantity }) => (
                  <div key={card.id} className="relative">
                    <SharedCardTile
                      variant="deck"
                      card={card}
                      onClick={onCardClick}
                      quantity={quantity}
                      maxCopies={deck.getMaxCopies(card)}
                      onAdd={() => deck.addCard(card)}
                      onRemove={() => deck.removeCard(card.id)}
                      onSetCommander={deck.format.name === 'Commander' ? deck.setCommanderFromCard : undefined}
                      isCommander={deck.commander?.id === card.id}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}