import { z } from "zod";
import { pgTable, text, integer, boolean, timestamp, jsonb, index, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const cardSchema = z.object({
  id: z.string(),
  name: z.string(),
  mana_cost: z.string().optional(),
  cmc: z.number(),
  type_line: z.string(),
  oracle_text: z.string().optional(),
  colors: z.array(z.string()).optional(),
  color_identity: z.array(z.string()).optional(),
  power: z.string().optional(),
  toughness: z.string().optional(),
  rarity: z.enum(['common', 'uncommon', 'rare', 'mythic']),
  set: z.string(),
  set_name: z.string(),
  image_uris: z.object({
    small: z.string(),
    normal: z.string(),
    large: z.string(),
    art_crop: z.string(),
    border_crop: z.string(),
  }).optional(),
  card_faces: z.array(z.object({
    name: z.string(),
    mana_cost: z.string().optional(),
    type_line: z.string(),
    oracle_text: z.string().optional(),
    image_uris: z.object({
      small: z.string(),
      normal: z.string(),
      large: z.string(),
      art_crop: z.string(),
      border_crop: z.string(),
    }).optional(),
  })).optional(),
  prices: z.object({
    usd: z.string().nullable().optional(),
    usd_foil: z.string().nullable().optional(),
    eur: z.string().nullable().optional(),
    tix: z.string().nullable().optional(),
  }).optional(),
  legalities: z.record(z.string(), z.enum(['legal', 'not_legal', 'restricted', 'banned'])).optional(),
});

export const searchFiltersSchema = z.object({
  query: z.string().optional(),
  colors: z.array(z.string()).optional(),
  types: z.array(z.string()).optional(),
  rarities: z.array(z.string()).optional(),
  format: z.string().optional(),
  minMv: z.number().optional(),
  maxMv: z.number().optional(),
  includeMulticolored: z.boolean().optional(),
  oracleText: z.string().optional(),
  set: z.string().optional(),
  artist: z.string().optional(),
  power: z.string().optional(),
  toughness: z.string().optional(),
  loyalty: z.string().optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  colorIdentity: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  produces: z.array(z.string()).optional(),
});

export const searchResponseSchema = z.object({
  data: z.array(cardSchema),
  has_more: z.boolean(),
  next_page: z.string().optional(),
  total_cards: z.number().optional(),
});

export type Card = z.infer<typeof cardSchema>;
export type SearchFilters = z.infer<typeof searchFiltersSchema>;
export type SearchResponse = z.infer<typeof searchResponseSchema>;

// Database tables
export const users = pgTable('users', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});



export const cardCache = pgTable('card_cache', {
  id: text('id').primaryKey(), // Scryfall card ID
  cardData: jsonb('card_data').$type<Card>().notNull(),
  lastUpdated: timestamp('last_updated').defaultNow().notNull(),
  searchCount: integer('search_count').default(0).notNull(),
}, (table) => ({
  lastUpdatedIdx: index('card_cache_last_updated_idx').on(table.lastUpdated),
  searchCountIdx: index('card_cache_search_count_idx').on(table.searchCount),
}));

export const searchCache = pgTable('search_cache', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  queryHash: text('query_hash').notNull().unique(),
  query: text('query').notNull(),
  results: jsonb('results').$type<SearchResponse>().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastAccessed: timestamp('last_accessed').defaultNow().notNull(),
  accessCount: integer('access_count').default(1).notNull(),
}, (table) => ({
  lastAccessedIdx: index('search_cache_last_accessed_idx').on(table.lastAccessed),
  accessCountIdx: index('search_cache_access_count_idx').on(table.accessCount),
}));








// Simplified card themes storage for AI-generated themes
export const cardThemes = pgTable('card_themes', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  card_id: text('card_id').notNull(),
  theme_name: text('theme_name').notNull(),
  confidence: integer('confidence').notNull(), // 1-100 scale
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  cardThemeIdx: index('card_themes_card_idx').on(table.card_id),
  themeIdx: index('card_themes_theme_idx').on(table.theme_name),
  uniqueCardTheme: index('card_themes_unique_idx').on(table.card_id, table.theme_name),
}));

// Theme voting table for user feedback
export const themeVotes = pgTable('theme_votes', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  card_id: text('card_id').notNull(),
  theme_name: text('theme_name').notNull(),
  user_id: integer('user_id').references(() => users.id).notNull(),
  vote: text('vote').notNull(), // 'up' or 'down'
  created_at: timestamp('created_at').defaultNow(),
}, (table) => ({
  cardThemeUserIdx: index('theme_votes_card_theme_user_idx').on(table.card_id, table.theme_name, table.user_id),
  cardThemeIdx: index('theme_votes_card_theme_idx').on(table.card_id, table.theme_name),
}));



// User theme feedback
export const userThemeFeedback = pgTable('user_theme_feedback', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  userId: integer('user_id').references(() => users.id),
  cardId: text('card_id').notNull(),
  themeName: text('theme_name').notNull(),
  vote: text('vote').notNull(), // 'up', 'down'
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userCardThemeIdx: index('user_theme_feedback_idx').on(table.userId, table.cardId, table.themeName),
}));

// Card-theme relevance feedback for theme suggestions
export const cardThemeFeedback = pgTable('card_theme_feedback', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  cardId: text('card_id').notNull(),
  themeName: text('theme_name').notNull(),
  sourceCardId: text('source_card_id').notNull(), // The card that suggested this theme
  feedbackType: text('feedback_type').notNull(), // 'relevant', 'irrelevant'
  userId: integer('user_id').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  cardThemeSourceIdx: index('card_theme_feedback_idx').on(table.cardId, table.themeName, table.sourceCardId, table.userId),
  themeRelevanceIdx: index('theme_relevance_idx').on(table.themeName, table.feedbackType),
}));



// Zod schemas for database operations
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });

export const insertCardCacheSchema = createInsertSchema(cardCache).omit({ lastUpdated: true, searchCount: true });
export const insertSearchCacheSchema = createInsertSchema(searchCache).omit({ id: true, createdAt: true, lastAccessed: true, accessCount: true });


export const insertCardThemeSchema = createInsertSchema(cardThemes).omit({ id: true, created_at: true });
export const insertThemeVoteSchema = createInsertSchema(themeVotes).omit({ id: true, created_at: true });

export const insertUserThemeFeedbackSchema = createInsertSchema(userThemeFeedback).omit({ id: true, createdAt: true });
export const insertCardThemeFeedbackSchema = createInsertSchema(cardThemeFeedback).omit({ id: true, createdAt: true });

// User votes tracking for recommendations and themes
export const userVotes = pgTable('user_votes', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  userId: integer('user_id').references(() => users.id).notNull(),
  targetType: text('target_type').notNull(), // 'theme', 'recommendation'
  targetId: integer('target_id').notNull(), // ID of theme or recommendation
  vote: text('vote').notNull(), // 'up', 'down'
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userTargetIdx: index('user_votes_user_target_idx').on(table.userId, table.targetType, table.targetId),
  targetIdx: index('user_votes_target_idx').on(table.targetType, table.targetId),
}));

// User deck storage table - one deck per user
export const userDecks = pgTable("user_decks", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  userId: text("user_id").notNull(),
  name: text("name").notNull().default("My Deck"),
  format: text("format").notNull().default("Commander"),
  commanderId: text("commander_id"),
  cards: jsonb("cards").notNull().default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Deck persistence schema
export const decks = pgTable('decks', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  userId: integer('user_id').references(() => users.id).notNull(),
  name: text('name').notNull(),
  format: text('format').notNull(), // 'standard', 'commander', 'modern', etc.
  description: text('description'),
  commanderId: text('commander_id').references(() => cardCache.id),
  cards: jsonb('cards').notNull(), // Array of {cardId: string, quantity: number}
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdx: index('decks_user_idx').on(table.userId),
  nameIdx: index('decks_name_idx').on(table.name),
}));

export const insertUserDeckSchema = createInsertSchema(userDecks).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDeckSchema = createInsertSchema(decks).omit({ id: true, createdAt: true, updatedAt: true });
export const insertUserVoteSchema = createInsertSchema(userVotes).omit({ id: true, createdAt: true });

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type CardCacheEntry = typeof cardCache.$inferSelect;
export type InsertCardCache = z.infer<typeof insertCardCacheSchema>;
export type SearchCacheEntry = typeof searchCache.$inferSelect;
export type InsertSearchCache = z.infer<typeof insertSearchCacheSchema>;


export type UserDeck = typeof userDecks.$inferSelect;
export type InsertUserDeck = z.infer<typeof insertUserDeckSchema>;
export type CardTheme = typeof cardThemes.$inferSelect;
export type InsertCardTheme = z.infer<typeof insertCardThemeSchema>;
export type ThemeVote = typeof themeVotes.$inferSelect;
export type InsertThemeVote = z.infer<typeof insertThemeVoteSchema>;

export type UserThemeFeedback = typeof userThemeFeedback.$inferSelect;
export type InsertUserThemeFeedback = z.infer<typeof insertUserThemeFeedbackSchema>;
export type CardThemeFeedback = typeof cardThemeFeedback.$inferSelect;
export type InsertCardThemeFeedback = z.infer<typeof insertCardThemeFeedbackSchema>;


// Deck entry for UI components
export type DeckEntry = {
  card: Card;
  quantity: number;
};

// Deck export format
export type DeckExport = {
  name: string;
  format: string;
  commander?: Card;
  cards: Array<{
    name: string;
    quantity: number;
    cardId?: string;
  }>;
  exportedAt: string;
};

// Deck import format
export type DeckImport = {
  name?: string;
  format?: string;
  commander?: string; // Card name
  cards: Array<{
    name: string;
    quantity: number;
  }>;
};

export type UserVote = typeof userVotes.$inferSelect;
export type InsertUserVote = z.infer<typeof insertUserVoteSchema>;
export type Deck = typeof decks.$inferSelect;
export type InsertDeck = z.infer<typeof insertDeckSchema>;
