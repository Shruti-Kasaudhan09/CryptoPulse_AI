import { BrowserRouter, Link, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import Layout, { useCoin } from "./components/Layout";
import { EmptyState } from "./components/States";
import { AuthProvider } from "./lib/auth";
import Ask from "./pages/Ask";
import AuthPage from "./pages/AuthPage";
import Backtest from "./pages/Backtest";
import Dashboard from "./pages/Dashboard";
import Landing from "./pages/Landing";
import ModelArena from "./pages/ModelArena";
import Portfolio from "./pages/Portfolio";
import WhyPrediction from "./pages/WhyPrediction";

/** Guards every coin-specific page against ?coin=DOGE and similar. */
function WithCoin({ page: Page }) {
  const { coin, valid } = useCoin();
  if (!valid) {
    return (
      <EmptyState title={`"${coin}" isn't a supported cryptocurrency`}>
        CryptoPulse AI currently tracks Bitcoin (BTC), Ethereum (ETH) and Solana (SOL). Pick one above.
      </EmptyState>
    );
  }
  return <Page key={coin} coin={coin} />;
}

function NotFound() {
  return (
    <EmptyState title="Page not found">
      <Link to="/dashboard" className="text-accent hover:underline">Go to the dashboard</Link>
    </EmptyState>
  );
}

/** The app pages share the sidebar layout; landing + sign-in pages don't. */
function AppShell() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/signup" element={<AuthPage mode="signup" />} />
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<WithCoin page={Dashboard} />} />
            <Route path="/why" element={<WithCoin page={WhyPrediction} />} />
            <Route path="/ask" element={<WithCoin page={Ask} />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/arena" element={<ModelArena />} />
            <Route path="/backtest" element={<WithCoin page={Backtest} />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
