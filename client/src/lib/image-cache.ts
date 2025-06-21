/**
 * Client-side image caching system to reduce bandwidth usage
 * Uses IndexedDB for persistent storage and memory cache for quick access
 */

interface CachedImage {
  url: string;
  blob: Blob;
  timestamp: number;
  size: number;
}

interface CacheStats {
  totalImages: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
}

class ImageCacheManager {
  private db: IDBDatabase | null = null;
  private memoryCache = new Map<string, string>(); // url -> blob URL
  private cacheName = 'mtg-card-images';
  private dbName = 'MTGImageCache';
  private version = 1;
  private maxCacheSize = 500 * 1024 * 1024; // 500MB
  private maxMemoryCache = 100; // 100 images in memory
  private cacheExpiry = 7 * 24 * 60 * 60 * 1000; // 7 days
  
  // Statistics
  private hits = 0;
  private misses = 0;

  async initialize(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.cacheName)) {
          const store = db.createObjectStore(this.cacheName, { keyPath: 'url' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  async getImage(url: string): Promise<string | null> {
    // Check memory cache first
    if (this.memoryCache.has(url)) {
      this.hits++;
      return this.memoryCache.get(url)!;
    }

    // Check IndexedDB
    const cached = await this.getFromIndexedDB(url);
    if (cached && !this.isExpired(cached)) {
      const blobUrl = URL.createObjectURL(cached.blob);
      this.addToMemoryCache(url, blobUrl);
      this.hits++;
      return blobUrl;
    }

    // Cache miss
    this.misses++;
    return null;
  }

  async cacheImage(url: string): Promise<string> {
    try {
      // Check if already cached
      const existing = await this.getImage(url);
      if (existing) return existing;

      // Fetch the image
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
      
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      // Store in IndexedDB
      await this.storeInIndexedDB({
        url,
        blob,
        timestamp: Date.now(),
        size: blob.size
      });

      // Add to memory cache
      this.addToMemoryCache(url, blobUrl);

      // Clean up if cache is too large
      await this.cleanupIfNeeded();

      return blobUrl;
    } catch (error) {
      console.warn('Failed to cache image:', url, error);
      // Return original URL as fallback
      return url;
    }
  }

  private async getFromIndexedDB(url: string): Promise<CachedImage | null> {
    if (!this.db) return null;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction([this.cacheName], 'readonly');
      const store = transaction.objectStore(this.cacheName);
      const request = store.get(url);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  }

  private async storeInIndexedDB(cached: CachedImage): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.cacheName], 'readwrite');
      const store = transaction.objectStore(this.cacheName);
      const request = store.put(cached);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private addToMemoryCache(url: string, blobUrl: string): void {
    // Remove oldest entries if cache is full
    if (this.memoryCache.size >= this.maxMemoryCache) {
      const firstKey = this.memoryCache.keys().next().value;
      const oldBlobUrl = this.memoryCache.get(firstKey);
      if (oldBlobUrl) {
        URL.revokeObjectURL(oldBlobUrl);
      }
      this.memoryCache.delete(firstKey);
    }
    
    this.memoryCache.set(url, blobUrl);
  }

  private isExpired(cached: CachedImage): boolean {
    return Date.now() - cached.timestamp > this.cacheExpiry;
  }

  private async cleanupIfNeeded(): Promise<void> {
    const stats = await this.getCacheStats();
    
    if (stats.totalSize > this.maxCacheSize) {
      await this.cleanupOldEntries();
    }
  }

  private async cleanupOldEntries(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction([this.cacheName], 'readwrite');
      const store = transaction.objectStore(this.cacheName);
      const index = store.index('timestamp');
      const request = index.openCursor();
      
      let deletedSize = 0;
      const targetSize = this.maxCacheSize * 0.7; // Clean to 70% of max size
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor && deletedSize < (this.maxCacheSize - targetSize)) {
          const cached = cursor.value as CachedImage;
          deletedSize += cached.size;
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      
      request.onerror = () => resolve();
    });
  }

  async getCacheStats(): Promise<CacheStats> {
    if (!this.db) {
      return { totalImages: 0, totalSize: 0, hitRate: 0, missRate: 0 };
    }

    return new Promise((resolve) => {
      const transaction = this.db!.transaction([this.cacheName], 'readonly');
      const store = transaction.objectStore(this.cacheName);
      const request = store.getAll();
      
      request.onsuccess = () => {
        const cached = request.result as CachedImage[];
        const totalSize = cached.reduce((sum, item) => sum + item.size, 0);
        const total = this.hits + this.misses;
        
        resolve({
          totalImages: cached.length,
          totalSize,
          hitRate: total > 0 ? (this.hits / total) * 100 : 0,
          missRate: total > 0 ? (this.misses / total) * 100 : 0
        });
      };
      
      request.onerror = () => resolve({ 
        totalImages: 0, 
        totalSize: 0, 
        hitRate: 0, 
        missRate: 0 
      });
    });
  }

  async clearCache(): Promise<void> {
    // Clear memory cache
    for (const blobUrl of this.memoryCache.values()) {
      URL.revokeObjectURL(blobUrl);
    }
    this.memoryCache.clear();

    // Clear IndexedDB
    if (!this.db) return;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction([this.cacheName], 'readwrite');
      const store = transaction.objectStore(this.cacheName);
      const request = store.clear();
      
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Global instance
export const imageCache = new ImageCacheManager();

// Initialize on module load
imageCache.initialize().catch(console.error);