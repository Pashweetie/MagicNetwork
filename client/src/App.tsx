import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BandwidthOptimizer } from "@/components/bandwidth-optimizer";
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
        <BandwidthOptimizer />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
