import { useRef, useEffect } from 'react';
import { useCachedImage } from '@/hooks/use-cached-image';

interface CachedImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fallbackSrc?: string;
  priority?: boolean;
  lazy?: boolean;
  onLoad?: () => void;
  onError?: () => void;
  style?: React.CSSProperties;
  loading?: 'lazy' | 'eager';
}

export function CachedImage({
  src,
  alt,
  className = '',
  fallbackSrc,
  priority = false,
  lazy = true,
  onLoad,
  onError,
  style,
  loading = 'lazy'
}: CachedImageProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const { src: cachedSrc, isLoading, error } = useCachedImage(src, {
    fallbackUrl: fallbackSrc,
    lazy,
    priority
  });

  useEffect(() => {
    if (cachedSrc && !isLoading && !error) {
      onLoad?.();
    }
  }, [cachedSrc, isLoading, error, onLoad]);

  useEffect(() => {
    if (error) {
      onError?.();
    }
  }, [error, onError]);

  // Intersection observer for lazy loading
  useEffect(() => {
    if (!lazy || priority || !imgRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Image is visible, trigger loading if not already done
            observer.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: '50px' // Start loading 50px before image is visible
      }
    );

    observer.observe(imgRef.current);

    return () => observer.disconnect();
  }, [lazy, priority]);

  if (!cachedSrc && isLoading) {
    return (
      <div 
        className={`bg-slate-700 animate-pulse flex items-center justify-center ${className}`}
        style={style}
      >
        <div className="text-slate-400 text-sm">Loading...</div>
      </div>
    );
  }

  if (!cachedSrc && (error || !src)) {
    return (
      <div 
        className={`bg-slate-800 flex items-center justify-center text-slate-400 ${className}`}
        style={style}
      >
        <div className="text-center p-2">
          <div className="text-xs">{alt}</div>
        </div>
      </div>
    );
  }

  return (
    <img
      ref={imgRef}
      src={cachedSrc || undefined}
      alt={alt}
      className={className}
      style={style}
      loading={loading}
      onLoad={() => onLoad?.()}
      onError={(e) => {
        onError?.();
        // Fallback to text display
        const img = e.target as HTMLImageElement;
        img.style.display = 'none';
        const parent = img.parentElement;
        if (parent) {
          parent.innerHTML = `
            <div class="w-full h-full flex items-center justify-center text-slate-400 bg-slate-800 p-2">
              <span class="text-sm text-center">${alt}</span>
            </div>
          `;
        }
      }}
    />
  );
}