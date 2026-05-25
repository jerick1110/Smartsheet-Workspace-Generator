export interface SmartsheetUser {
  id: number;
  email: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  locale?: string;
  timezone?: string;
  status?: string;
}

export interface Workspace {
  id: number;
  name: string;
  permalink?: string;
  accessLevel?: string;
  shares?: WorkspaceShare[]; // Dynamic optional cached list of members
  isLoadingShares?: boolean;
}

export interface WorkspaceShare {
  id: string; // Share ID
  name: string; // Member name or group name
  email?: string; // Member email
  type: string; // "USER" or "GROUP"
  accessLevel: string; // "OWNER" | "ADMIN" | "EDITOR" | "EDITOR_SHARE" | "VIEWER" | "VIEWER_SHARE"
}

export interface WorkspaceCreationLog {
  id: string; // Unique index
  name: string; // Desired name
  status: "idle" | "pending" | "success" | "error";
  responseId?: number;
  responsePermalink?: string;
  accessLevel?: string;
  errorMessage?: string;
}

export interface PythonScript {
  code: string;
  filename: string;
}
