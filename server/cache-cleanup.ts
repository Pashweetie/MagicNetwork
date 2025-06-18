import { storage } from "./storage";

// Cache cleanup job - can be run periodically
export async function runCacheCleanup() {
  console.log('Starting cache cleanup...');
  try {
    await storage.cleanupOldCache();
    console.log('Cache cleanup completed successfully');
  } catch (error) {
    console.error('Cache cleanup failed:', error);
  }
}