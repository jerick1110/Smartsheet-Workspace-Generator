import React, { useState } from "react";
import { Key, CheckCircle, AlertTriangle, RefreshCw, LogIn, ExternalLink, Search, Trash2, Eye, EyeOff, ShieldCheck, Database, Users, FileSpreadsheet, Crown, ChevronDown, ChevronRight, Download, UserCheck } from "lucide-react";
import { SmartsheetUser, Workspace } from "../types";

interface ConsoleTabProps {
  token: string;
  setToken: (token: string) => void;
  isValidated: boolean;
  setIsValidated: (val: boolean) => void;
  currentUser: SmartsheetUser | null;
  setCurrentUser: (user: SmartsheetUser | null) => void;
  workspaces: Workspace[];
  setWorkspaces: React.Dispatch<React.SetStateAction<Workspace[]>>;
  isLoadingWorkspaces: boolean;
  setIsLoadingWorkspaces: (val: boolean) => void;
}

export default function ConsoleTab({
  token,
  setToken,
  isValidated,
  setIsValidated,
  currentUser,
  setCurrentUser,
  workspaces,
  setWorkspaces,
  isLoadingWorkspaces,
  setIsLoadingWorkspaces,
}: ConsoleTabProps) {
  const [showToken, setShowToken] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Record<number, boolean>>({});
  const [isBulkScanning, setIsBulkScanning] = useState(false);
  const [bulkScanProgress, setBulkScanProgress] = useState(0);

  // Helper utility executing Smartsheet API calls through Dev Server proxy OR direct client-side fallback (for Netlify Static hosting with no server)
  const fetchSmartsheet = async (path: string, activeToken?: string, options: { method?: string; body?: any } = {}) => {
    const finalToken = activeToken || token;
    const method = options.method || "GET";
    const proxyUrl = path.startsWith("/api") ? path : `/api/smartsheet/${path.replace(/^\//, "")}`;

    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 6000); // Fail fast to try direct connection

      const response = await fetch(proxyUrl, {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-smartsheet-token": finalToken,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal
      });

      clearTimeout(id);

      // If Express/Cloud Run proxy returns 404/502/504 (Netlify deployment with no server)
      if (response.status === 404 || response.status === 502 || response.status === 504) {
        throw new Error("PROXY_NOT_FOUND");
      }

      return response;
    } catch (err: any) {
      console.warn("Express proxy unavailable, falling back to direct client-side Smartsheet API request: ", err.message || err);

      let directUrl = "";
      if (path.includes("me")) {
        directUrl = "https://api.smartsheet.com/2.0/users/me";
      } else if (path.includes("workspaces") && path.includes("shares")) {
        const match = path.match(/workspaces\/(\d+)\/shares/);
        const wsId = match ? match[1] : "";
        directUrl = `https://api.smartsheet.com/2.0/workspaces/${wsId}/shares?includeAll=true`;
      } else if (path.includes("workspaces")) {
        directUrl = "https://api.smartsheet.com/2.0/workspaces?includeAll=true";
      } else {
        const cleanPath = path.replace(/^\/api\/smartsheet\/?/, "").replace(/^\//, "");
        directUrl = `https://api.smartsheet.com/2.0/${cleanPath}`;
      }

      return fetch(directUrl, {
        method,
        headers: {
          "Authorization": `Bearer ${finalToken}`,
          "Accept": "application/json",
          "Content-Type": "application/json"
        },
        body: options.body ? JSON.stringify(options.body) : undefined
      });
    }
  };

  // Load Shares for a single workspace
  const loadWorkspaceShares = async (workspaceId: number, overrideToken?: string) => {
    const activeToken = overrideToken || token;
    if (!activeToken) return;

    // Set loading state
    setWorkspaces(prev => prev.map(ws => ws.id === workspaceId ? { ...ws, isLoadingShares: true } : ws));

    try {
      const response = await fetchSmartsheet(`/workspaces/${workspaceId}/shares`, activeToken);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to list workspace shares.");
      }

      setWorkspaces(prev => prev.map(ws => 
        ws.id === workspaceId 
          ? { ...ws, shares: data.shares || [], isLoadingShares: false } 
          : ws
      ));
    } catch (err: any) {
      console.error(`Failed to load shares for workspace ${workspaceId}:`, err);
      setWorkspaces(prev => prev.map(ws => 
        ws.id === workspaceId 
          ? { ...ws, isLoadingShares: false } 
          : ws
      ));
    }
  };

  // Toggle dropdown row and load shares
  const toggleWorkspaceExpand = (workspaceId: number) => {
    const isNowExpanded = !expandedWorkspaces[workspaceId];
    setExpandedWorkspaces(prev => ({ ...prev, [workspaceId]: isNowExpanded }));

    if (isNowExpanded) {
      const workspace = workspaces.find(w => w.id === workspaceId);
      if (workspace && !workspace.shares) {
        loadWorkspaceShares(workspaceId);
      }
    }
  };

  // Iteratively scan shares for all workspaces
  const scanAllShares = async () => {
    if (workspaces.length === 0) return;
    setIsBulkScanning(true);
    setBulkScanProgress(0);

    for (let i = 0; i < workspaces.length; i++) {
      const ws = workspaces[i];
      await loadWorkspaceShares(ws.id);
      // Automatically expand rows that are loaded
      setExpandedWorkspaces(prev => ({ ...prev, [ws.id]: true }));
      setBulkScanProgress(Math.round(((i + 1) / workspaces.length) * 100));
      // Buffer limit to honor speed
      await new Promise(r => setTimeout(r, 100));
    }

    setIsBulkScanning(false);
  };

  const handleExportWorkspaceSpreadsheet = () => {
    let csvContent = "\ufeff"; // UTF-8 byte order mark (BOM) to support excel symbols and characters
    csvContent += "Workspace Name,Workspace ID,My Access Level,Permalink,Member Name,Member Email,Member Type,Member Role,Is Owner\n";

    workspaces.forEach((ws) => {
      const pLink = ws.permalink || "";
      const wsAccess = ws.accessLevel || "OWNER";
      
      if (ws.shares && ws.shares.length > 0) {
        ws.shares.forEach((share) => {
          const isOwnerStr = (share.accessLevel === "OWNER" || wsAccess === "OWNER" && share.email === currentUser?.email) ? "YES" : "NO";
          const row = [
            `"${ws.name.replace(/"/g, '""')}"`,
            ws.id,
            wsAccess,
            `"${pLink.replace(/"/g, '""')}"`,
            `"${(share.name || "").replace(/"/g, '""')}"`,
            `"${(share.email || "").replace(/"/g, '""')}"`,
            share.type || "USER",
            share.accessLevel,
            isOwnerStr
          ];
          csvContent += row.join(",") + "\n";
        });
      } else {
        // Fallback row representing the workspace itself since shares haven't been loaded yet
        const row = [
          `"${ws.name.replace(/"/g, '""')}"`,
          ws.id,
          wsAccess,
          `"${pLink.replace(/"/g, '""')}"`,
          `"${currentUser?.name || "Workspace Owner (Me)"}"`,
          `"${currentUser?.email || ""}"`,
          "USER",
          wsAccess,
          "YES"
        ];
        csvContent += row.join(",") + "\n";
      }
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `smartsheet_workspace_directory_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const testConnection = async (explicitToken?: string) => {
    const activeToken = explicitToken !== undefined ? explicitToken : token;
    
    if (!activeToken.trim()) {
      setValidationError("Please enter or paste your Smartsheet API Access Token.");
      setIsValidated(false);
      return;
    }

    setIsTesting(true);
    setValidationError(null);
    try {
      // 1. Validate connection via fetchSmartsheet fallback helper
      const response = await fetchSmartsheet("/me", activeToken);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to validate Smartsheet Token.");
      }

      setCurrentUser(data.user || data);
      setIsValidated(true);

      // 2. Fetch initial workspaces
      await loadWorkspaces(activeToken);
    } catch (err: any) {
      console.error(err);
      setValidationError(err.message || "Could not establish connection to Smartsheet API.");
      setIsValidated(false);
      setCurrentUser(null);
    } finally {
      setIsTesting(false);
    }
  };

  const loadWorkspaces = async (activeToken: string) => {
    setIsLoadingWorkspaces(true);
    try {
      const response = await fetchSmartsheet("/workspaces", activeToken);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to list workspaces.");
      }
      
      const fetchedWorkspaces = data.workspaces || [];
      setWorkspaces(fetchedWorkspaces);

      // Automatically preconfirm expand workspace sub-rows and initiate parallel background fetch of direct member roster
      if (fetchedWorkspaces.length > 0) {
        const initialExpanded: Record<number, boolean> = {};
        fetchedWorkspaces.forEach((ws: Workspace) => {
          initialExpanded[ws.id] = true;
        });
        setExpandedWorkspaces(initialExpanded);

        // Fetch shares immediately in background
        fetchedWorkspaces.forEach((ws: Workspace) => {
          loadWorkspaceShares(ws.id, activeToken);
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingWorkspaces(false);
    }
  };

  const handleClear = () => {
    setToken("");
    setIsValidated(false);
    setCurrentUser(null);
    setWorkspaces([]);
    setValidationError(null);
  };

  const filteredWorkspaces = workspaces.filter((ws) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;

    // 1. Check workspace name
    if (ws.name.toLowerCase().includes(query)) return true;

    // 2. Check workspace ID
    if (ws.id.toString().includes(query)) return true;

    // 3. Check access level
    if (ws.accessLevel && ws.accessLevel.toLowerCase().includes(query)) return true;

    // 4. Check shared members (roster)
    if (ws.shares && ws.shares.length > 0) {
      const matchesShare = ws.shares.some((share) => {
        const shareName = (share.name || "").toLowerCase();
        const shareEmail = (share.email || "").toLowerCase();
        const shareAccess = (share.accessLevel || "").toLowerCase();
        const shareType = (share.type || "").toLowerCase();
        return (
          shareName.includes(query) ||
          shareEmail.includes(query) ||
          shareAccess.includes(query) ||
          shareType.includes(query)
        );
      });
      if (matchesShare) return true;
    }

    // 5. Fallback owner checks when shares are not loaded yet or matches current authenticated identity
    if (currentUser) {
      const isOwner = ws.accessLevel === "OWNER";
      const myEmail = (currentUser.email || "").toLowerCase();
      const myName = (currentUser.name || "").toLowerCase();
      
      const matchMe = (isOwner && "owner".includes(query)) ||
        "me".includes(query) ||
        myEmail.includes(query) ||
        myName.includes(query);
        
      if (matchMe) return true;
    }

    return false;
  });

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mb-4 h-5 flex items-center gap-2">
          <Key className="w-4 h-4 text-emerald-400" />
          Smartsheet Token Authentication
        </h3>
        
        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
          Provide your Smartsheet personal access token to securely orchestrate requests. The token is never logged nor stored on the server—it operates entirely over stateless proxy headers.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-2">
              API Access Token
            </label>
            <div className="relative flex rounded-lg">
              <input
                id="token-input"
                type={showToken ? "text" : "password"}
                value={token}
                onChange={(e) => {
                  setToken(e.target.value);
                  if (isValidated) setIsValidated(false); // Reset validation flag when token changes
                }}
                placeholder="Enter Smartsheet Personal Access Token (e.g., v8x7vdy...)"
                className="w-full pl-3 pr-24 py-3 bg-slate-950/80 border border-slate-800 rounded-lg text-slate-100 font-mono text-xs focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all placeholder:text-slate-600 outline-none"
              />
              <div className="absolute right-2 top-2.5 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="p-1 text-slate-400 hover:text-slate-200 rounded transition"
                  title={showToken ? "Mask Token" : "Reveal Token"}
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                {token && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="p-1 text-red-400 hover:text-red-300 rounded transition"
                    title="Clear Token"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              id="validate-token-btn"
              onClick={() => testConnection()}
              disabled={isTesting || !token.trim()}
              className={`px-4 py-2.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-all ${
                isTesting
                  ? "bg-slate-800 text-slate-400 cursor-not-allowed"
                  : !token.trim()
                  ? "bg-slate-900 text-slate-600 cursor-not-allowed border border-slate-800"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer hover:shadow-lg hover:shadow-emerald-950/20"
              }`}
            >
              {isTesting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Checking credentials...
                </>
              ) : (
                <>
                  <LogIn className="w-3.5 h-3.5" />
                  Test & Validate Connection
                </>
              )}
            </button>

            {isValidated && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-950/50 border border-emerald-900/50 text-emerald-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                Valid credentials in use
              </span>
            )}
          </div>

          {validationError && (
            <div className="mt-4 p-4 rounded-lg bg-red-950/30 border border-red-900/40 text-red-300 text-xs flex items-start gap-2 max-w-2xl font-mono leading-relaxed">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-200 mb-0.5">Authentication Failure</p>
                <p>{validationError}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {isValidated && currentUser && (
        <div className="space-y-6">
          {/* Identity & Global Batch Scan Controls Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Identity Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                Connected Identity Status
              </h4>
              <div className="space-y-3 font-mono text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">User Name</span>
                  <span className="text-sm font-medium text-slate-200">{currentUser.name || `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim() || "N/A"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Email Address</span>
                  <span className="text-sm font-medium text-slate-200 break-all">{currentUser.email || "N/A"}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">Timezone</span>
                    <span className="text-xs text-slate-300">{currentUser.timezone || "Default"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">User ID</span>
                    <span className="text-xs text-slate-300">{currentUser.id}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Operations / Spreadsheets Exporters Banner */}
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  Consolidated Access Directory Generator
                </h4>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Export your entire Smartsheet workplace roster to a clean, professionally formatted spreadsheet including all verified members, permissions, specific roles, type classifications, and permanent link mappings.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                {/* Bulk Scanner button */}
                <button
                  onClick={scanAllShares}
                  disabled={isBulkScanning || workspaces.length === 0}
                  className={`px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    isBulkScanning
                      ? "bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed"
                      : "bg-slate-950 hover:bg-slate-900 border border-slate-880 text-slate-200"
                  }`}
                >
                  {isBulkScanning ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                      <span>Scanning shares ({bulkScanProgress}%)</span>
                    </>
                  ) : (
                    <>
                      <Users className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Scan All Members / Roles</span>
                    </>
                  )}
                </button>

                {/* Exporter button */}
                <button
                  onClick={handleExportWorkspaceSpreadsheet}
                  disabled={workspaces.length === 0}
                  className={`px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer border border-emerald-700 hover:shadow ${
                    workspaces.length === 0
                      ? "bg-emerald-950/40 text-slate-600 border-none cursor-not-allowed"
                      : "bg-emerald-600 text-white hover:bg-emerald-500"
                  }`}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export to Spreadsheet (CSV)</span>
                </button>
              </div>
            </div>
          </div>

          {/* MASTER MASTER WORKSPACE ADMINISTRATION GRID - Wide GUI Visualizer */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Database className="w-4.5 h-4.5 text-emerald-400" />
                  Workspace Roster & Interactive Permissions Database
                </h3>
                <p className="text-xs text-slate-400">
                  Total of <strong className="text-emerald-400">{workspaces.length}</strong> active workspaces connected. Click rows to inspect or load detailed access shares.
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* Refresh Catalog button */}
                <button
                  onClick={() => loadWorkspaces(token)}
                  disabled={isLoadingWorkspaces}
                  className="px-3 py-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-850 rounded-lg text-xs font-semibold text-slate-300 flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                  title="Resynchronize master workspaces list"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingWorkspaces ? "animate-spin text-emerald-500" : ""}`} />
                  Sync Workspaces
                </button>
              </div>
            </div>

            {/* Global Search and Filter bar */}
            <div className="relative">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-600" />
              <input
                type="text"
                placeholder="Query workspace names, Smartsheet IDs, or specific user attributes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 font-mono transition"
              />
            </div>

            {/* Immersive Wide Table Container */}
            <div className="overflow-x-auto border border-slate-850 rounded-lg bg-slate-950/40 custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[850px]">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-850 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3.5 px-4 w-12 text-center" />
                    <th className="py-3.5 px-4">Workspace Details</th>
                    <th className="py-3.5 px-4 w-44 font-mono">Smartsheet ID</th>
                    <th className="py-3.5 px-4 w-40">My Access Level</th>
                    <th className="py-3.5 px-4">Access Roster Status</th>
                    <th className="py-3.5 px-6 text-right w-48">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/60">
                  {isLoadingWorkspaces ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
                          <span className="text-xs font-mono">Retrieving workspace directory from Smartsheet...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredWorkspaces.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-600">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Database className="w-8 h-8 opacity-20" />
                          <span className="text-xs">No workspaces match your query filter.</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredWorkspaces.map((ws) => {
                      const isExpanded = !!expandedWorkspaces[ws.id];
                      const memberCount = ws.shares ? ws.shares.length : null;
                      
                      return (
                        <React.Fragment key={ws.id}>
                          {/* Main Row */}
                          <tr className={`hover:bg-slate-900/40 transition-colors ${isExpanded ? "bg-slate-900/10" : ""}`}>
                            <td className="py-4 px-4 text-center">
                              <button
                                onClick={() => toggleWorkspaceExpand(ws.id)}
                                className="p-1 text-slate-500 hover:text-emerald-400 hover:bg-slate-900 rounded transition cursor-pointer"
                                title={isExpanded ? "Collapse Members List" : "Expand Members List"}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-emerald-400" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                              </button>
                            </td>

                            <td className="py-4 px-4">
                              <div className="space-y-0.5">
                                <span className="text-xs font-semibold text-slate-200 leading-normal block">{ws.name}</span>
                                {ws.permalink && (
                                  <span className="text-[10px] text-slate-500 truncate block max-w-sm">{ws.permalink}</span>
                                )}
                              </div>
                            </td>

                            <td className="py-4 px-4 font-mono text-xs text-slate-400">
                              {ws.id}
                            </td>

                            <td className="py-4 px-4">
                              <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase font-mono px-2 py-0.5 rounded border ${
                                ws.accessLevel === "OWNER"
                                  ? "text-amber-400 bg-amber-950/20 border-amber-900/40"
                                  : "text-emerald-400 bg-emerald-950/20 border-emerald-900/45"
                              }`}>
                                <Crown className="w-2.5 h-2.5" />
                                {ws.accessLevel || "OWNER"}
                              </span>
                            </td>

                            <td className="py-4 px-4 text-xs">
                              {ws.isLoadingShares ? (
                                <span className="text-emerald-400 font-mono text-[11px] flex items-center gap-1.5">
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin nav-spin" />
                                  Loading roster...
                                </span>
                              ) : memberCount !== null ? (
                                <span className="text-slate-300 font-mono text-[11px] flex items-center gap-1.5">
                                  <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                                  {memberCount} direct {memberCount === 1 ? "member" : "members"} verified
                                </span>
                              ) : (
                                <span className="text-slate-500 italic text-[11px]">
                                  Roster not scanned yet
                                </span>
                              )}
                            </td>

                            <td className="py-4 px-6 text-right">
                              <div className="flex items-center justify-end gap-2.5">
                                <button
                                  onClick={() => toggleWorkspaceExpand(ws.id)}
                                  className="px-2.5 py-1 bg-slate-950 hover:bg-slate-900 border border-slate-850 rounded text-[10px] font-mono font-medium text-slate-200 transition cursor-pointer"
                                >
                                  {isExpanded ? "Hide Members" : "Show Members"}
                                </button>
                                {ws.permalink && (
                                  <a
                                    href={ws.permalink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-900 border border-slate-850 rounded transition"
                                    title="Open directly in Smartsheet workspace UI"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* Expanded detail panel row with Slide transitions */}
                          {isExpanded && (
                            <tr className="bg-slate-950/70">
                              <td colSpan={6} className="py-4 px-4 sm:px-8">
                                <div className="border border-slate-850/80 rounded-lg p-4 bg-slate-950 space-y-3 shadow-inner">
                                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-900 pb-2">
                                    <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                      <Users className="w-3.5 h-3.5 text-emerald-400" />
                                      Verified Shared Members Directory
                                    </h5>
                                    
                                    <button
                                      onClick={() => loadWorkspaceShares(ws.id)}
                                      disabled={ws.isLoadingShares}
                                      className="text-[10px] font-mono text-emerald-400 hover:text-emerald-300 transition flex items-center gap-1 disabled:opacity-55 cursor-pointer"
                                    >
                                      <RefreshCw className={`w-3 h-3 ${ws.isLoadingShares ? "animate-spin" : ""}`} />
                                      Sync Directory
                                    </button>
                                  </div>

                                  {ws.isLoadingShares ? (
                                    <div className="py-6 flex flex-col items-center justify-center gap-2 text-slate-500 text-xs">
                                      <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                                      <span className="font-mono">Contacting Smartsheet for shares list...</span>
                                    </div>
                                  ) : ws.shares && ws.shares.length > 0 ? (
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-left border-collapse">
                                        <thead>
                                          <tr className="border-b border-slate-900 text-[9px] uppercase tracking-wider font-bold text-slate-600">
                                            <th className="py-2">Scope Target Name</th>
                                            <th className="py-2">Email Address</th>
                                            <th className="py-2 w-28">Type</th>
                                            <th className="py-2">Access Level / Permission Role</th>
                                            <th className="py-2 text-right w-24">Ownership</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-900/40">
                                          {ws.shares.map((share) => {
                                            const isOwner = share.accessLevel === "OWNER" || ws.accessLevel === "OWNER" && share.email === currentUser?.email;
                                            
                                            return (
                                              <tr key={share.id} className="text-[11px] hover:bg-slate-900/20 text-slate-300">
                                                <td className="py-2.5 font-medium text-slate-200">{share.name || "N/A"}</td>
                                                <td className="py-2.5 font-mono text-slate-400 break-all">{share.email || "Group / Shared Object"}</td>
                                                <td className="py-2.5 font-mono text-[9px]">
                                                  <span className="text-slate-500 border border-slate-850 bg-slate-900 px-1 py-0.5 rounded">
                                                    {share.type || "USER"}
                                                  </span>
                                                </td>
                                                <td className="py-2.5 font-mono">
                                                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold border ${
                                                    share.accessLevel === "OWNER"
                                                      ? "text-amber-400 bg-amber-950/20 border-amber-900/40"
                                                      : share.accessLevel === "ADMIN"
                                                      ? "text-red-400 bg-red-950/20 border-red-900/40"
                                                      : share.accessLevel.startsWith("EDITOR")
                                                      ? "text-emerald-400 bg-emerald-950/20 border-emerald-930/40"
                                                      : "text-sky-400 bg-sky-950/20 border-sky-930/40"
                                                  }`}>
                                                    {share.accessLevel === "OWNER" && <Crown className="w-2.5 h-2.5" />}
                                                    {share.accessLevel}
                                                  </span>
                                                </td>
                                                <td className="py-2.5 text-right">
                                                  {isOwner ? (
                                                    <span className="text-amber-400 text-[10px] font-extrabold flex items-center justify-end gap-1 font-mono">
                                                      <Crown className="w-3 h-3 fill-current" />
                                                      Owner
                                                    </span>
                                                  ) : (
                                                    <span className="text-slate-500 font-mono">Contributor</span>
                                                  )}
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  ) : (
                                    <div className="py-6 text-center text-slate-600 text-xs border border-dashed border-slate-900/80 rounded-lg">
                                      No shared members found on this workspace. Members you share folders or sheets with will be rendered here.
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
