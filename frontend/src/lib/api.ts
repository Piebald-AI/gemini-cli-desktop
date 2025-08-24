import { invoke, InvokeArgs } from "@tauri-apps/api/core";
import {
  DirEntry,
  EnrichedProject,
  ProjectsResponse,
  RecentChat,
  SearchFilters,
  SearchResult,
  webApi,
} from "./webApi";
import { ProcessStatus } from "@/types";

declare global {
  interface Window {
    pendingToolCallInput?: string;
  }
}

export interface API {
  check_cli_installed(): Promise<boolean>;
  start_session(params: {
    sessionId: string;
    workingDirectory?: string;
    model?: string;
    backendConfig?: {
      api_key: string;
      base_url: string;
      model: string;
    };
    geminiAuth?: {
      method: string;
      api_key?: string;
      vertex_project?: string;
      vertex_location?: string;
    };
  }): Promise<void>;
  send_message(params: {
    sessionId: string;
    message: string;
    conversationHistory: string;
    model?: string;
    backendConfig?: {
      api_key: string;
      base_url: string;
      model: string;
    };
  }): Promise<void>;
  get_process_statuses(): Promise<ProcessStatus[]>;
  kill_process(params: { conversationId: string }): Promise<void>;
  send_tool_call_confirmation_response(params: {
    sessionId: string;
    requestId: number;
    toolCallId: string;
    outcome: string;
  }): Promise<void>;
  execute_confirmed_command(params: { command: string }): Promise<string>;
  generate_conversation_title(params: {
    message: string;
    model?: string;
  }): Promise<string>;
  validate_directory(params: { path: string }): Promise<boolean>;
  is_home_directory(params: { path: string }): Promise<boolean>;
  get_home_directory(): Promise<string>;
  get_parent_directory(params: { path: string }): Promise<string | null>;
  list_directory_contents(params: { path: string }): Promise<DirEntry[]>;
  list_volumes(): Promise<DirEntry[]>;
  get_recent_chats(): Promise<RecentChat[]>;
  search_chats(params: {
    query: string;
    filters?: SearchFilters;
  }): Promise<SearchResult[]>;
  list_projects(params?: {
    limit?: number;
    offset?: number;
  }): Promise<ProjectsResponse>;
  get_project_discussions(params: { projectId: string }): Promise<
    {
      id: string;
      title: string;
      started_at_iso?: string;
      message_count?: number;
    }[]
  >;
  list_enriched_projects(): Promise<EnrichedProject[]>;
  get_project(params: {
    sha256: string;
    externalRootPath: string;
  }): Promise<EnrichedProject>;
}

export type APICommand = keyof API;

type APIMethod<T extends APICommand> = API[T];
type APIParameters<T extends APICommand> = API[T] extends (
  ...args: infer P
) => ReturnType<APIMethod<T>>
  ? P
  : never;
type APIReturnType<T extends APICommand> = API[T] extends (
  ...args: APIParameters<T>
) => ReturnType<APIMethod<T>>
  ? ReturnType<APIMethod<T>>
  : never;

export const api = new Proxy(
  {} as {
    [K in APICommand]: (...args: APIParameters<K>) => APIReturnType<K>;
  },
  {
    get<T extends APICommand>(_target: unknown, prop: T) {
      return (args: APIParameters<T>) => {
        if (__WEB__) {
          const fn = webApi[prop] as (
            args: APIParameters<T>
          ) => APIReturnType<T>;
          return fn(args);
        } else {
          return invoke<Awaited<APIReturnType<T>>>(prop, args as InvokeArgs);
        }
      };
    },
  }
);
