import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Search from "@/pages/search";
import { AdminPage } from "@/pages/admin";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Search} />
      <Route path="/admin" component={AdminPage} />
      <Route component={() => <div className="flex items-center justify-center min-h-screen text-white">Page not found</div>} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
