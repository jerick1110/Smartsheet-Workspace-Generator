import React, { useState } from "react";
import { Key, CheckCircle, AlertTriangle, RefreshCw, LogIn, ExternalLink, Search, Trash2, Eye, EyeOff, ShieldCheck, Database, Users, FileSpreadsheet, Crown, ChevronDown, ChevronRight, Download, UserCheck, UserPlus, Edit2, Trash, Save, X, Folder, FileText, Layout, Info } from "lucide-react";
import { SmartsheetUser, Workspace } from "../types";
import { fetchSmartsheet } from "../lib/smartsheet";

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
  const [exportLayout, setExportLayout] = useState<"row_per_member" | "grouped_semicolon" | "grouped_newline">("row_per_member");

  // Advanced sub-tabs and management state for interactive features
  const [activeSubTabs, setActiveSubTabs] = useState<Record<number, "shares" | "assets">>({});
  const [addMemberEmail, setAddMemberEmail] = useState<Record<number, string>>({});
  const [addMemberRole, setAddMemberRole] = useState<Record<number, string>>({});
  const [isAddingMember, setIsAddingMember] = useState<Record<number, boolean>>({});
  const [addMemberError, setAddMemberError] = useState<Record<number, string | null>>({});

  // Custom share state trackers for editing inline
  const [editingShareId, setEditingShareId] = useState<Record<number, string | null>>({});
  const [editingShareRole, setEditingShareRole] = useState<Record<number, string>>({});
  const [shareLoadingStates, setShareLoadingStates] = useState<Record<string, "updating" | "deleting" | null>>({});

  // Custom inline deletion confirmation tracker
  const [confirmingDeleteShareId, setConfirmingDeleteShareId] = useState<Record<number, string | null>>({});

  // Wrapper around central fetchSmartsheet utility that automatically binds the active or fallback token
  const callSmartsheet = async (path: string, activeToken?: string, options: { method?: string; body?: any } = {}) => {
    return fetchSmartsheet(path, activeToken || token, options);
  };

  // Load Shares for a single workspace
  const loadWorkspaceShares = async (workspaceId: number, overrideToken?: string) => {
    const activeToken = overrideToken || token;
    if (!activeToken) return;

    // Set loading state
    setWorkspaces(prev => prev.map(ws => ws.id === workspaceId ? { ...ws, isLoadingShares: true } : ws));

    try {
      const response = await callSmartsheet(`/workspaces/${workspaceId}/shares`, activeToken);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || data.message || "Failed to list workspace shares.");
      }

      // Supports both data.shares (Express proxy) and data.data/data (direct Smartsheet API on Netlify)
      const sharesList = data.shares || data.data || (Array.isArray(data) ? data : []);

      setWorkspaces(prev => prev.map(ws => 
        ws.id === workspaceId 
          ? { ...ws, shares: sharesList, isLoadingShares: false } 
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

  // Actions error message tracking
  const [workspaceActionError, setWorkspaceActionError] = useState<Record<number, string | null>>({});

  // Fetch details (Sheets, Folders, Reports, Templates) for a single workspace
  const loadWorkspaceAssets = async (workspaceId: number, overrideToken?: string) => {
    const activeToken = overrideToken || token;
    if (!activeToken) return;

    setWorkspaces(prev => prev.map(ws => ws.id === workspaceId ? { ...ws, isLoadingAssets: true } : ws));
    setWorkspaceActionError(prev => ({ ...prev, [workspaceId]: null }));

    try {
      const response = await callSmartsheet(`/workspaces/${workspaceId}`, activeToken);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || data.message || "Failed to load workspace assets.");
      }

      const workspaceDetails = data.workspace || data;
      
      setWorkspaces(prev => prev.map(ws => 
        ws.id === workspaceId 
          ? { 
              ...ws, 
              assets: {
                sheets: workspaceDetails.sheets || [],
                folders: workspaceDetails.folders || [],
                reports: workspaceDetails.reports || [],
                templates: workspaceDetails.templates || [],
              },
              isLoadingAssets: false 
            } 
          : ws
      ));
    } catch (err: any) {
      console.error(`Failed to load assets for workspace ${workspaceId}:`, err);
      setWorkspaceActionError(prev => ({ ...prev, [workspaceId]: err.message || "Could not load workspace assets." }));
      setWorkspaces(prev => prev.map(ws => 
        ws.id === workspaceId 
          ? { ...ws, isLoadingAssets: false } 
          : ws
      ));
    }
  };

  const handleAddShare = async (workspaceId: number) => {
    const email = addMemberEmail[workspaceId]?.trim();
    const role = addMemberRole[workspaceId] || "EDITOR";
    
    if (!email) {
      setAddMemberError(prev => ({ ...prev, [workspaceId]: "Email address is required." }));
      return;
    }

    setAddMemberError(prev => ({ ...prev, [workspaceId]: null }));
    setIsAddingMember(prev => ({ ...prev, [workspaceId]: true }));
    setWorkspaceActionError(prev => ({ ...prev, [workspaceId]: null }));

    try {
      const response = await callSmartsheet(`/workspaces/${workspaceId}/shares`, token, {
        method: "POST",
        body: [
          {
            email,
            accessLevel: role
          }
        ]
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || data.message || "Failed to add member share.");
      }

      // Reset form on success
      setAddMemberEmail(prev => ({ ...prev, [workspaceId]: "" }));
      setAddMemberRole(prev => ({ ...prev, [workspaceId]: "EDITOR" }));
      
      // Reload shares directory to show the newly added member
      await loadWorkspaceShares(workspaceId);
    } catch (err: any) {
      console.error(err);
      setAddMemberError(prev => ({ ...prev, [workspaceId]: err.message || "Failed to share workspace." }));
    } finally {
      setIsAddingMember(prev => ({ ...prev, [workspaceId]: false }));
    }
  };

  const handleUpdateShare = async (workspaceId: number, shareId: string, newRole: string) => {
    setShareLoadingStates(prev => ({ ...prev, [shareId]: "updating" }));
    setWorkspaceActionError(prev => ({ ...prev, [workspaceId]: null }));
    try {
      const response = await callSmartsheet(`/workspaces/${workspaceId}/shares/${shareId}`, token, {
        method: "PUT",
        body: {
          accessLevel: newRole
        }
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || data.message || "Failed to update member share role.");
      }

      // Exit editing mode
      setEditingShareId(prev => ({ ...prev, [workspaceId]: null }));
      
      // Reload shares directory
      await loadWorkspaceShares(workspaceId);
    } catch (err: any) {
      console.error(err);
      setWorkspaceActionError(prev => ({ ...prev, [workspaceId]: err.message || "Error updating share permissions." }));
    } finally {
      setShareLoadingStates(prev => ({ ...prev, [shareId]: null }));
    }
  };

  const handleDeleteShare = async (workspaceId: number, shareId: string) => {
    setShareLoadingStates(prev => ({ ...prev, [shareId]: "deleting" }));
    setWorkspaceActionError(prev => ({ ...prev, [workspaceId]: null }));
    try {
      const response = await callSmartsheet(`/workspaces/${workspaceId}/shares/${shareId}`, token, {
        method: "DELETE"
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || data.message || "Failed to remove member share.");
      }

      // Clear deletion confirmation state
      setConfirmingDeleteShareId(prev => ({ ...prev, [workspaceId]: null }));

      // Reload shares directory
      await loadWorkspaceShares(workspaceId);
    } catch (err: any) {
      console.error(err);
      setWorkspaceActionError(prev => ({ ...prev, [workspaceId]: err.message || "Error revoking permissions." }));
    } finally {
      setShareLoadingStates(prev => ({ ...prev, [shareId]: null }));
    }
  };

  const handleSwitchSubTab = (workspaceId: number, tab: "shares" | "assets") => {
    setActiveSubTabs(prev => ({ ...prev, [workspaceId]: tab }));
    if (tab === "assets") {
      const ws = workspaces.find(w => w.id === workspaceId);
      if (ws && !ws.assets) {
        loadWorkspaceAssets(workspaceId);
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
    csvContent += "workspaceName,owner,members,permissions\n";

    workspaces.forEach((ws) => {
      let ownerEmail = "";
      const ownerShare = ws.shares?.find(
        (s) => s.accessLevel === "OWNER" || s.accessLevel?.toUpperCase() === "OWNER"
      );
      
      if (ownerShare && ownerShare.email) {
        ownerEmail = ownerShare.email;
      } else if (ws.accessLevel === "OWNER" || ws.accessLevel?.toUpperCase() === "OWNER") {
        ownerEmail = currentUser?.email || "";
      } else {
        ownerEmail = "";
      }

      // Filter other shares to show in members column (excluding the owner's own record to avoid duplication)
      const otherShares = (ws.shares || []).filter(
        (share) =>
          share.accessLevel !== "OWNER" &&
          share.accessLevel?.toUpperCase() !== "OWNER" &&
          (share.email || "").toLowerCase() !== ownerEmail.toLowerCase()
      );

      const nameVal = `"${ws.name.replace(/"/g, '""')}"`;
      const ownerVal = `"${ownerEmail.replace(/"/g, '""')}"`;

      if (exportLayout === "row_per_member") {
        if (otherShares.length > 0) {
          otherShares.forEach((share) => {
            const memberEmail = share.email || share.name || "";
            const memberEmailVal = `"${memberEmail.replace(/"/g, '""')}"`;
            const permissionVal = `"${(share.accessLevel || "").replace(/"/g, '""')}"`;
            const row = [nameVal, ownerVal, memberEmailVal, permissionVal];
            csvContent += row.join(",") + "\n";
          });
        } else {
          const row = [nameVal, ownerVal, '""', '""'];
          csvContent += row.join(",") + "\n";
        }
      } else if (exportLayout === "grouped_semicolon") {
        let memberEmails: string[] = [];
        let memberPermissions: string[] = [];

        otherShares.forEach((share) => {
          const emailOrName = share.email || share.name || "";
          memberEmails.push(emailOrName);
          memberPermissions.push(share.accessLevel || "");
        });

        const memberEmailVal = `"${memberEmails.join("; ").replace(/"/g, '""')}"`;
        const permissionVal = `"${memberPermissions.join("; ").replace(/"/g, '""')}"`;

        const row = [nameVal, ownerVal, memberEmailVal, permissionVal];
        csvContent += row.join(",") + "\n";
      } else {
        // grouped_newline
        let memberEmails: string[] = [];
        let memberPermissions: string[] = [];

        otherShares.forEach((share) => {
          const emailOrName = share.email || share.name || "";
          memberEmails.push(emailOrName);
          memberPermissions.push(share.accessLevel || "");
        });

        const memberEmailVal = `"${memberEmails.join("\n").replace(/"/g, '""')}"`;
        const permissionVal = `"${memberPermissions.join("\n").replace(/"/g, '""')}"`;

        const row = [nameVal, ownerVal, memberEmailVal, permissionVal];
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
      // 1. Validate connection via unified helper
      const response = await callSmartsheet("/me", activeToken);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || "Failed to validate Smartsheet Token.");
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
      const response = await callSmartsheet("/workspaces", activeToken);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || data.message || "Failed to list workspaces.");
      }
      
      // Support both data.workspaces (Express proxy) and data.data/data (direct Smartsheet API on Netlify)
      const fetchedWorkspaces = data.workspaces || data.data || (Array.isArray(data) ? data : []);
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

                {/* SPREADSHEET LAYOUT SELECTOR */}
                <div className="mt-4 bg-slate-950/60 p-4 border border-slate-800/80 rounded-xl space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 pb-1 border-b border-slate-800/50">
                    <span className="text-xs font-semibold text-slate-300">Spreadsheet Formatting Target</span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-emerald-950 text-emerald-400 rounded border border-emerald-900/60 font-bold self-start sm:self-auto">
                      {exportLayout === "row_per_member" ? "One Row Per Member (Recommended)" : exportLayout === "grouped_semicolon" ? "Compact Semicolon (Inline)" : "Stacked Cells (Multi-line)"}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setExportLayout("row_per_member")}
                      className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                        exportLayout === "row_per_member"
                          ? "bg-slate-900 border-emerald-500/80 text-white shadow-md shadow-emerald-950/40"
                          : "bg-slate-900/40 hover:bg-slate-900/80 border-slate-800/80 text-slate-400"
                      }`}
                    >
                      <div className="font-semibold text-[11px] text-slate-200">One Row Per Member</div>
                      <div className="text-[10px] text-slate-400 mt-1 leading-normal font-mono">
                        Standard rows. No stretched cells. Perfect for sorting & filters.
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setExportLayout("grouped_semicolon")}
                      className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                        exportLayout === "grouped_semicolon"
                          ? "bg-slate-900 border-emerald-500/80 text-white shadow-md shadow-emerald-950/40"
                          : "bg-slate-900/40 hover:bg-slate-900/80 border-slate-800/80 text-slate-400"
                      }`}
                    >
                      <div className="font-semibold text-[11px] text-slate-200">Compact Semicolon</div>
                      <div className="text-[10px] text-slate-400 mt-1 leading-normal font-mono">
                        Compact rows. Combined using ";". Standard cell heights.
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setExportLayout("grouped_newline")}
                      className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                        exportLayout === "grouped_newline"
                          ? "bg-slate-900 border-emerald-500/80 text-white shadow-md shadow-emerald-950/40"
                          : "bg-slate-900/40 hover:bg-slate-900/80 border-slate-800/80 text-slate-400"
                      }`}
                    >
                      <div className="font-semibold text-[11px] text-slate-200">Stacked cells</div>
                      <div className="text-[10px] text-slate-400 mt-1 leading-normal font-mono">
                        Single row with newlines in cell. Stretches cell height.
                      </div>
                    </button>
                  </div>
                </div>
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
                              <td colSpan={6} className="py-5 px-4 sm:px-8">
                                <div className="border border-slate-850/80 rounded-xl p-5 bg-slate-950/90 space-y-4 shadow-xl">
                                  
                                  {/* Sub Tab Header Navigator */}
                                  <div className="flex flex-wrap items-center justify-between border-b border-slate-900 pb-3 gap-3">
                                    <div className="flex items-center gap-1.5 p-1 bg-slate-900/60 border border-slate-850/60 rounded-lg">
                                      <button
                                        type="button"
                                        onClick={() => handleSwitchSubTab(ws.id, "shares")}
                                        className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer ${
                                          (activeSubTabs[ws.id] || "shares") === "shares"
                                            ? "bg-slate-950 border border-slate-850 text-emerald-400 font-extrabold shadow-sm"
                                            : "text-slate-400 hover:text-slate-200"
                                        }`}
                                      >
                                        <Users className="w-3.5 h-3.5" />
                                        Roles & Permissions
                                      </button>
                                      
                                      <button
                                        type="button"
                                        onClick={() => handleSwitchSubTab(ws.id, "assets")}
                                        className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer ${
                                          activeSubTabs[ws.id] === "assets"
                                            ? "bg-slate-950 border border-slate-850 text-emerald-400 font-extrabold shadow-sm"
                                            : "text-slate-400 hover:text-slate-200"
                                        }`}
                                      >
                                        <FileSpreadsheet className="w-3.5 h-3.5" />
                                        Sheets & Asset Explorer
                                      </button>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      {(activeSubTabs[ws.id] || "shares") === "shares" ? (
                                        <button
                                          type="button"
                                          onClick={() => loadWorkspaceShares(ws.id)}
                                          disabled={ws.isLoadingShares}
                                          className="text-[10px] font-mono text-emerald-400 hover:text-emerald-300 transition flex items-center gap-1.5 disabled:opacity-55 cursor-pointer bg-slate-900 px-2.5 py-1 rounded border border-slate-800"
                                        >
                                          <RefreshCw className={`w-3 h-3 ${ws.isLoadingShares ? "animate-spin" : ""}`} />
                                          Sync Directory
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => loadWorkspaceAssets(ws.id)}
                                          disabled={ws.isLoadingAssets}
                                          className="text-[10px] font-mono text-emerald-400 hover:text-emerald-300 transition flex items-center gap-1.5 disabled:opacity-55 cursor-pointer bg-slate-900 px-2.5 py-1 rounded border border-slate-800"
                                        >
                                          <RefreshCw className={`w-3 h-3 ${ws.isLoadingAssets ? "animate-spin" : ""}`} />
                                          Scan Assets
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  {workspaceActionError[ws.id] && (
                                    <div className="p-3.5 rounded-lg bg-red-950/20 border border-red-900/40 text-red-300 text-xs flex items-start gap-2 max-w-2xl font-mono leading-relaxed">
                                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                      <div>
                                        <span className="font-semibold text-red-200 block">Workspace Operation Notice</span>
                                        <span>{workspaceActionError[ws.id]}</span>
                                      </div>
                                    </div>
                                  )}

                                  {/* TAB CONTENT: ROLES & SHARING PERMISSIONS */}
                                  {(activeSubTabs[ws.id] || "shares") === "shares" && (
                                    <div className="grid grid-cols-1 xl:grid-cols-4 gap-4.5 pt-1">
                                      
                                      {/* Left side: Add Member Invite Form */}
                                      <div className="xl:col-span-1 bg-slate-900/30 border border-slate-850 p-4 rounded-xl space-y-3 flex flex-col justify-between">
                                        <div className="space-y-1.5">
                                          <h6 className="text-[11px] font-bold uppercase text-slate-200 tracking-wider flex items-center gap-1.5">
                                            <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
                                            Share Workspace
                                          </h6>
                                          <p className="text-[10px] text-slate-400 leading-relaxed">
                                            Grant permissions to custom team members or external Smartsheet contacts directly.
                                          </p>
                                        </div>

                                        <div className="space-y-3 pt-1">
                                          <div>
                                            <label className="block text-[9.5px] uppercase font-mono tracking-wider text-slate-500 mb-1">Email Identifier</label>
                                            <input
                                              type="email"
                                              placeholder="e.g. team.member@org.com"
                                              value={addMemberEmail[ws.id] || ""}
                                              onChange={(e) => setAddMemberEmail(prev => ({ ...prev, [ws.id]: e.target.value }))}
                                              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs font-mono text-slate-200 placeholder:text-slate-700 focus:outline-none focus:border-emerald-500 transition"
                                            />
                                          </div>

                                          <div>
                                            <label className="block text-[9.5px] uppercase font-mono tracking-wider text-slate-500 mb-1">Permission Role</label>
                                            <select
                                              value={addMemberRole[ws.id] || "EDITOR"}
                                              onChange={(e) => setAddMemberRole(prev => ({ ...prev, [ws.id]: e.target.value }))}
                                              className="w-full px-1.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs font-mono text-slate-300 focus:outline-none focus:border-emerald-500"
                                            >
                                              <option value="ADMIN">ADMIN</option>
                                              <option value="EDITOR">EDITOR</option>
                                              <option value="EDITOR_SHARE">EDITOR_SHARE</option>
                                              <option value="VIEWER">VIEWER</option>
                                              <option value="VIEWER_SHARE">VIEWER_SHARE</option>
                                            </select>
                                          </div>

                                          {addMemberError[ws.id] && (
                                            <div className="text-[10px] text-red-400 bg-red-950/20 px-2 py-1 rounded border border-red-900/30">
                                              {addMemberError[ws.id]}
                                            </div>
                                          )}

                                          <button
                                            type="button"
                                            onClick={() => handleAddShare(ws.id)}
                                            disabled={isAddingMember[ws.id] || !(addMemberEmail[ws.id] || "").trim()}
                                            className={`w-full py-2 text-xs font-bold rounded flex items-center justify-center gap-1.5 transition cursor-pointer ${
                                              isAddingMember[ws.id] || !(addMemberEmail[ws.id] || "").trim()
                                                ? "bg-slate-800 text-slate-500 border border-slate-850 cursor-not-allowed"
                                                : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm font-semibold"
                                            }`}
                                          >
                                            {isAddingMember[ws.id] ? (
                                              <>
                                                <RefreshCw className="w-3 h-3 animate-spin" />
                                                <span>Adding...</span>
                                              </>
                                            ) : (
                                              <>
                                                <UserPlus className="w-3.5 h-3.5" />
                                                <span>Invite Member</span>
                                              </>
                                            )}
                                          </button>
                                        </div>
                                      </div>

                                      {/* Right side: Shares table list */}
                                      <div className="xl:col-span-3">
                                        {ws.isLoadingShares ? (
                                          <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-500 text-xs border border-slate-900 rounded-xl">
                                            <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                                            <span className="font-mono text-slate-400">Loading user roster...</span>
                                          </div>
                                        ) : ws.shares && ws.shares.length > 0 ? (
                                          <div className="overflow-x-auto border border-slate-900 rounded-lg">
                                            <table className="w-full text-left border-collapse">
                                              <thead>
                                                <tr className="border-b border-slate-900 bg-slate-950 text-[9px] uppercase tracking-wider font-bold text-slate-500">
                                                  <th className="py-2.5 px-3">Scope Target Name</th>
                                                  <th className="py-2.5 px-3">Email Address</th>
                                                  <th className="py-2.5 px-3 w-24">Type</th>
                                                  <th className="py-2.5 px-3">Access Level / Permission Role</th>
                                                  <th className="py-2.5 px-3 text-right w-36">Actions</th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-slate-900/40">
                                                {ws.shares.map((share) => {
                                                  const isOwner = share.accessLevel === "OWNER" || ws.accessLevel === "OWNER" && share.email === currentUser?.email;
                                                  const isEditing = editingShareId[ws.id] === share.id;
                                                  const isLoading = shareLoadingStates[share.id];
                                                  const isConfirmingDelete = confirmingDeleteShareId[ws.id] === share.id;

                                                  return (
                                                    <tr key={share.id} className="text-[11px] hover:bg-slate-900/10 text-slate-300">
                                                      <td className="py-2 px-3 font-medium text-slate-200">
                                                        <span className="truncate max-w-xs block font-semibold">{share.name || "N/A"}</span>
                                                      </td>
                                                      <td className="py-2 px-3 font-mono text-slate-400">
                                                        <span className="truncate max-w-xs block">{share.email || "Group / Shared Object"}</span>
                                                      </td>
                                                      <td className="py-2 px-3 font-mono text-[9px]">
                                                        <span className="text-[10px] text-slate-500 font-bold uppercase">
                                                          {share.type || "USER"}
                                                        </span>
                                                      </td>
                                                      <td className="py-2 px-3 font-mono">
                                                        {isEditing ? (
                                                          <div className="flex items-center gap-1.5">
                                                            <select
                                                              value={editingShareRole[ws.id]}
                                                              onChange={(e) => setEditingShareRole(prev => ({ ...prev, [ws.id]: e.target.value }))}
                                                              className="bg-slate-950 border border-slate-800 px-1.5 py-0.5 rounded text-[11px] text-emerald-400 font-mono focus:outline-none focus:border-emerald-500"
                                                            >
                                                              <option value="ADMIN">ADMIN</option>
                                                              <option value="EDITOR">EDITOR</option>
                                                              <option value="EDITOR_SHARE">EDITOR_SHARE</option>
                                                              <option value="VIEWER">VIEWER</option>
                                                              <option value="VIEWER_SHARE">VIEWER_SHARE</option>
                                                            </select>
                                                            
                                                            <button
                                                              type="button"
                                                              onClick={() => handleUpdateShare(ws.id, share.id, editingShareRole[ws.id])}
                                                              disabled={isLoading === "updating"}
                                                              className="p-1 bg-emerald-950 text-emerald-400 border border-emerald-900/60 rounded hover:bg-emerald-900 transition disabled:opacity-50 cursor-pointer"
                                                              title="Save changes"
                                                            >
                                                              {isLoading === "updating" ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                                            </button>
                                                            <button
                                                              type="button"
                                                              onClick={() => setEditingShareId(prev => ({ ...prev, [ws.id]: null }))}
                                                              className="p-1 bg-slate-900 text-slate-400 border border-slate-800 rounded hover:bg-slate-800 transition cursor-pointer"
                                                              title="Cancel"
                                                            >
                                                              <X className="w-3 h-3" />
                                                            </button>
                                                          </div>
                                                        ) : (
                                                          <div className="flex items-center gap-2">
                                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
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

                                                            {!isOwner && share.accessLevel !== "OWNER" && (
                                                              <button
                                                                type="button"
                                                                onClick={() => {
                                                                  setEditingShareId(prev => ({ ...prev, [ws.id]: share.id }));
                                                                  setEditingShareRole(prev => ({ ...prev, [ws.id]: share.accessLevel }));
                                                                }}
                                                                className="p-1 hover:bg-slate-900 rounded text-slate-500 hover:text-emerald-400 transition cursor-pointer"
                                                                title="Refactor share role"
                                                              >
                                                                <Edit2 className="w-3 h-3" />
                                                              </button>
                                                            )}
                                                          </div>
                                                        )}
                                                      </td>
                                                      <td className="py-2 px-3 text-right">
                                                        {isOwner || share.accessLevel === "OWNER" ? (
                                                          <span className="text-amber-400 text-[10px] font-extrabold flex items-center justify-end gap-1 font-mono">
                                                            <Crown className="w-3 h-3 fill-current" />
                                                            Owner
                                                          </span>
                                                        ) : isConfirmingDelete ? (
                                                          <div className="flex items-center justify-end gap-1.5">
                                                            <button
                                                              type="button"
                                                              onClick={() => handleDeleteShare(ws.id, share.id)}
                                                              disabled={isLoading === "deleting"}
                                                              className="px-2 py-0.5 bg-red-650 hover:bg-red-550 border border-red-600 rounded font-bold text-[9px] text-white uppercase tracking-wider cursor-pointer"
                                                            >
                                                              {isLoading === "deleting" ? "Removing" : "Revoke perms"}
                                                            </button>
                                                            <button
                                                              type="button"
                                                              onClick={() => setConfirmingDeleteShareId(prev => ({ ...prev, [ws.id]: null }))}
                                                              className="px-2 py-0.5 bg-slate-900 hover:bg-slate-805 rounded font-bold text-[9px] text-slate-400 cursor-pointer"
                                                            >
                                                              Cancel
                                                            </button>
                                                          </div>
                                                        ) : (
                                                          <button
                                                            type="button"
                                                            onClick={() => setConfirmingDeleteShareId(prev => ({ ...prev, [ws.id]: share.id }))}
                                                            className="p-1 px-1.5 bg-slate-950 hover:bg-red-950/40 border border-slate-900 hover:border-red-900/40 rounded text-slate-500 hover:text-red-400 transition cursor-pointer"
                                                            title="Delete share access"
                                                          >
                                                            <Trash className="w-3 h-3 text-slate-600 hover:text-red-400" />
                                                          </button>
                                                        )}
                                                      </td>
                                                    </tr>
                                                  );
                                                })}
                                              </tbody>
                                            </table>
                                          </div>
                                        ) : (
                                          <div className="py-8 text-center text-slate-600 text-xs border border-dashed border-slate-900 rounded-lg">
                                            No explicit shares found. Click Sync Directory or Invite Member to begin adding.
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* TAB CONTENT: SHEETS & ASSET EXPLORER */}
                                  {activeSubTabs[ws.id] === "assets" && (
                                    <div className="space-y-4 pt-1">
                                      {ws.isLoadingAssets ? (
                                        <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-500 text-xs text-center border border-slate-900 border-dashed rounded-xl">
                                          <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
                                          <span className="font-mono text-slate-400">Inspecting workspace map...</span>
                                          <span className="text-[10px] text-slate-500 leading-normal">Fetching nested sheets, workflows, and reports from Smartsheet</span>
                                        </div>
                                      ) : ws.assets ? (
                                        (() => {
                                          const sheets = ws.assets.sheets || [];
                                          const folders = ws.assets.folders || [];
                                          const reports = ws.assets.reports || [];
                                          const templates = ws.assets.templates || [];
                                          const isEmpty = sheets.length === 0 && folders.length === 0 && reports.length === 0 && templates.length === 0;

                                          if (isEmpty) {
                                            return (
                                              <div className="py-12 text-center text-slate-500 text-xs border border-dashed border-slate-850 rounded-xl space-y-1 bg-slate-950/20">
                                                <Database className="w-6 h-6 mx-auto opacity-10 mb-1" />
                                                <p className="font-mono text-[11px] text-slate-300">Empty Workspace Space</p>
                                                <p className="text-[10px] text-slate-500">There are no nested sheets, folders, templates, or reports in this workspace yet.</p>
                                              </div>
                                            );
                                          }

                                          return (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                              
                                              {/* COLUMN 1: SHEETS */}
                                              <div className="p-4 rounded-xl border border-slate-900 bg-slate-950/40 space-y-3 flex flex-col justify-between">
                                                <div className="space-y-2.5">
                                                  <div className="flex items-center justify-between border-b border-slate-900 pb-1.5">
                                                    <span className="text-[10.5px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                                                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
                                                      Web Sheets
                                                    </span>
                                                    <span className="font-mono text-[10px] text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded">
                                                      {sheets.length}
                                                    </span>
                                                  </div>
                                                  
                                                  {sheets.length === 0 ? (
                                                    <p className="text-[10px] text-slate-500 italic py-2">No sheets listed.</p>
                                                  ) : (
                                                    <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                                                      {sheets.map((sheet: any) => (
                                                        <div key={sheet.id} className="p-2 rounded bg-slate-950/80 border border-slate-900 flex items-start justify-between gap-2 group hover:border-slate-800 transition">
                                                          <div className="space-y-0.5 min-w-0">
                                                            <span className="text-[11px] font-semibold text-slate-300 block truncate leading-tight group-hover:text-slate-200" title={sheet.name}>
                                                              {sheet.name}
                                                            </span>
                                                            <span className="font-mono text-[9px] text-slate-500 block">ID: {sheet.id}</span>
                                                          </div>
                                                          {sheet.permalink && (
                                                            <a
                                                              href={sheet.permalink}
                                                              target="_blank"
                                                              rel="noreferrer"
                                                              className="text-slate-500 hover:text-emerald-400 p-0.5 transition cursor-pointer shrink-0 mt-0.5"
                                                              title="Open Sheet in Smartsheet"
                                                            >
                                                              <ExternalLink className="w-3.5 h-3.5" />
                                                            </a>
                                                          )}
                                                        </div>
                                                      ))}
                                                    </div>
                                                  )}
                                                </div>
                                              </div>

                                              {/* COLUMN 2: FOLDERS */}
                                              <div className="p-4 rounded-xl border border-slate-900 bg-slate-950/40 space-y-3 flex flex-col justify-between">
                                                <div className="space-y-2.5">
                                                  <div className="flex items-center justify-between border-b border-slate-900 pb-1.5">
                                                    <span className="text-[10.5px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                                                      <Folder className="w-3.5 h-3.5 text-amber-500" />
                                                      Nested Folders
                                                    </span>
                                                    <span className="font-mono text-[10px] text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded">
                                                      {folders.length}
                                                    </span>
                                                  </div>
                                                  
                                                  {folders.length === 0 ? (
                                                    <p className="text-[10px] text-slate-500 italic py-2">No folders listed.</p>
                                                  ) : (
                                                    <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                                                      {folders.map((folder: any) => (
                                                        <div key={folder.id} className="p-2 rounded bg-slate-950/80 border border-slate-900 flex items-start justify-between gap-1 group hover:border-slate-800 transition">
                                                          <div className="space-y-0.5 min-w-0">
                                                            <span className="text-[11px] font-semibold text-slate-300 block truncate leading-tight group-hover:text-slate-200" title={folder.name}>
                                                              {folder.name}
                                                            </span>
                                                            <span className="font-mono text-[9px] text-slate-500 block">ID: {folder.id}</span>
                                                          </div>
                                                          {folder.permalink && (
                                                            <a
                                                              href={folder.permalink}
                                                              target="_blank"
                                                              rel="noreferrer"
                                                              className="text-slate-500 hover:text-amber-400 p-0.5 transition cursor-pointer shrink-0 mt-0.5"
                                                              title="Open Folder in Smartsheet"
                                                            >
                                                              <ExternalLink className="w-3.5 h-3.5" />
                                                            </a>
                                                          )}
                                                        </div>
                                                      ))}
                                                    </div>
                                                  )}
                                                </div>
                                              </div>

                                              {/* COLUMN 3: REPORTS */}
                                              <div className="p-4 rounded-xl border border-slate-900 bg-slate-950/40 space-y-3 flex flex-col justify-between">
                                                <div className="space-y-2.5">
                                                  <div className="flex items-center justify-between border-b border-slate-900 pb-1.5">
                                                    <span className="text-[10.5px] font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                                                      <FileText className="w-3.5 h-3.5 text-sky-500" />
                                                      Reports
                                                    </span>
                                                    <span className="font-mono text-[10px] text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded">
                                                      {reports.length}
                                                    </span>
                                                  </div>
                                                  
                                                  {reports.length === 0 ? (
                                                    <p className="text-[10px] text-slate-500 italic py-2">No reports listed.</p>
                                                  ) : (
                                                    <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                                                      {reports.map((report: any) => (
                                                        <div key={report.id} className="p-2 rounded bg-slate-950/80 border border-slate-900 flex items-start justify-between gap-1 group hover:border-slate-800 transition">
                                                          <div className="space-y-0.5 min-w-0">
                                                            <span className="text-[11px] font-semibold text-slate-300 block truncate leading-tight group-hover:text-slate-200" title={report.name}>
                                                              {report.name}
                                                            </span>
                                                            <span className="font-mono text-[9px] text-slate-500 block">ID: {report.id}</span>
                                                          </div>
                                                          {report.permalink && (
                                                            <a
                                                              href={report.permalink}
                                                              target="_blank"
                                                              rel="noreferrer"
                                                              className="text-slate-500 hover:text-sky-400 p-0.5 transition cursor-pointer shrink-0 mt-0.5"
                                                              title="Open Report in Smartsheet"
                                                            >
                                                              <ExternalLink className="w-3.5 h-3.5" />
                                                            </a>
                                                          )}
                                                        </div>
                                                      ))}
                                                    </div>
                                                  )}
                                                </div>
                                              </div>

                                              {/* COLUMN 4: TEMPLATES */}
                                              <div className="p-4 rounded-xl border border-slate-900 bg-slate-950/40 space-y-3 flex flex-col justify-between">
                                                <div className="space-y-2.5">
                                                  <div className="flex items-center justify-between border-b border-slate-900 pb-1.5">
                                                    <span className="text-[10.5px] font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                                                      <Layout className="w-3.5 h-3.5 text-purple-500" />
                                                      Templates
                                                    </span>
                                                    <span className="font-mono text-[10px] text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded">
                                                      {templates.length}
                                                    </span>
                                                  </div>
                                                  
                                                  {templates.length === 0 ? (
                                                    <p className="text-[10px] text-slate-500 italic py-2">No templates listed.</p>
                                                  ) : (
                                                    <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                                                      {templates.map((template: any) => (
                                                        <div key={template.id} className="p-2 rounded bg-slate-950/80 border border-slate-900 flex items-start justify-between gap-1 group hover:border-slate-800 transition flex-col">
                                                          <div className="space-y-0.5 min-w-0">
                                                            <span className="text-[11px] font-semibold text-slate-300 block truncate leading-tight group-hover:text-slate-200" title={template.name}>
                                                              {template.name}
                                                            </span>
                                                            <span className="font-mono text-[9px] text-slate-500 block">ID: {template.id}</span>
                                                          </div>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  )}
                                                </div>
                                              </div>

                                            </div>
                                          );
                                        })()
                                      ) : (
                                        <div className="py-8 text-center text-slate-600 text-xs border border-dashed border-slate-900 rounded-lg">
                                          Click Scan Assets or Sync Directory above to retrieve sheets and files list.
                                        </div>
                                      )}
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
