import React, { useState } from "react";
import { Copy, Check, ExternalLink, Play, Trash2, ArrowRight, Layers, FileSpreadsheet, PlusCircle, AlertCircle, Sparkles, Terminal } from "lucide-react";
import { Workspace, WorkspaceCreationLog } from "../types";

interface GeneratorTabProps {
  token: string;
  isValidated: boolean;
  onRefreshWorkspaces: () => void;
}

export default function GeneratorTab({ token, isValidated, onRefreshWorkspaces }: GeneratorTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<"single" | "bulk">("single");

  // Single Workspace state
  const [singleWorkspaceName, setSingleWorkspaceName] = useState("");
  const [isCreatingSingle, setIsCreatingSingle] = useState(false);
  const [singleError, setSingleError] = useState<string | null>(null);
  const [singleResult, setSingleResult] = useState<Workspace | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Bulk Workspace state
  const [bulkMode, setBulkMode] = useState<"list" | "sequence">("list");
  const [bulkTextInput, setBulkTextInput] = useState("Alpha Project\nBeta Project\nGamma Project");
  const [sequencePrefix, setSequencePrefix] = useState("Iteration Hub");
  const [sequenceStart, setSequenceStart] = useState(1);
  const [sequenceEnd, setSequenceEnd] = useState(3);
  const [batchLogs, setBatchLogs] = useState<WorkspaceCreationLog[]>([]);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(-1);

  const handleCopySingleField = (text: string, type: "id" | "link") => {
    navigator.clipboard.writeText(text);
    if (type === "id") {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } else {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  // 1. Create Single Workspace Action
  const handleCreateSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleWorkspaceName.trim()) {
      setSingleError("Please provide a workspace name.");
      return;
    }

    setIsCreatingSingle(true);
    setSingleError(null);
    setSingleResult(null);

    try {
      const response = await fetch("/api/smartsheet/workspaces", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-smartsheet-token": token,
        },
        body: JSON.stringify({ name: singleWorkspaceName.trim() }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to create workspace.");
      }

      setSingleResult(data.workspace);
      setSingleWorkspaceName("");
      onRefreshWorkspaces(); // Reload parent catalog
    } catch (err: any) {
      console.error(err);
      setSingleError(err.message || "Could not complete workspace creation.");
    } finally {
      setIsCreatingSingle(false);
    }
  };

  // 2. Generate Bulk Naming Lists
  const getBulkTargetNames = (): string[] => {
    if (bulkMode === "list") {
      return bulkTextInput
        .split(/[\n,]+/)
        .map((n) => n.trim())
        .filter((n) => n.length > 0);
    } else {
      const names: string[] = [];
      const start = Math.min(sequenceStart, sequenceEnd);
      const end = Math.max(sequenceStart, sequenceEnd);
      
      // Safety limit to avoid infinite runs
      const boundedEnd = Math.min(end, start + 30); 
      for (let i = start; i <= boundedEnd; i++) {
        names.push(`${sequencePrefix} - Part ${i}`);
      }
      return names;
    }
  };

  const prepareBatch = () => {
    const names = getBulkTargetNames();
    if (names.length === 0) return;

    const initialLogs: WorkspaceCreationLog[] = names.map((name, index) => ({
      id: `${Date.now()}-${index}`,
      name,
      status: "idle",
    }));

    setBatchLogs(initialLogs);
    setCurrentBatchIndex(-1);
  };

  // 3. Sequential Async Runner
  const runBatchProcessing = async () => {
    if (batchLogs.length === 0) return;
    setIsBatchRunning(true);

    const updatedLogs = [...batchLogs];

    for (let i = 0; i < updatedLogs.length; i++) {
      setCurrentBatchIndex(i);
      updatedLogs[i].status = "pending";
      setBatchLogs([...updatedLogs]);

      try {
        const response = await fetch("/api/smartsheet/workspaces", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-smartsheet-token": token,
          },
          body: JSON.stringify({ name: updatedLogs[i].name }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "API error response received.");
        }

        updatedLogs[i].status = "success";
        updatedLogs[i].responseId = data.workspace.id;
        updatedLogs[i].responsePermalink = data.workspace.permalink;
        updatedLogs[i].accessLevel = data.workspace.accessLevel;
      } catch (err: any) {
        updatedLogs[i].status = "error";
        updatedLogs[i].errorMessage = err.message || "Failed to create.";
      }

      // Buffer timeout between requests to respect Smartsheet limits
      await new Promise((resolve) => setTimeout(resolve, 350));
      setBatchLogs([...updatedLogs]);
    }

    setIsBatchRunning(false);
    setCurrentBatchIndex(-1);
    onRefreshWorkspaces(); // Reload global workspaces list
  };

  // 4. Download Logs as CSV
  const handleDownloadCSV = () => {
    const header = "Name,Status,Workspace ID,Link,Access Level,Error\n";
    const rows = batchLogs
      .map((log) => {
        const name = `"${log.name.replace(/"/g, '""')}"`;
        const status = log.status;
        const wsId = log.responseId || "";
        const permalink = log.responsePermalink || "";
        const access = log.accessLevel || "";
        const error = log.errorMessage ? `"${log.errorMessage.replace(/"/g, '""')}"` : "";
        return `${name},${status},${wsId},${permalink},${access},${error}`;
      })
      .join("\n");

    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `smartsheet_generation_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getProgressPercentage = () => {
    if (batchLogs.length === 0) return 0;
    const completedCount = batchLogs.filter((log) => log.status === "success" || log.status === "error").length;
    return Math.round((completedCount / batchLogs.length) * 100);
  };

  const successLogsCount = batchLogs.filter((log) => log.status === "success").length;
  const errorLogsCount = batchLogs.filter((log) => log.status === "error").length;

  return (
    <div className="relative">
      {/* Locked status fallback overlay */}
      {!isValidated && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-6 text-center rounded-xl border border-slate-800">
          <AlertCircle className="w-12 h-12 text-slate-500 mb-3 animate-pulse" />
          <h4 className="text-sm font-semibold text-slate-200 uppercase tracking-widest">Authentication Required</h4>
          <p className="text-xs text-slate-400 max-w-md mt-1 mb-4 leading-relaxed">
            You must input a valid Smartsheet Access Token on the <strong>Credentials Console</strong> tab and check the connection before utilizing workspace generation.
          </p>
        </div>
      )}

      <div className="space-y-6">
        {/* Workspace Mode selectors */}
        <div className="border-b border-slate-800/80 pb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 p-0.5 bg-slate-950 border border-slate-800 rounded-lg">
            <button
              onClick={() => setActiveSubTab("single")}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition ${
                activeSubTab === "single"
                  ? "bg-slate-900 text-emerald-400 border border-slate-800 shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Single Creator
            </button>
            <button
              onClick={() => setActiveSubTab("bulk")}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition ${
                activeSubTab === "bulk"
                  ? "bg-slate-900 text-emerald-400 border border-slate-800 shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Automated Bulk Generator
            </button>
          </div>
          <span className="text-[10px] font-mono text-slate-500 hidden sm:inline-block">
            ACTIVE HOST: Smartsheet Standard API (v2)
          </span>
        </div>

        {/* SINGLE WORKSPACE CREATOR PANEL */}
        {activeSubTab === "single" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <PlusCircle className="w-4 h-4 text-emerald-400" />
                  Generate Individual Workspace
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Enter the specific workspace title below. Upon processing, the SDK client will instantly build this workspace under your profile.
                </p>

                <form onSubmit={handleCreateSingle} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-2">
                      Workspace Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Sales Pipeline Q3"
                      value={singleWorkspaceName}
                      onChange={(e) => setSingleWorkspaceName(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 font-medium transition"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isCreatingSingle || !singleWorkspaceName.trim()}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-lg transition-all shadow flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isCreatingSingle ? "Orchestrating creation..." : "Generate Workspace"}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </form>

                {singleError && (
                  <div className="p-3.5 bg-red-950/30 border border-red-900/30 rounded-lg text-red-300 text-xs font-mono break-all flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                    <span>{singleError}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between min-h-[300px]">
              <div>
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
                  Generation Output Report
                </h4>

                {singleResult ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-slate-950 rounded-lg border border-emerald-900/35 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-1.5 bg-emerald-950/50 border-l border-b border-emerald-900/40 text-[9px] font-semibold uppercase tracking-widest text-emerald-400">
                        SUCCESS
                      </div>
                      
                      <div className="space-y-3 font-mono">
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase block">Workspace Name</span>
                          <span className="text-sm font-semibold text-slate-200">{singleResult.name}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase block">Workspace ID</span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-slate-300">{singleResult.id}</span>
                              <button
                                onClick={() => handleCopySingleField(String(singleResult.id), "id")}
                                className="text-slate-500 hover:text-emerald-400 p-0.5 transition"
                                title="Copy Workspace ID"
                              >
                                {copiedId ? <Check className="w-3 h-3 text-emerald-400 animate-pulse" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase block">Access Level</span>
                            <span className="text-xs text-slate-300">{singleResult.accessLevel || "OWNER"}</span>
                          </div>
                        </div>

                        {singleResult.permalink && (
                          <div className="border-t border-slate-800/80 pt-3">
                            <span className="text-[10px] text-slate-500 uppercase block">Permanent Link</span>
                            <div className="flex items-center gap-2 mt-1 w-full max-w-lg">
                              <input
                                readOnly
                                value={singleResult.permalink}
                                className="w-full bg-slate-900 border border-slate-850 py-1.5 px-2.5 rounded text-xs font-mono text-emerald-400 select-all overflow-ellipsis truncate"
                              />
                              <button
                                onClick={() => handleCopySingleField(singleResult.permalink || "", "link")}
                                className="text-slate-400 hover:text-emerald-400 p-2 bg-slate-900 rounded border border-slate-800 transition shrink-0"
                                title="Copy Link"
                              >
                                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-400 leading-normal">
                      The workspace was registered in Smartsheet database successfully. Use the permanent link to open the UI canvas directly.
                    </p>
                  </div>
                ) : (
                  <div className="h-44 border border-dashed border-slate-800/80 rounded-lg flex flex-col items-center justify-center text-slate-600 p-4">
                    <Sparkles className="w-8 h-8 opacity-20 mb-2 text-emerald-400 animate-pulse" />
                    <p className="text-xs">Awaiting workspace parameters...</p>
                    <p className="text-[10px] opacity-75 mt-0.5 text-center max-w-xs">Values will appear here once the client creates the workspace.</p>
                  </div>
                )}
              </div>

              {singleResult && (
                <div className="flex items-center justify-between border-t border-slate-800/60 pt-4 mt-4">
                  <span className="text-xs text-slate-500">Workspace status: Active</span>
                  <a
                    href={singleResult.permalink}
                    target="_blank"
                    rel="referrer"
                    className="px-3.5 py-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-lg text-slate-300 text-xs flex items-center gap-1.5 transition"
                  >
                    Open Workspace
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* BULK WORKSPACE CREATOR PANEL */}
        {activeSubTab === "bulk" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Configuration panel */}
              <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  Batch Configuration Customizer
                </h3>

                <div className="flex bg-slate-950 border border-slate-850 p-1 rounded-lg">
                  <button
                    onClick={() => setBulkMode("list")}
                    className={`flex-1 py-1 text-center font-mono text-[11px] rounded transition ${
                      bulkMode === "list" ? "bg-slate-900 text-slate-200 shadow" : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    Explicit List
                  </button>
                  <button
                    onClick={() => setBulkMode("sequence")}
                    className={`flex-1 py-1 text-center font-mono text-[11px] rounded transition ${
                      bulkMode === "sequence" ? "bg-slate-900 text-slate-200 shadow" : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    Numerical Sequence
                  </button>
                </div>

                {bulkMode === "list" ? (
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5">
                      Workspaces Names (one name per line or comma-separated)
                    </label>
                    <textarea
                      rows={5}
                      value={bulkTextInput}
                      onChange={(e) => setBulkTextInput(e.target.value)}
                      placeholder="Dev Environment&#10;Staging Environment&#10;Production Server"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 placeholder:text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition resize-y"
                    />
                    <span className="text-[10px] text-slate-500">
                      Empty and duplicate items are automatically filtered.
                    </span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                        Prefix Template Name
                      </label>
                      <input
                        type="text"
                        value={sequencePrefix}
                        onChange={(e) => setSequencePrefix(e.target.value)}
                        placeholder="Project Workspace"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                          Start Suffix
                        </label>
                        <input
                          type="number"
                          value={sequenceStart}
                          onChange={(e) => setSequenceStart(parseInt(e.target.value) || 1)}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                          End Suffix (Max +30)
                        </label>
                        <input
                          type="number"
                          value={sequenceEnd}
                          onChange={(e) => setSequenceEnd(parseInt(e.target.value) || 1)}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 border-t border-slate-800/80 pt-4">
                  <button
                    onClick={prepareBatch}
                    disabled={isBatchRunning}
                    className="w-full py-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 font-semibold text-xs rounded-lg transition"
                  >
                    Prepare Batch Roster
                  </button>
                  <button
                    onClick={runBatchProcessing}
                    disabled={isBatchRunning || batchLogs.length === 0}
                    className={`w-full py-2 text-white font-semibold text-xs rounded-lg transition flex items-center justify-center gap-1 border border-emerald-700 hover:shadow shadow-emerald-900/10 ${
                      isBatchRunning || batchLogs.length === 0
                        ? "bg-emerald-900/40 text-slate-500 border-none cursor-not-allowed"
                        : "bg-emerald-600 hover:bg-emerald-500 cursor-pointer"
                    }`}
                  >
                    <Play className="w-3 h-3 fill-current" />
                    Launch Batch
                  </button>
                </div>
              </div>

              {/* Progress and Output Console */}
              <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between h-[360px]">
                <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-800">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    Automation Roster Monitor ({batchLogs.length})
                  </span>
                  
                  {batchLogs.length > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleDownloadCSV}
                        className="text-[11px] text-slate-400 hover:text-emerald-400 transition flex items-center gap-1 font-mono"
                        title="Export current batch to Microsoft Excel/CSV format"
                      >
                        <FileSpreadsheet className="w-3 h-3" />
                        Export CSV
                      </button>
                      <button
                        onClick={() => {
                          setBatchLogs([]);
                          setCurrentBatchIndex(-1);
                        }}
                        disabled={isBatchRunning}
                        className="text-[11px] text-red-400 hover:text-red-300 transition flex items-center gap-1 font-mono disabled:opacity-30"
                      >
                        <Trash2 className="w-3 h-3" />
                        Clear
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto my-3 bg-slate-950 border border-slate-850 rounded-lg p-3 space-y-2 font-mono text-[11px] leading-relaxed custom-scrollbar">
                  {batchLogs.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-600 text-center select-none py-14">
                      <Terminal className="w-8 h-8 opacity-20 mb-2" />
                      <p>Automation engine idle.</p>
                      <p className="text-[10px] opacity-75 mt-0.5 max-w-[240px]">Setup explicit list or index format sequence parameters and click "Prepare" to queue creation.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-slate-500 text-[10px] border-b border-slate-800 pb-1 flex justify-between items-center bg-slate-950 sticky top-0">
                        <span>WORKSPACE SEQUENCE</span>
                        <span>EXECUTION STATUS</span>
                      </div>
                      
                      {batchLogs.map((log, idx) => (
                        <div
                          key={log.id}
                          className={`flex items-start justify-between gap-3 p-1.5 rounded transition ${
                            idx === currentBatchIndex
                              ? "bg-slate-900 text-emerald-300 ring-1 ring-slate-800"
                              : log.status === "success"
                              ? "text-slate-300"
                              : log.status === "error"
                              ? "text-red-300"
                              : "text-slate-500"
                          }`}
                        >
                          <div className="truncate pr-2">
                            <span className="text-slate-600 mr-1.5">[{idx + 1}]</span>
                            <span className="font-semibold">{log.name}</span>
                            {log.responseId && (
                              <span className="text-slate-500 text-[10px] ml-2 font-light">
                                (ID: {log.responseId})
                              </span>
                            )}
                          </div>

                          <div className="shrink-0 flex items-center gap-2">
                            {log.status === "idle" && <span className="text-slate-600 text-[10px]">Queued</span>}
                            {log.status === "pending" && (
                              <span className="text-emerald-400 text-[10px] flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
                                Processing...
                              </span>
                            )}
                            {log.status === "success" && (
                              <div className="flex items-center gap-1 text-emerald-400 text-[10px]">
                                <span>Success</span>
                                {log.responsePermalink && (
                                  <a
                                    href={log.responsePermalink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-0.5 hover:bg-slate-900 rounded inline-block"
                                    title="Open Permalink"
                                  >
                                    <ExternalLink className="w-3 h-3 text-slate-400" />
                                  </a>
                                )}
                              </div>
                            )}
                            {log.status === "error" && (
                              <span className="text-red-400 text-[10px] font-bold" title={log.errorMessage}>
                                Error
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Progress bar and statistics */}
                {batchLogs.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
                      <div className="flex gap-3">
                        <span>Success: <strong className="text-emerald-400">{successLogsCount}</strong></span>
                        <span>Failures: <strong className="text-red-400">{errorLogsCount}</strong></span>
                        <span>Total: <strong>{batchLogs.length}</strong></span>
                      </div>
                      <span>{getProgressPercentage()}% Complete</span>
                    </div>
                    <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-850">
                      <div
                        className="bg-emerald-500 h-full transition-all duration-350"
                        style={{ width: `${getProgressPercentage()}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
