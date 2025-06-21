import { Switch, Route, useLocation, Link } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BandwidthOptimizer } from "@/components/bandwidth-optimizer";
import Search from "@/pages/search";
import { AdminPage } from "@/pages/admin";
import DataManagement from "@/pages/DataManagement";

function Router() {
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b">
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center space-x-6">
            <Link href="/" className="text-xl font-bold">
              MTG Explorer
            </Link>
            <div className="flex space-x-4">
              <Link
                href="/"
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  location === '/' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
                }`}
              >
                Search
              </Link>
              <Link
                href="/admin"
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  location === '/admin' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
                }`}
              >
                Admin
              </Link>
              <Link
                href="/data"
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  location === '/data' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
                }`}
              >
                Data Management
              </Link>
            </div>
          </div>
        </div>
      </nav>
      
      <Switch>
        <Route path="/" component={Search} />
        <Route path="/admin" component={AdminPage} />
        <Route path="/data" component={DataManagement} />
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
