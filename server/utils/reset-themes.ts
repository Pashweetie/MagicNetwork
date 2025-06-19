import { db } from "../db";
import { cardThemes } from "@shared/schema";
import { sql } from "drizzle-orm";
import { PREDEFINED_THEMES } from "./predefined-themes";

export async function resetAndPopulateThemes() {
  try {
    console.log('🗑️ Clearing existing theme data...');
    
    // Clear all existing themes
    await db.delete(cardThemes);
    
    console.log('📚 Populating predefined themes...');
    
    // Create theme entries for each predefined theme
    // This creates a reference catalog of all available themes
    const themeEntries = PREDEFINED_THEMES.map(theme => ({
      card_id: 'CATALOG_ENTRY', // Special marker for catalog entries
      theme_name: theme,
      theme_category: 'Predefined',
      description: `Strategic theme: ${theme}`,
      confidence: 1.0,
      keywords: [theme.toLowerCase().replace(/[^a-z0-9]/g, '')]
    }));
    
    // Insert in batches to avoid database limits
    const batchSize = 50;
    for (let i = 0; i < themeEntries.length; i += batchSize) {
      const batch = themeEntries.slice(i, i + batchSize);
      await db.insert(cardThemes).values(batch);
      console.log(`Inserted batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(themeEntries.length/batchSize)}`);
    }
    
    console.log(`✅ Successfully populated ${PREDEFINED_THEMES.length} predefined themes`);
    return true;
  } catch (error) {
    console.error('❌ Failed to reset themes:', error);
    return false;
  }
}

export async function clearCardThemes() {
  try {
    console.log('🗑️ Clearing all card-specific themes...');
    
    // Clear only card-specific themes, keep catalog entries
    await db.delete(cardThemes).where(sql`card_id != 'CATALOG_ENTRY'`);
    
    console.log('✅ Card themes cleared successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to clear card themes:', error);
    return false;
  }
}

export async function getAvailableThemes(): Promise<string[]> {
  try {
    const themes = await db
      .select({ theme_name: cardThemes.theme_name })
      .from(cardThemes)
      .where(sql`card_id = 'CATALOG_ENTRY'`)
      .orderBy(cardThemes.theme_name);
    
    return themes.map(t => t.theme_name);
  } catch (error) {
    console.error('Failed to get available themes:', error);
    return PREDEFINED_THEMES.slice(); // Fallback to hardcoded list
  }
}