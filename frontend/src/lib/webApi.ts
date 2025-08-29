import axios from "axios";
import { API } from "./api";

// Create axios client with base URL /api
const apiClient = axios.create({
  baseURL: "/api",
  timeout: 120000, // Increased to 2 minutes timeout to accommodate slow Gemini startup
});

export interface DirEntry {
  name: string;
  is_directory: boolean;
  full_path: string;
  size?: number;
  modified?: number; // Unix timestamp
  is_symlink?: boolean;
  symlink_target?: string;
  volume_type?:
    | "local_disk"
    | "removable_disk"
    | "network_drive"
    | "cd_drive"
    | "ram_disk"
    | "file_system";
}

interface ProcessStatus {
  conversation_id: string;
  pid: number | null;
  created_at: number;
  is_alive: boolean;
}

// Web API functions that mirror Tauri invoke calls
export const webApi: API = {
  async check_cli_installed() {
    const response = await apiClient.get<boolean>("/check-cli-installed");
    return response.data;
  },

  async start_session(params) {
    await apiClient.post("/start-session", params);
  },

  async send_message(params) {
    await apiClient.post("/send-message", params);
  },

  async get_process_statuses() {
    const response = await apiClient.get<ProcessStatus[]>("/process-statuses");
    return response.data;
  },

  async kill_process(params) {
    await apiClient.post("/kill-process", params);
  },

  async send_tool_call_confirmation_response(params) {
    await apiClient.post("/tool-confirmation", params);
  },

  async execute_confirmed_command(params) {
    const response = await apiClient.post<string>("/execute-command", params);
    return response.data;
  },

  async generate_conversation_title(params) {
    const response = await apiClient.post<string>("/generate-title", params);
    return response.data;
  },

  async validate_directory(params) {
    const response = await apiClient.post<boolean>(
      "/validate-directory",
      params
    );
    return response.data;
  },

  async is_home_directory(params) {
    const response = await apiClient.post<boolean>(
      "/is-home-directory",
      params
    );
    return response.data;
  },

  async get_home_directory() {
    const response = await apiClient.get<string>("/get-home-directory");
    return response.data;
  },

  async get_parent_directory(params) {
    const response = await apiClient.post<string | null>(
      "/get-parent-directory",
      params
    );
    return response.data;
  },

  async list_directory_contents(params) {
    const response = await apiClient.post<DirEntry[]>(
      "/list-directory",
      params
    );
    return response.data;
  },

  async list_files_recursive(params: { path: string }): Promise<DirEntry[]> {
    const response = await apiClient.post<DirEntry[]>(
      "/list-files-recursive",
      params
    );
    return response.data;
  },

  async list_volumes(): Promise<DirEntry[]> {
    const response = await apiClient.get<DirEntry[]>("/list-volumes");
    return response.data;
  },

  async get_git_info(params) {
    const response = await apiClient.post("/get-git-info", params);
    return response.data;
  },

  // Fetch recent chats for web mode via REST endpoint
  async get_recent_chats() {
    const response = await apiClient.get<RecentChat[]>("/recent-chats");
    return response.data;
  },

  // Search across chats for web mode via REST endpoint
  async search_chats(params) {
    const response = await apiClient.post<SearchResult[]>(
      "/search-chats",
      params
    );
    return response.data;
  },

  async list_projects(params) {
    const limit = params?.limit ?? 25;
    const offset = params?.offset ?? 0;
    const response = await apiClient.get<ProjectsResponse>("/projects", {
      params: { limit, offset },
    });
    return response.data;
  },

  async get_project_discussions(params) {
    const response = await apiClient.get<
      {
        id: string;
        title: string;
        started_at_iso?: string;
        message_count?: number;
      }[]
    >("/projects/" + params.projectId + "/discussions");
    return response.data;
  },

  async list_enriched_projects() {
    const response =
      await apiClient.get<EnrichedProject[]>("/projects-enriched");
    return response.data;
  },

  async get_project(params) {
    const response = await apiClient.get<EnrichedProject>("/project", {
      params: {
        sha256: params.sha256,
        external_root_path: params.externalRootPath,
      },
    });
    return response.data;
  },

  async read_file_content(params) {
    const response = await apiClient.post("/read-file-content", params);
    return response.data;
  },
};

export interface RecentChat {
  id: string;
  title: string;
  started_at_iso: string;
  message_count: number;
}

export interface SearchResult {
  chat: RecentChat;
  matches: MessageMatch[];
  relevance_score: number;
}

export interface MessageMatch {
  content_snippet: string;
  line_number: number;
  context_before?: string;
  context_after?: string;
}

export interface SearchFilters {
  date_range?: [string, string]; // ISO strings (start, end)
  project_hash?: string;
  max_results?: number;
}

export interface ProjectListItem {
  id: string;
  title?: string | null;
  status?: "active" | "error" | "unknown";
  createdAt?: string | null;
  updatedAt?: string | null;
  lastActivityAt?: string | null;
  logCount?: number;
}

export interface ProjectsResponse {
  items: ProjectListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface ProjectMetadata {
  path: string;
  sha256: string;
  friendly_name: string;
  first_used?: string;
  updated_at?: string;
}

export interface EnrichedProject {
  sha256: string;
  root_path: string;
  metadata: ProjectMetadata;
}

// WebSocket event types and management
interface WebSocketEvent<T = unknown> {
  event: string;
  payload: T;
  sequence: number;
}

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<(payload: unknown) => void>> = new Map();
  private reconnectTimeout: number | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private isConnecting = false;
  private connectionReadyPromise: Promise<void> | null = null;
  private connectionReadyResolve: (() => void) | null = null;

  constructor() {
    this.connect();
  }

  private connect() {
    if (
      this.isConnecting ||
      (this.ws && this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    this.isConnecting = true;

    // Create a promise that resolves when connection is ready
    this.connectionReadyPromise = new Promise((resolve) => {
      this.connectionReadyResolve = resolve;
    });

    // Use current host for WebSocket connection
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/ws`;

    console.log("🔌 Connecting to WebSocket:", wsUrl);

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log("✅ WebSocket connected");
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }

      // Resolve the connection ready promise
      if (this.connectionReadyResolve) {
        this.connectionReadyResolve();
        this.connectionReadyResolve = null;
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const wsEvent: WebSocketEvent = JSON.parse(event.data);
        console.log("📨 WebSocket event:", wsEvent.event, wsEvent.payload);

        const eventListeners = this.listeners.get(wsEvent.event);
        if (eventListeners) {
          eventListeners.forEach((listener) => {
            try {
              listener(wsEvent.payload);
            } catch (error) {
              console.error("❌ Error in WebSocket event listener:", error);
            }
          });
        }
      } catch (error) {
        console.error("❌ Failed to parse WebSocket message:", error);
      }
    };

    this.ws.onclose = (event) => {
      console.log("❌ WebSocket disconnected:", event.code, event.reason);
      this.isConnecting = false;
      this.ws = null;

      // Attempt to reconnect if not a normal closure
      if (
        event.code !== 1000 &&
        this.reconnectAttempts < this.maxReconnectAttempts
      ) {
        const delay = Math.min(
          1000 * Math.pow(2, this.reconnectAttempts),
          30000
        );
        console.log(
          `🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`
        );

        this.reconnectTimeout = window.setTimeout(() => {
          this.reconnectAttempts++;
          this.connect();
        }, delay);
      } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error("❌ Max reconnection attempts reached");
      }
    };

    this.ws.onerror = (error) => {
      console.error("❌ WebSocket error:", error);
      this.isConnecting = false;
    };
  }

  public async waitForConnection(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    if (this.connectionReadyPromise) {
      return this.connectionReadyPromise;
    }

    // If no promise exists and not connected, wait a bit and retry
    return new Promise((resolve) => {
      const checkConnection = () => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          resolve();
        } else if (this.connectionReadyPromise) {
          this.connectionReadyPromise.then(resolve);
        } else {
          setTimeout(checkConnection, 10);
        }
      };
      checkConnection();
    });
  }

  public listen<T>(event: string, callback: (payload: T) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    const eventListeners = this.listeners.get(event)!;
    // Cast the callback to match the stored type
    const wrappedCallback = (payload: unknown) => callback(payload as T);
    eventListeners.add(wrappedCallback);

    console.log(
      `👂 Added listener for event: ${event} (total: ${eventListeners.size})`
    );

    // Return unsubscribe function
    return () => {
      eventListeners.delete(wrappedCallback);
      if (eventListeners.size === 0) {
        this.listeners.delete(event);
      }
      console.log(`🔇 Removed listener for event: ${event}`);
    };
  }

  public disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnection

    if (this.ws) {
      this.ws.close(1000, "Manual disconnect");
      this.ws = null;
    }

    this.listeners.clear();
    console.log("🔌 WebSocket disconnected manually");
  }
}

// Global WebSocket manager instance
let wsManager: WebSocketManager | null = null;

export function getWebSocketManager(): WebSocketManager {
  if (!wsManager) {
    wsManager = new WebSocketManager();
  }
  return wsManager;
}

// Web event listener function that mimics Tauri's listen
export async function webListen<T>(
  event: string,
  callback: (event: { payload: T }) => void
): Promise<() => void> {
  const manager = getWebSocketManager();
  return manager.listen(event, (payload: T) => {
    callback({ payload });
  });
}
