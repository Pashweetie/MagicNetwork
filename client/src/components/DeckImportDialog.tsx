import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Upload, AlertCircle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface DeckImportDialogProps {
  children: React.ReactNode;
}

export function DeckImportDialog({ children }: DeckImportDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [deckText, setDeckText] = useState("");
  const [format, setFormat] = useState("Commander");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: async ({ deckText, format }: { deckText: string; format: string }) => {
      return apiRequest('/api/user/deck/import', {
        method: 'POST',
        body: JSON.stringify({ deckText, format })
      });
    },
    onSuccess: (result) => {
      toast({
        title: "Import Successful",
        description: result.message,
        variant: result.failedCards.length > 0 ? "default" : "default"
      });
      
      if (result.failedCards.length > 0) {
        toast({
          title: "Some Cards Failed to Import",
          description: `Failed cards: ${result.failedCards.slice(0, 3).join(", ")}${result.failedCards.length > 3 ? ` and ${result.failedCards.length - 3} more` : ""}`,
          variant: "destructive"
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ['/api/user/deck'] });
      setIsOpen(false);
      setDeckText("");
    },
    onError: (error: any) => {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import deck",
        variant: "destructive"
      });
    }
  });

  const handleImport = () => {
    if (!deckText.trim()) {
      toast({
        title: "No Deck Text",
        description: "Please paste your deck list",
        variant: "destructive"
      });
      return;
    }
    
    importMutation.mutate({ deckText, format });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Upload className="w-5 h-5 mr-2" />
            Import Deck
          </DialogTitle>
          <DialogDescription>
            Paste your deck list below. Supports various formats including MTG Arena, MTGO, and plain text.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="format">Format</Label>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Commander">Commander</SelectItem>
                <SelectItem value="Standard">Standard</SelectItem>
                <SelectItem value="Modern">Modern</SelectItem>
                <SelectItem value="Legacy">Legacy</SelectItem>
                <SelectItem value="Vintage">Vintage</SelectItem>
                <SelectItem value="Pauper">Pauper</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="deckText">Deck List</Label>
            <Textarea
              id="deckText"
              value={deckText}
              onChange={(e) => setDeckText(e.target.value)}
              placeholder={`Example format:
1 Lightning Bolt
4 Counterspell
1 Jace, the Mind Sculptor (Commander)

Or:
4x Lightning Bolt
1x Jace, the Mind Sculptor

Supports set codes in parentheses: 4 Lightning Bolt (M21)`}
              className="min-h-[300px] font-mono text-sm"
            />
          </div>
          
          <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 mt-0.5 text-blue-500" />
              <div className="text-sm">
                <p className="font-medium mb-1">Supported formats:</p>
                <ul className="text-xs space-y-1 text-slate-600 dark:text-slate-400">
                  <li>• MTG Arena export format</li>
                  <li>• MTGO deck lists</li>
                  <li>• Plain text with quantities</li>
                  <li>• Mark commanders with "Commander" or "*"</li>
                  <li>• Set codes in parentheses are ignored</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={importMutation.isPending || !deckText.trim()}
          >
            {importMutation.isPending ? "Importing..." : "Import Deck"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}