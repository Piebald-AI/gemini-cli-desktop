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
import { toast } from "sonner";
import { AxiosError } from "axios";

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
  list_files_recursive(params: { path: string }): Promise<DirEntry[]>;
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
  get_git_info(params: { path: string }): Promise<{
    current_directory: string;
    branch: string;
    status: string;
    is_clean: boolean;
    has_uncommitted_changes: boolean;
    has_untracked_files: boolean;
  } | null>;
  read_file_content(params: { path: string }): Promise<{
    path: string;
    content: string | null;
    size: number;
    modified: number | null;
    encoding: string;
    is_text: boolean;
    is_binary: boolean;
    error: string | null;
  }>;
  read_file_content_with_options(params: { path: string; forceText: boolean }): Promise<{
    path: string;
    content: string | null;
    size: number;
    modified: number | null;
    encoding: string;
    is_text: boolean;
    is_binary: boolean;
    error: string | null;
  }>;
  write_file_content(params: { path: string; content: string }): Promise<{
    path: string;
    content: string | null;
    size: number;
    modified: number | null;
    encoding: string;
    is_text: boolean;
    is_binary: boolean;
    error: string | null;
  }>;
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
      return async (args: APIParameters<T>) => {
        try {
          if (__WEB__) {
            const fn = webApi[prop] as (
              args: APIParameters<T>
            ) => APIReturnType<T>;
            return await fn(args);
          } else {
            return await invoke<Awaited<APIReturnType<T>>>(
              prop,
              args as InvokeArgs
            );
          }
        } catch (error) {
          console.error(
            `Error while calling ${prop} with arguments ${args}:`,
            error
          );

          let errorString: string | null = null;

          // With the web version, we're using a server.  So the errors are going to be returned
          // as AxiosError objects.
          if (__WEB__) {
            if (error instanceof AxiosError) {
              // If it has a `response` property, great; we can display a more detailed error.
              if (error.response && error.response.data.error) {
                if (typeof error.response.data.error === "string") {
                  // If it's a `{ error: "<error message>" }`, then it's returned from our server.
                  errorString = error.response.data.error;
                }
                // Otherwise, if it's `{ error: { description: "<error message>" } }`, then it's
                // either a browser or Axios error.
                else if (error.response.data.error.description) {
                  errorString = error.response.data.error.description;
                }
                // Else, we have an error, and we don't know its structure, but we know it's more
                // informative than just the whole error object.
                else {
                  errorString = `${error.response.data.error}`;
                }
              }
              // If it's an AxiosError but has no `response` property, it's a browser error.
              else {
                errorString = error.message;
              }
            }
          }

          // Otherwise, we're running Tauri commands, so whatever we return from the commands
          // will be the error.
          if (!errorString) {
            errorString = `${error}`;
          }

          toast.error(errorString);
          throw error;
        }
      };
    },
  }
);
