import { useEffect } from 'react';
import { useImageCacheStats } from '@/hooks/use-cached-image';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, TrendingDown } from 'lucide-react';

/**
 * Component to display bandwidth savings from image caching
 */
export function BandwidthOptimizer() {
  const { stats, refreshStats } = useImageCacheStats();

  useEffect(() => {
    // Refresh stats every 30 seconds
    const interval = setInterval(refreshStats, 30000);
    return () => clearInterval(interval);
  }, [refreshStats]);

  // Estimate bandwidth saved (assuming average card image is ~200KB)
  const avgImageSize = 200 * 1024; // 200KB
  const totalImagesSaved = Math.floor(stats.totalImages * (stats.hitRate / 100));
  const bandwidthSaved = totalImagesSaved * avgImageSize;

  const formatBandwidth = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  // Log bandwidth stats to console instead of showing UI
  useEffect(() => {
    if (stats.totalImages > 0) {
      console.log('📊 Bandwidth Stats:', {
        bandwidthSaved: formatBandwidth(bandwidthSaved),
        hitRate: `${stats.hitRate.toFixed(1)}%`,
        totalImages: stats.totalImages,
        imagesSaved: totalImagesSaved
      });
    }
  }, [stats, bandwidthSaved, totalImagesSaved]);

  // Hide the UI component completely
  return null;
}