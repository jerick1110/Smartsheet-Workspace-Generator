import React, { useState, useEffect } from "react";
import { Cpu, Key, Database, Code, ShieldCheck, Terminal, HelpCircle, Activity, Globe, RefreshCw } from "lucide-react";
import { SmartsheetUser, Workspace } from "./types";
import { fetchSmartsheet } from "./lib/smartsheet";
import ConsoleTab from "./components/ConsoleTab";
import GeneratorTab from "./components/GeneratorTab";
import PythonTab from "./components/PythonTab";

export default function App() {
  const [activeTab, setActiveTab] = useState<"console" | "generator" | "python">("console");
  
  // Smartsheet Token and Authentication state
  const [token, setToken] = useState<string>(() => {
    return localStorage.getItem("smartsheet_token") || "";
  });
  const [isValidated, setIsValidated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<SmartsheetUser | null>(null);

  // Global Workspace lists
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState<boolean>(false);

  // Server Env Token state
  const [envConfig, setEnvConfig] = useState<{ hasEnvToken: boolean; fallbackTokenPreview: string | null }>({
    hasEnvToken: false,
    fallbackTokenPreview: null,
  });

  // Check backend preset environment Smartsheet Token on mount
  useEffect(() => {
    const fetchEnvConfig = async () => {
      try {
        const response = await fetch("/api/config");
        if (response.ok) {
          const data = await response.json();
          setEnvConfig(data);
          
          // If user hasn't inputted a token but we have an env token, load it as default!
          if (!token && data.hasEnvToken) {
            setToken("SMARTSHEET_ACCESS_TOKEN_PRESET_ENV");
            // Auto test connection
            autoValidateToken("SMARTSHEET_ACCESS_TOKEN_PRESET_ENV");
          }
        }
      } catch (e) {
        console.error("Could not fetch env config:", e);
      }
    };
    fetchEnvConfig();
  }, []);

  // Save/Clear token in localStorage
  useEffect(() => {
    if (token) {
      localStorage.setItem("smartsheet_token", token);
    } else {
      localStorage.removeItem("smartsheet_token");
    }
  }, [token]);

  const autoValidateToken = async (activeToken: string) => {
    try {
      const response = await fetchSmartsheet("/me", activeToken);
      if (response.ok) {
        const data = await response.json();
        setCurrentUser(data.user || data);
        setIsValidated(true);
        
        // Load initial workspaces roster
        const listResponse = await fetchSmartsheet("/workspaces", activeToken);
        if (listResponse.ok) {
          const listData = await listResponse.json();
          // Support both data.workspaces (Express backend) and data.data/data (raw Smartsheet API on Netlify)
          const wsList = listData.workspaces || listData.data || (Array.isArray(listData) ? listData : []);
          setWorkspaces(wsList);
        }
      }
    } catch (err) {
      console.error("Auto handshake validation failed:", err);
    }
  };

  const handleManualRefreshWorkspaces = async () => {
    if (!token) return;
    setIsLoadingWorkspaces(true);
    try {
      const response = await fetchSmartsheet("/workspaces", token);
      const data = await response.json();
      if (response.ok) {
        const wsList = data.workspaces || data.data || (Array.isArray(data) ? data : []);
        setWorkspaces(wsList);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingWorkspaces(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-950 selection:text-emerald-300">
      {/* Upper system header bar */}
      <header className="bg-slate-900/60 border-b border-slate-800/80 sticky top-0 z-20 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-950/80 border border-emerald-800/65 rounded-lg text-emerald-400">
              <Cpu className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-mono tracking-widest text-emerald-500 font-bold block leading-none">
                Smartsheet Automation Studio
              </span>
              <h1 className="text-base font-bold text-slate-200 tracking-tight mt-0.5">
                Workspace Generator
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Environment Status Flag */}
            {envConfig.hasEnvToken ? (
              <div 
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-900/40 text-[11px] font-mono text-emerald-400"
                title={`Preset Environment Token configured dynamically: ${envConfig.fallbackTokenPreview}`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Preset Secret Active</span>
              </div>
            ) : (
              <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-500">
                <span>Direct Credentials Input</span>
              </div>
            )}

            <div className="flex items-center gap-1 bg-slate-950 border border-slate-850 p-1 rounded-lg">
              <button
                onClick={() => setActiveTab("console")}
                className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  activeTab === "console"
                    ? "bg-slate-900 text-emerald-400 border border-slate-800"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Key className="w-3.5 h-3.5" />
                Credentials
              </button>
              <button
                onClick={() => setActiveTab("generator")}
                className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  activeTab === "generator"
                    ? "bg-slate-900 text-emerald-400 border border-slate-800"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                Generator
              </button>
              <button
                onClick={() => setActiveTab("python")}
                className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  activeTab === "python"
                    ? "bg-slate-900 text-emerald-400 border border-slate-800"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                Python SDK
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container section */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">
            {activeTab === "console" && "Authentication & Roster Hub"}
            {activeTab === "generator" && "Automated Operations Workshop"}
            {activeTab === "python" && "Deployment & Python Automations"}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {activeTab === "console" && "Verify credential status, test server Handshakes, and survey available workspaces."}
            {activeTab === "generator" && "Initiate high-speed workspace creations individually or in sequentially structured batches."}
            {activeTab === "python" && "Review, customize, and download the fully optimized Python Smartsheet SDK execution script."}
          </p>
        </div>

        {/* Tab Router Switch */}
        <div className="transition-all duration-300">
          {activeTab === "console" && (
            <ConsoleTab
              token={token}
              setToken={setToken}
              isValidated={isValidated}
              setIsValidated={setIsValidated}
              currentUser={currentUser}
              setCurrentUser={setCurrentUser}
              workspaces={workspaces}
              setWorkspaces={setWorkspaces}
              isLoadingWorkspaces={isLoadingWorkspaces}
              setIsLoadingWorkspaces={setIsLoadingWorkspaces}
            />
          )}

          {activeTab === "generator" && (
            <GeneratorTab
              token={token}
              isValidated={isValidated}
              onRefreshWorkspaces={handleManualRefreshWorkspaces}
            />
          )}

          {activeTab === "python" && <PythonTab />}
        </div>
      </main>

      {/* Footer bar */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 font-mono text-[10px] text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isValidated ? "bg-emerald-500" : "bg-amber-500"}`} />
              Smartsheet Connection: {isValidated ? `CONNECTED (${currentUser?.email})` : "AWAITING CREDENTIALS"}
            </span>
            <span className="hidden sm:inline-block">|</span>
            <span>API Version: v2.0 REST</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Globe className="w-3.5 h-3.5" />
              Node TLS Proxy
            </span>
            <span>Local Time: 19:00 UTC</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
