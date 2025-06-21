import { Express, Request, Response } from 'express';
import { edhrecService } from '../services/edhrec-service';
import { storage } from '../storage';

export function registerEdhrecRoutes(app: Express) {
  // Get EDHREC recommendations for a commander
  app.get("/api/edhrec/commander/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Get the commander card from our database
      const commander = await storage.getCard(id);
      if (!commander) {
        return res.status(404).json({ error: 'Commander not found' });
      }

      // Check if the card can be a commander
      const typeLine = commander.type_line?.toLowerCase() || '';
      const isLegendary = typeLine.includes('legendary');
      const isCreature = typeLine.includes('creature');
      const isPlaneswalker = typeLine.includes('planeswalker');
      
      if (!isLegendary || (!isCreature && !isPlaneswalker)) {
        return res.status(400).json({ error: 'Card is not a valid commander' });
      }

      const recommendations = await edhrecService.getCommanderRecommendations(commander);
      
      if (!recommendations) {
        return res.status(404).json({ error: 'No EDHREC data found for this commander' });
      }

      res.json(recommendations);
    } catch (error) {
      console.error('Error fetching EDHREC recommendations:', error);
      res.status(500).json({ error: 'Failed to fetch EDHREC recommendations' });
    }
  });

  // Search for a specific card on EDHREC
  app.get("/api/edhrec/card/:name", async (req: Request, res: Response) => {
    try {
      const { name } = req.params;
      const cardData = await edhrecService.searchEdhrecCard(name);
      
      if (!cardData) {
        return res.status(404).json({ error: 'Card not found on EDHREC' });
      }

      res.json(cardData);
    } catch (error) {
      console.error('Error searching EDHREC card:', error);
      res.status(500).json({ error: 'Failed to search EDHREC card' });
    }
  });

  // Get EDHREC cache statistics (for debugging)
  app.get("/api/edhrec/cache/stats", async (_req: Request, res: Response) => {
    try {
      const stats = edhrecService.getCacheStats();
      res.json(stats);
    } catch (error) {
      console.error('Error fetching cache stats:', error);
      res.status(500).json({ error: 'Failed to fetch cache stats' });
    }
  });

  // Clear EDHREC cache
  app.post("/api/edhrec/cache/clear", async (_req: Request, res: Response) => {
    try {
      edhrecService.clearCache();
      res.json({ success: true, message: 'Cache cleared successfully' });
    } catch (error) {
      console.error('Error clearing cache:', error);
      res.status(500).json({ error: 'Failed to clear cache' });
    }
  });
}