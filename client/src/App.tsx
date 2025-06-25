import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { useCardImageStats } from "@/components/shared/CardImage";
import { useEffect } from "react";
import Search from "@/pages/search";

function Router() {
  return (
    <div className="min-h-screen bg-background">
      <Switch>
        <Route path="/" component={Search} />
        <Route component={() => <div className="flex items-center justify-center min-h-screen">Page not found</div>} />
      </Switch>
    </div>
  );
}

function ImageStatsLogger() {
  const stats = useCardImageStats();
  
  useEffect(() => {
    if (stats.totalImages > 0) {
      console.log('📊 Image Cache Stats:', {
        bandwidthSaved: stats.formattedBandwidthSaved,
        hitRate: `${stats.hitRate.toFixed(1)}%`,
        totalImages: stats.totalImages,
        imagesSaved: stats.totalImagesSaved
      });
    }
  }, [stats]);
  
  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <ImageStatsLogger />
      <Toaster />
    </QueryClientProvider>
  );
}
