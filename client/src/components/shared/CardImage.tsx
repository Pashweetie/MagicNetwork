import { useRef, useEffect, useState } from 'react';
import { useCachedImage, useImageCacheStats } from '@/hooks/use-cached-image';
import { cn } from '@/lib/utils';

interface CardImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  cached?: boolean;          // Enable caching (default: true)
  lazy?: boolean;           // Lazy loading (default: true)
  priority?: boolean;       // High priority loading (default: false)
  fallback?: 'placeholder' | 'text' | React.ReactNode; // Fallback type
  onLoad?: () => void;
  onError?: () => void;
  loading?: 'lazy' | 'eager';
}

/**
 * Unified card image component that combines:
 * - Image caching (IndexedDB)
 * - Lazy loading with intersection observer
 * - Error handling with fallbacks
 * - Performance monitoring
 */
export function CardImage({
  src,
  alt,
  className = '',
  style,
  cached = true,
  lazy = true,
  priority = false,
  fallback = 'placeholder',
  onLoad,
  onError,
  loading = 'lazy'
}: CardImageProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [simpleError, setSimpleError] = useState(false);

  // Use caching hook if caching is enabled
  const cachedImageResult = useCachedImage(cached ? src : null, {
    lazy,
    priority
  });

  // Determine which src to use
  const imageSrc = cached ? cachedImageResult.src : src;
  const isLoading = cached ? cachedImageResult.isLoading : false;
  const hasError = cached ? cachedImageResult.error : simpleError;

  // Handle callbacks for cached images
  useEffect(() => {
    if (cached && imageSrc && !isLoading && !hasError) {
      onLoad?.();
    }
  }, [cached, imageSrc, isLoading, hasError, onLoad]);

  useEffect(() => {
    if (cached && hasError) {
      onError?.();
    }
  }, [cached, hasError, onError]);

  // Intersection observer for lazy loading (non-cached images)
  useEffect(() => {
    if (cached || !lazy || priority || !imgRef.current || !src) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, [cached, lazy, priority, src]);

  // Handle simple image error for non-cached images
  const handleImageError = () => {
    if (!cached) {
      setSimpleError(true);
      onError?.();
    }
  };

  const handleImageLoad = () => {
    if (!cached) {
      onLoad?.();
    }
  };

  // Render fallback content
  const renderFallback = () => {
    if (fallback === 'text') {
      return (
        <div className={cn(
          "bg-slate-800 flex items-center justify-center text-slate-400",
          className
        )} style={style}>
          <div className="text-center p-2">
            <div className="text-sm">{alt}</div>
          </div>
        </div>
      );
    }

    if (fallback === 'placeholder') {
      return (
        <div className={cn(
          "bg-slate-800 flex items-center justify-center text-slate-400 border border-slate-700 rounded",
          className
        )} style={style}>
          <div className="text-center p-4">
            <div className="w-8 h-8 mx-auto mb-2 opacity-50">🃏</div>
            <div className="text-xs opacity-75">Card Image</div>
          </div>
        </div>
      );
    }

    // Custom fallback component
    return fallback;
  };

  // Show fallback if no src or error occurred
  if (!src || hasError) {
    return renderFallback();
  }

  // Show loading state for cached images
  if (cached && isLoading) {
    return (
      <div className={cn(
        "bg-slate-800 flex items-center justify-center text-slate-400 animate-pulse",
        className
      )} style={style}>
        <div className="text-center p-4">
          <div className="w-6 h-6 mx-auto mb-2 animate-spin rounded-full border-2 border-slate-400 border-t-transparent"></div>
          <div className="text-xs opacity-75">Loading...</div>
        </div>
      </div>
    );
  }

  // Render the actual image
  return (
    <img
      ref={imgRef}
      src={imageSrc || src}
      alt={alt}
      className={className}
      style={style}
      loading={loading}
      onLoad={handleImageLoad}
      onError={handleImageError}
    />
  );
}

/**
 * Hook to get image cache statistics for performance monitoring
 */
export function useCardImageStats() {
  const { stats } = useImageCacheStats();
  
  // Calculate bandwidth savings (assuming average card image is ~200KB)
  const avgImageSize = 200 * 1024; // 200KB
  const totalImagesSaved = Math.floor(stats.totalImages * (stats.hitRate / 100));
  const bandwidthSaved = totalImagesSaved * avgImageSize;

  const formatBandwidth = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  return {
    ...stats,
    totalImagesSaved,
    bandwidthSaved,
    formattedBandwidthSaved: formatBandwidth(bandwidthSaved)
  };
}