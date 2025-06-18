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

export const savedSearches = pgTable('saved_searches', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  userId: integer('user_id').references(() => users.id).notNull(),
  name: text('name').notNull(),
  filters: jsonb('filters').$type<SearchFilters>().notNull(),
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

export const favoriteCards = pgTable('favorite_cards', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  userId: integer('user_id').references(() => users.id).notNull(),
  cardId: text('card_id').references(() => cardCache.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const cardRecommendations = pgTable('card_recommendations', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  sourceCardId: text('source_card_id').references(() => cardCache.id).notNull(),
  recommendedCardId: text('recommended_card_id').references(() => cardCache.id).notNull(),
  recommendationType: text('recommendation_type').notNull(), // 'synergy' or 'functional_similarity'
  score: integer('score').notNull(), // 0-100 recommendation strength
  reason: text('reason').notNull(), // Why this card is recommended
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  sourceCardIdx: index('card_recommendations_source_idx').on(table.sourceCardId),
  typeIdx: index('card_recommendations_type_idx').on(table.recommendationType),
  scoreIdx: index('card_recommendations_score_idx').on(table.score),
}));

export const userInteractions = pgTable('user_interactions', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  userId: integer('user_id').references(() => users.id).notNull(),
  cardId: text('card_id').references(() => cardCache.id).notNull(),
  interactionType: text('interaction_type').notNull(), // 'view', 'favorite', 'search', 'deck_add'
  metadata: jsonb('metadata'), // Additional context like search query, deck type, etc.
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userCardIdx: index('user_interactions_user_card_idx').on(table.userId, table.cardId),
  typeIdx: index('user_interactions_type_idx').on(table.interactionType),
  userIdx: index('user_interactions_user_idx').on(table.userId),
}));




// New table to store card themes
export const cardThemes = pgTable('card_themes', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  cardId: text('card_id').references(() => cardCache.id).notNull(),
  themeName: text('theme_name').notNull(),
  themeCategory: text('theme_category').notNull(), // 'strategy', 'archetype', 'mechanic', 'synergy'
  confidence: integer('confidence').notNull(), // 1-100 confidence score
  keywords: text('keywords').array(), // Keywords that triggered this theme
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastUpdated: timestamp('last_updated').defaultNow().notNull(),
}, (table) => ({
  cardThemeIdx: index('card_theme_idx').on(table.cardId, table.themeName),
  themeNameIdx: index('theme_name_idx').on(table.themeName),
}));

// User feedback for improving recommendations
export const recommendationFeedback = pgTable('recommendation_feedback', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  userId: integer('user_id').references(() => users.id),
  sourceCardId: text('source_card_id').references(() => cardCache.id).notNull(),
  recommendedCardId: text('recommended_card_id').references(() => cardCache.id).notNull(),
  recommendationType: text('recommendation_type').notNull(), // 'synergy' or 'functional_similarity'
  feedback: text('feedback').notNull(), // 'helpful', 'not_helpful', 'irrelevant'
  userComment: text('user_comment'), // Optional explanation
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  sourceCardIdx: index('feedback_source_idx').on(table.sourceCardId),
  feedbackIdx: index('feedback_type_idx').on(table.feedback),
}));

// Zod schemas for database operations
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertSavedSearchSchema = createInsertSchema(savedSearches).omit({ id: true, createdAt: true });
export const insertFavoriteCardSchema = createInsertSchema(favoriteCards).omit({ id: true, createdAt: true });
export const insertCardCacheSchema = createInsertSchema(cardCache).omit({ lastUpdated: true, searchCount: true });
export const insertSearchCacheSchema = createInsertSchema(searchCache).omit({ id: true, createdAt: true, lastAccessed: true, accessCount: true });
export const insertCardRecommendationSchema = createInsertSchema(cardRecommendations).omit({ id: true, createdAt: true });
export const insertUserInteractionSchema = createInsertSchema(userInteractions).omit({ id: true, createdAt: true });

export const insertCardThemeSchema = createInsertSchema(cardThemes).omit({ id: true, createdAt: true, lastUpdated: true });
export const insertRecommendationFeedbackSchema = createInsertSchema(recommendationFeedback).omit({ id: true, createdAt: true });
export const insertRecommendationWeightSchema = createInsertSchema(recommendationWeights).omit({ id: true, lastUpdated: true });
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

export const insertDeckSchema = createInsertSchema(decks).omit({ id: true, createdAt: true, updatedAt: true });
// export const insertThemeWeightSchema = createInsertSchema(themeWeights).omit({ id: true, createdAt: true, updatedAt: true });

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type SavedSearch = typeof savedSearches.$inferSelect;
export type InsertSavedSearch = z.infer<typeof insertSavedSearchSchema>;
export type FavoriteCard = typeof favoriteCards.$inferSelect;
export type InsertFavoriteCard = z.infer<typeof insertFavoriteCardSchema>;
export type CardCacheEntry = typeof cardCache.$inferSelect;
export type InsertCardCache = z.infer<typeof insertCardCacheSchema>;
export type SearchCacheEntry = typeof searchCache.$inferSelect;
export type InsertSearchCache = z.infer<typeof insertSearchCacheSchema>;
export type CardRecommendation = typeof cardRecommendations.$inferSelect;
export type InsertCardRecommendation = z.infer<typeof insertCardRecommendationSchema>;
export type UserInteraction = typeof userInteractions.$inferSelect;
export type InsertUserInteraction = z.infer<typeof insertUserInteractionSchema>;

export type CardTheme = typeof cardThemes.$inferSelect;
export type InsertCardTheme = z.infer<typeof insertCardThemeSchema>;
export type RecommendationFeedback = typeof recommendationFeedback.$inferSelect;
export type InsertRecommendationFeedback = z.infer<typeof insertRecommendationFeedbackSchema>;
export type RecommendationWeight = typeof recommendationWeights.$inferSelect;
export type InsertRecommendationWeight = z.infer<typeof insertRecommendationWeightSchema>;
export type Deck = typeof decks.$inferSelect;
export type InsertDeck = z.infer<typeof insertDeckSchema>;
// export type ThemeWeight = typeof themeWeights.$inferSelect;
// export type InsertThemeWeight = z.infer<typeof insertThemeWeightSchema>;
