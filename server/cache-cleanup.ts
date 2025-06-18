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

// Run cleanup every 6 hours if this module is executed directly
if (require.main === module) {
  runCacheCleanup();
  setInterval(runCacheCleanup, 6 * 60 * 60 * 1000);
}