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

  if (stats.totalImages === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-lg z-50">
      <div className="flex items-center space-x-2">
        <TrendingDown className="w-4 h-4 text-green-400" />
        <span className="text-sm text-slate-300">Bandwidth Saved:</span>
        <Badge variant="outline" className="bg-green-900 text-green-400 border-green-600">
          {formatBandwidth(bandwidthSaved)}
        </Badge>
      </div>
      <div className="flex items-center space-x-2 mt-1">
        <div className="flex items-center space-x-1">
          <Wifi className="w-3 h-3 text-blue-400" />
          <span className="text-xs text-slate-400">Hit Rate:</span>
          <span className="text-xs text-white">{stats.hitRate.toFixed(1)}%</span>
        </div>
        <div className="text-xs text-slate-500">•</div>
        <div className="text-xs text-slate-400">
          {stats.totalImages} cached
        </div>
      </div>
    </div>
  );
}