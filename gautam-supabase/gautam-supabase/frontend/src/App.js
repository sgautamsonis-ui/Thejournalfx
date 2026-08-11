import React, { lazy, Suspense } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { AccountProvider } from "@/context/AccountContext";
import { LightboxProvider } from "@/components/ImageLightbox";
import Login from "@/pages/Login";
import Layout from "@/components/Layout";
import { Loader2 } from "lucide-react";

// Keep the first JavaScript payload small. Reports, charts, AI screens and
// their dependencies now download only when a user opens that route.
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const AddTrade = lazy(() => import("@/pages/AddTrade"));
const TradeView = lazy(() => import("@/pages/TradeView"));
const BiasCenter = lazy(() => import("@/pages/BiasCenter"));
const Tracker = lazy(() => import("@/pages/Tracker"));
const Settings = lazy(() => import("@/pages/Settings"));
const Records = lazy(() => import("@/pages/Records"));
const Reports = lazy(() => import("@/pages/Reports"));
const Notebook = lazy(() => import("@/pages/Notebook"));

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <FullLoader/>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function FullLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center login-bg">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#7C3AED] mx-auto mb-3"/>
        <div className="font-display font-semibold">Preparing your workspace...</div>
      </div>
    </div>
  );
}

function AppRouter() {
  return (
    <Suspense fallback={<FullLoader/>}>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Protected><Layout/></Protected>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/add-trade" element={<AddTrade />} />
        <Route path="/trades" element={<TradeView />} />
        <Route path="/bias" element={<BiasCenter />} />
        <Route path="/tracker" element={<Tracker />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/records" element={<Records />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/notebook" element={<Notebook />} />
      </Route>
      <Route path="/" element={<Navigate to="/dashboard" replace/>} />
      <Route path="*" element={<Navigate to="/dashboard" replace/>} />
    </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AccountProvider>
        <LightboxProvider>
          <BrowserRouter>
            <AppRouter />
          </BrowserRouter>
        </LightboxProvider>
      </AccountProvider>
    </AuthProvider>
  );
}
