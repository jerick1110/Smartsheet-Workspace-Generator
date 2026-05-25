import React, { useState } from "react";
import { Code, Copy, Check, Download, ExternalLink, Terminal, ShieldAlert, ArrowUpRight, HelpCircle } from "lucide-react";

export default function PythonTab() {
  const [copied, setCopied] = useState(false);

  // Robust, fully updated Python script demonstrating security standards and direct connection testing
  const pythonCode = `#!/usr/bin/env python3
"""
Smartsheet Workspace Generator and Batch Automation Orchestrator.
Language: Python 3.6+
Library: smartsheet-python-sdk (v2+)

Requirements:
    pip install smartsheet-python-sdk

Security:
    Expects Smartsheet API access token under interactive console input 
    or preset as an environment variable (SMARTSHEET_ACCESS_TOKEN).
"""

import sys
import os
import logging
import smartsheet

# Configure clean logging logs
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("smartsheet-orchestrator")


def get_authenticated_client():
    """Validates connection and returns authenticated Smartsheet API client."""
    # Attempt to load token from environment, or ask user via input
    access_token = os.environ.get("SMARTSHEET_ACCESS_TOKEN")
    
    if not access_token:
        print("\\n=== SMARTSHEET API ACCESS TERMINAL ===")
        print("To generate personal access tokens, navigate to Smartsheet -> Account -> Personal Settings -> API Access.")
        access_token = input("Enter Smartsheet API Access Token: ").strip()
    
    if not access_token:
        logger.error("Authentication failed: Absolute Token must not be empty.")
        sys.exit(1)
        
    # Instantiate the official Python Smartsheet client
    client = smartsheet.Smartsheet(access_token)
    
    # Configure the client to raise standard Exceptions instead of failing silently or crashing
    client.errors_as_exceptions(True)
    
    # Test credentials by fetching active user profile
    try:
        logger.info("Initializing API handshakes. Auditing connection token...")
        user_profile = client.Users.get_current_user()
        logger.info(f"Connected Successfully! User: {user_profile.name} ({user_profile.email})")
        return client
    except smartsheet.exceptions.ApiError as e:
        native_err = e.native_result
        logger.error(f"API Handshake Failure: Status Code {native_err.status_code} - {native_err.message}")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unexpected connection error occurred: {str(e)}")
        sys.exit(1)


def create_individual_workspace(client, workspace_name):
    """Executes call to create single workspace name."""
    logger.info(f"Spinning up creation queue for Workspace: '{workspace_name}'...")
    
    # Define Smartsheet Workspace model structure
    workspace_model = smartsheet.models.Workspace({
        "name": workspace_name
    })

    try:
        response = client.Workspaces.create_workspace(workspace_model)
        created_workspace = response.result
        
        print("\\n" + "=" * 50)
        print("🎉 SUCCESS: WORKSPACE REGISTERED")
        print("=" * 50)
        print(f"Workspace Name: {created_workspace.name}")
        print(f"Workspace ID:   {created_workspace.id}")
        print(f"Access Level:   {created_workspace.access_level}")
        print(f"Permanent Link: {created_workspace.permalink}")
        print("=" * 50 + "\\n")
        
        return created_workspace
    except smartsheet.exceptions.ApiError as e:
        native_err = e.native_result
        logger.error(f"Failed to create '{workspace_name}': {native_err.message} (Code: {native_err.error_code})")
        return None
    except Exception as e:
        logger.error(f"Unexpected error creating workspace: {str(e)}")
        return None


def run_batch_generator(client):
    """Interactive loop to support bulk creation sequences."""
    print("\\n=== BATCH GENERATION WORKSTATION ===")
    print("Select generation method:")
    print("1) Explicit List (comma or newline separated names)")
    print("2) Numerical Sequence Range (e.g. Iteration 1 to 5)")
    
    choice = input("Select generation option (1 or 2): ").strip()
    workspaces_to_create = []
    
    if choice == "1":
        names_input = input("\\nEnter list of names (separated by comma): ").strip()
        workspaces_to_create = [item.strip() for item in names_input.split(",") if item.strip()]
    elif choice == "2":
        prefix = input("\\nEnter prefix template name (e.g. Sprint Hub): ").strip()
        try:
            start = int(input("Enter starting index (e.g. 1): "))
            end = int(input("Enter ending index (e.g. 3): "))
            if start > end:
                start, end = end, start
            workspaces_to_create = [f"{prefix} - Part {i}" for i in range(start, end + 1)]
        except ValueError:
            logger.error("Error: Sequence indices must be valid integers.")
            return
    else:
        logger.error("Invalid menu assignment selection.")
        return

    if not workspaces_to_create:
        logger.warning("Empty generation queue. Aborting.")
        return

    print(f"\\nPreparing sequence. {len(workspaces_to_create)} workspaces will be generated.")
    confirm = input("Execute execution sequence? (y/n): ").strip().lower()
    if confirm != "y":
        logger.info("Batch request suspended by developer request.")
        return

    successful_creations = []
    for idx, name in enumerate(workspaces_to_create, 1):
        print(f"\\nProcessing item [{idx}/{len(workspaces_to_create)}]")
        created = create_individual_workspace(client, name)
        if created:
            successful_creations.append(created)

    print("\\n" + "=" * 50)
    print(f"BATCH REPORT: Completed. Created {len(successful_creations)}/{len(workspaces_to_create)} Workspaces.")
    print("=" * 50)
    for index, item in enumerate(successful_creations, 1):
        print(f"[{index}] ID: {item.id} | Name: {item.name} | URL: {item.permalink}")
    print("=" * 50 + "\\n")


def main():
    """Main Orchestrator module."""
    print("==============================================")
    print("⚙️  SMARTSHEET AUTOMATION SDK PLATFORM (v2.0)  ")
    print("==============================================")
    
    # 1. Establish validated workspace client
    client = get_authenticated_client()
    
    # 2. Ask user for execution context
    print("\\nSelect automation task:")
    print("1) Create an individual Workspace")
    print("2) Batch create multiple Workspaces")
    print("3) Cancel execution")
    
    task_choice = input("Enter option (1-3): ").strip()
    
    if task_choice == "1":
        ws_name = input("\\nEnter desired name for Workspace: ").strip()
        if ws_name:
            create_individual_workspace(client, ws_name)
        else:
            logger.error("Workspace name is required.")
    elif task_choice == "2":
        run_batch_generator(client)
    else:
        logger.info("Process decommissioned safely.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\\nProcess interrupted securely by developer request.")
        sys.exit(0)
`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(pythonCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadCode = () => {
    const blob = new Blob([pythonCode], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.className = "hidden";
    link.setAttribute("href", url);
    link.setAttribute("download", "smartsheet_workspace_generator.py");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 bg-slate-900 border border-slate-800 rounded-xl">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Code className="w-4.5 h-4.5 text-emerald-400" />
            Python Automation SDK Solution
          </h3>
          <p className="text-xs text-slate-400 leading-normal max-w-xl">
            This module represents the complete executable script requested, optimized with production exception controls, CLI batch naming systems, and standard runtime logging.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 whitespace-nowrap">
          <button
            onClick={handleCopyCode}
            className="px-3.5 py-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-lg text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                Copied to clipboard!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy Source Code
              </>
            )}
          </button>
          
          <button
            onClick={handleDownloadCode}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer hover:shadow-lg hover:shadow-emerald-950/20"
          >
            <Download className="w-3.5 h-3.5" />
            Download .py Script
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Code viewer */}
        <div className="xl:col-span-8 bg-slate-950 rounded-xl border border-slate-850 overflow-hidden relative group">
          <div className="bg-slate-900/40 border-b border-slate-850 px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
              <span className="text-[10px] text-slate-500 font-mono ml-2">smartsheet_workspace_generator.py</span>
            </div>
            <span className="text-[10px] text-slate-600 font-mono uppercase bg-slate-950 px-2 py-0.5 rounded border border-slate-850">
              Python 3.x
            </span>
          </div>
          
          <pre className="p-4 overflow-x-auto text-xs font-mono text-slate-300 leading-relaxed max-h-[480px] custom-scrollbar selection:bg-slate-800 selection:text-emerald-400">
            <code>{pythonCode}</code>
          </pre>
        </div>

        {/* User Guide Setup */}
        <div className="xl:col-span-4 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              Local Execution Guide
            </h4>

            <div className="space-y-4 text-xs leading-relaxed text-slate-400 pr-1">
              <div>
                <span className="font-mono text-emerald-400 block mb-0.5">1. Setup SDK Dependency</span>
                <p>Run the pip installer in your console environment to pull down the official Smartsheet API module:</p>
                <div className="mt-2 bg-slate-950 p-2.5 rounded border border-slate-850 text-[10px] font-mono select-all text-slate-200">
                  pip install smartsheet-python-sdk
                </div>
              </div>

              <div>
                <span className="font-mono text-emerald-400 block mb-0.5">2. Configuration (Encrypted Variables)</span>
                <p>Optionally establish the token as a system variable so the script bypasses prompt inputs:</p>
                <div className="mt-2 bg-slate-950 p-2.5 rounded border border-slate-850 text-[10px] font-mono text-slate-400">
                  <span className="text-slate-500"># macOS/Linux:</span><br />
                  export SMARTSHEET_ACCESS_TOKEN="your_token"<br />
                  <span className="text-slate-500"># Windows:</span><br />
                  set SMARTSHEET_ACCESS_TOKEN=your_token
                </div>
              </div>

              <div>
                <span className="font-mono text-emerald-400 block mb-0.5">3. Fire script</span>
                <p>Execute via terminal. The application will render interactive options directly:</p>
                <div className="mt-2 bg-slate-950 p-2.5 rounded border border-slate-850 text-[10px] font-mono select-all text-slate-200">
                  python3 smartsheet_workspace_generator.py
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
              API Security Mandates
            </h4>
            <ul className="space-y-2 text-[11px] text-slate-400 leading-relaxed list-disc list-inside">
              <li>Commit protection: Never store your token raw inside Git commits.</li>
              <li>Token Scope: Ensure your generated token has sufficient read/write rights.</li>
              <li>Exceptions: Smartsheet API defaults are configured via <code className="text-amber-400 font-mono">errors_as_exceptions(True)</code> to handle token timeouts gracefully.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
