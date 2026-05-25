// src/lib/smartsheet.ts

export const fetchSmartsheet = async (
  path: string,
  token: string,
  options: { method?: string; body?: any } = {}
) => {
  const method = options.method || "GET";
  
  // Clean path to form full local proxy URL
  const cleanPath = path.replace(/^\/?api\/smartsheet\/?/, "").replace(/^\//, "");
  const proxyUrl = `/api/smartsheet/${cleanPath}`;

  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 6000); // Fail fast to try direct connection

    const response = await fetch(proxyUrl, {
      method,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "x-smartsheet-token": token,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal
    });

    clearTimeout(id);

    const contentType = response.headers.get("content-type") || "";
    // If Express/Cloud Run proxy returns 404/502/504, or the single-page routing returns html instead of json
    if (
      response.status === 404 ||
      response.status === 502 ||
      response.status === 504 ||
      contentType.toLowerCase().includes("text/html")
    ) {
      throw new Error("PROXY_NOT_FOUND");
    }

    return response;
  } catch (err: any) {
    console.warn("Express proxy unavailable, falling back to direct client-side Smartsheet API request: ", err.message || err);

    let directUrl = "";
    if (cleanPath === "me" || cleanPath === "users/me") {
      directUrl = "https://api.smartsheet.com/2.0/users/me";
    } else if (cleanPath.startsWith("workspaces") && cleanPath.endsWith("shares")) {
      const match = cleanPath.match(/workspaces\/(\d+)\/shares/);
      const wsId = match ? match[1] : "";
      directUrl = `https://api.smartsheet.com/2.0/workspaces/${wsId}/shares?includeAll=true`;
    } else if (cleanPath === "workspaces") {
      // For workspace creation/POST we don't want to append query params if method is POST
      const isPost = method.toUpperCase() === "POST";
      directUrl = `https://api.smartsheet.com/2.0/workspaces${isPost ? "" : "?includeAll=true"}`;
    } else {
      directUrl = `https://api.smartsheet.com/2.0/${cleanPath}`;
    }

    // Direct fetch (Bypassing CORS since Smartsheet's API supports requests from any domain with Authorization header)
    return fetch(directUrl, {
      method,
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
  }
};
