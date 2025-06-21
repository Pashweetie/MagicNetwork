import { useState } from 'react';

interface SimpleCardImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  loading?: 'lazy' | 'eager';
}

/**
 * Simple card image component without caching for fallback
 */
export function SimpleCardImage({
  src,
  alt,
  className = '',
  style,
  loading = 'lazy'
}: SimpleCardImageProps) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div 
        className={`bg-slate-800 flex items-center justify-center text-slate-400 ${className}`}
        style={style}
      >
        <div className="text-center p-2">
          <div className="text-sm">{alt}</div>
        </div>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      loading={loading}
      onError={() => setHasError(true)}
    />
  );
}