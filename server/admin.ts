import { Request, Response } from "express";
import { resetAndPopulateThemes, clearCardThemes, getAvailableThemes } from "./utils/reset-themes";

export async function resetThemes(req: Request, res: Response) {
  try {
    const success = await resetAndPopulateThemes();
    if (success) {
      res.json({ 
        message: "Themes reset successfully", 
        count: (await getAvailableThemes()).length 
      });
    } else {
      res.status(500).json({ error: "Failed to reset themes" });
    }
  } catch (error) {
    console.error("Theme reset error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function clearCardSpecificThemes(req: Request, res: Response) {
  try {
    const success = await clearCardThemes();
    if (success) {
      res.json({ message: "Card themes cleared successfully" });
    } else {
      res.status(500).json({ error: "Failed to clear card themes" });
    }
  } catch (error) {
    console.error("Card theme clear error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getThemeList(req: Request, res: Response) {
  try {
    const themes = await getAvailableThemes();
    res.json({ themes, count: themes.length });
  } catch (error) {
    console.error("Get themes error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}