import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Parse JSON payloads
  app.use(express.json());

  // Helper to extract Smartsheet token from headers or fallback
  const getSmartsheetToken = (req: express.Request): string | null => {
    const rawToken = req.headers["x-smartsheet-token"] || req.headers["authorization"];
    if (!rawToken) return process.env.SMARTSHEET_ACCESS_TOKEN || null;
    
    const tokenStr = String(rawToken);
    if (tokenStr.startsWith("Bearer ")) {
      return tokenStr.substring(7).trim();
    }
    return tokenStr.trim();
  };

  // 1. API: Validate Token and Fetch Current User Profile
  app.get("/api/smartsheet/me", async (req, res) => {
    try {
      const token = getSmartsheetToken(req);
      if (!token) {
        return res.status(401).json({ error: "Smartsheet API Access Token is missing. Please configuration your credentials." });
      }

      const response = await fetch("https://api.smartsheet.com/2.0/users/me", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/json"
        }
      });

      const text = await response.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch (e) {
        return res.status(500).json({ error: `Received non-JSON response from Smartsheet: ${text.substring(0, 200)}` });
      }

      if (!response.ok) {
        return res.status(response.status).json({
          error: data.message || "Failed to validate Smartsheet Access Token.",
          errorCode: data.errorCode,
          refId: data.refId
        });
      }

      return res.json({
        success: true,
        user: data
      });
    } catch (err: any) {
      console.error("Error in /api/smartsheet/me:", err);
      return res.status(500).json({ error: err.message || "Internal Server Error connected to Smartsheet proxy" });
    }
  });

  // 2. API: List Connected Workspaces
  app.get("/api/smartsheet/workspaces", async (req, res) => {
    try {
      const token = getSmartsheetToken(req);
      if (!token) {
        return res.status(401).json({ error: "Smartsheet API Access Token is missing." });
      }

      const response = await fetch("https://api.smartsheet.com/2.0/workspaces?includeAll=true", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/json"
        }
      });

      const text = await response.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch (e) {
        return res.status(500).json({ error: `Received non-JSON response from Smartsheet: ${text.substring(0, 200)}` });
      }

      if (!response.ok) {
        return res.status(response.status).json({
          error: data.message || "Failed to fetch Smartsheet workspaces.",
          errorCode: data.errorCode
        });
      }

      const workspaces = data.data || data || [];
      return res.json({
        success: true,
        workspaces
      });
    } catch (err: any) {
      console.error("Error in /api/smartsheet/workspaces:", err);
      return res.status(500).json({ error: err.message || "Internal Server Error Proxying Workspaces" });
    }
  });

  // 2b. API: Fetch Shares/Members for a Specific Workspace
  app.get("/api/smartsheet/workspaces/:workspaceId/shares", async (req, res) => {
    try {
      const token = getSmartsheetToken(req);
      if (!token) {
        return res.status(401).json({ error: "Smartsheet API Access Token is missing." });
      }

      const { workspaceId } = req.params;
      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required." });
      }

      const response = await fetch(`https://api.smartsheet.com/2.0/workspaces/${workspaceId}/shares?includeAll=true`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/json"
        }
      });

      const text = await response.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch (e) {
        return res.status(500).json({ error: `Received non-JSON response from Smartsheet: ${text.substring(0, 200)}` });
      }

      if (!response.ok) {
        return res.status(response.status).json({
          error: data.message || "Failed to fetch workspace shares.",
          errorCode: data.errorCode
        });
      }

      const shares = data.data || data || [];
      return res.json({
        success: true,
        shares
      });
    } catch (err: any) {
      console.error(`Error in /api/smartsheet/workspaces/${req.params.workspaceId}/shares:`, err);
      return res.status(500).json({ error: err.message || "Internal Server Error Proxying Workspace Shares" });
    }
  });

  // 3. API: Create a New Workspace
  app.post("/api/smartsheet/workspaces", async (req, res) => {
    try {
      const token = getSmartsheetToken(req);
      if (!token) {
        return res.status(401).json({ error: "Smartsheet API Access Token is missing." });
      }

      const { name } = req.body;
      if (!name || !String(name).trim()) {
        return res.status(400).json({ error: "Workspace Name is required." });
      }

      const response = await fetch("https://api.smartsheet.com/2.0/workspaces", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({ name: String(name).trim() })
      });

      const text = await response.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch (e) {
        return res.status(500).json({ error: `Received non-JSON response from Smartsheet: ${text.substring(0, 200)}` });
      }

      if (!response.ok) {
        return res.status(response.status).json({
          error: data.message || "Failed to create Smartsheet workspace.",
          errorCode: data.errorCode,
          refId: data.refId
        });
      }

      const resultWorkspace = data.result || data;
      return res.json({
        success: true,
        workspace: resultWorkspace
      });
    } catch (err: any) {
      console.error("Error in POST /api/smartsheet/workspaces:", err);
      return res.status(500).json({ error: err.message || "Internal Server Error during workspace creation proxy" });
    }
  });

  // 4. API: Check environment configuration
  app.get("/api/config", (req, res) => {
    res.json({
      hasEnvToken: !!process.env.SMARTSHEET_ACCESS_TOKEN,
      fallbackTokenPreview: process.env.SMARTSHEET_ACCESS_TOKEN
        ? `${process.env.SMARTSHEET_ACCESS_TOKEN.substring(0, 4)}...${process.env.SMARTSHEET_ACCESS_TOKEN.substring(process.env.SMARTSHEET_ACCESS_TOKEN.length - 4)}`
        : null
    });
  });

  // Vite development vs production environment static handler
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express and Vite server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Critical server bootstrap failure:", err);
});
