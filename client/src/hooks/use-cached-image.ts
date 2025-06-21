import { useState, useEffect, useCallback } from 'react';
import { imageCache } from '@/lib/image-cache';

interface UseCachedImageOptions {
  fallbackUrl?: string;
  lazy?: boolean;
  priority?: boolean;
}

interface UseCachedImageReturn {
  src: string | null;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

export function useCachedImage(
  originalUrl: string | null | undefined,
  options: UseCachedImageOptions = {}
): UseCachedImageReturn {
  const { fallbackUrl, lazy = true, priority = false } = options;
  
  const [src, setSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadImage = useCallback(async () => {
    if (!originalUrl) {
      setSrc(fallbackUrl || null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Try to get from cache first
      let cachedUrl = await imageCache.getImage(originalUrl);
      
      if (cachedUrl) {
        setSrc(cachedUrl);
        setIsLoading(false);
        return;
      }

      // If not in cache, cache it now
      cachedUrl = await imageCache.cacheImage(originalUrl);
      setSrc(cachedUrl);
      
    } catch (err) {
      console.warn('Failed to load cached image:', originalUrl, err);
      setError(err instanceof Error ? err.message : 'Failed to load image');
      setSrc(fallbackUrl || originalUrl);
    } finally {
      setIsLoading(false);
    }
  }, [originalUrl, fallbackUrl]);

  const reload = useCallback(() => {
    loadImage();
  }, [loadImage]);

  useEffect(() => {
    if (!lazy || priority) {
      loadImage();
    }
  }, [loadImage, lazy, priority]);

  // For lazy loading, we'll expose the load function
  const startLoading = useCallback(() => {
    if (lazy && !src && !isLoading) {
      loadImage();
    }
  }, [lazy, src, isLoading, loadImage]);

  // Auto-trigger lazy loading when needed
  useEffect(() => {
    if (lazy && !priority && originalUrl && !src && !isLoading) {
      // Small delay to avoid loading too many images at once
      const timeout = setTimeout(startLoading, 100);
      return () => clearTimeout(timeout);
    }
  }, [lazy, priority, originalUrl, src, isLoading, startLoading]);

  return {
    src,
    isLoading,
    error,
    reload
  };
}

// Hook for preloading images
export function useImagePreloader() {
  const preloadImages = useCallback(async (urls: string[]): Promise<void> => {
    const promises = urls
      .filter(Boolean)
      .map(url => imageCache.cacheImage(url).catch(console.warn));
    
    await Promise.allSettled(promises);
  }, []);

  return { preloadImages };
}

// Hook for cache management
export function useImageCacheStats() {
  const [stats, setStats] = useState({
    totalImages: 0,
    totalSize: 0,
    hitRate: 0,
    missRate: 0
  });

  const refreshStats = useCallback(async () => {
    const newStats = await imageCache.getCacheStats();
    setStats(newStats);
  }, []);

  const clearCache = useCallback(async () => {
    await imageCache.clearCache();
    await refreshStats();
  }, [refreshStats]);

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  return {
    stats,
    refreshStats,
    clearCache,
    formatBytes: imageCache.formatBytes
  };
}