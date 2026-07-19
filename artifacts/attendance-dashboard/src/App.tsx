import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter } from 'wouter';

import { AppLayout } from '@/components/layout/AppLayout';
import HomePage from '@/pages/HomePage';
import Dashboard from '@/pages/Dashboard';
import ClassesList from '@/pages/ClassesList';
import ClassDetail from '@/pages/ClassDetail';
import StudentsList from '@/pages/StudentsList';
import StudentDetail from '@/pages/StudentDetail';
import ExcusesAI from '@/pages/ExcusesAI';

const queryClient = new QueryClient();

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
      <h1 className="text-4xl font-bold mb-2">404</h1>
      <p className="text-muted-foreground mb-4">Page not found</p>
      <a href="/" className="text-primary hover:underline">Return to Home</a>
    </div>
  );
}

function AppRoutes() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/dashboard" component={Dashboard} />

        <Route path="/classes" component={ClassesList} />
        <Route path="/classes/:id" component={ClassDetail} />

        <Route path="/students" component={StudentsList} />
        <Route path="/students/:id" component={StudentDetail} />

        <Route path="/excuses" component={ExcusesAI} />

        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function Router() {
  return (
    <Switch>
      {/* Welcome screen — standalone, no sidebar */}
      <Route path="/" component={HomePage} />

      {/* All app routes share the sidebar layout */}
      <Route component={AppRoutes} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
