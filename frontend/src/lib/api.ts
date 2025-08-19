import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { webApi, webListen } from "./webApi";

declare global {
  interface Window {
    pendingToolCallInput?: string;
  }
}

// Type definitions for API command arguments
interface GenerateConversationTitleArgs {
  message: string;
  model?: string;
}

// Type guard functions
function isStringArg(args: unknown): args is string {
  return typeof args === 'string';
}

// Removed unused type guards

function isGenerateConversationTitleArgs(args: unknown): args is GenerateConversationTitleArgs {
  return typeof args === 'object' && args !== null && 'message' in args;
}

// Abstraction layer for API calls
export const api = {
  async invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
    if (__WEB__) {
      switch (command) {
        case "check_cli_installed":
          return webApi.check_cli_installed() as Promise<T>;
        case "send_message":
          if (!args) throw new Error("Missing arguments for send_message");
          return webApi.send_message(
            args as {
              sessionId: string;
              message: string;
              conversationHistory: string;
              model?: string;
              backendConfig?: {
                api_key: string;
                base_url: string;
                model: string;
              };
            }
          ) as Promise<T>;
        case "get_process_statuses":
          return webApi.get_process_statuses() as Promise<T>;
        case "kill_process":
          if (!args) throw new Error("Missing arguments for kill_process");
          return webApi.kill_process(
            args as { conversationId: string }
          ) as Promise<T>;
        case "send_tool_call_confirmation_response":
          if (!args)
            throw new Error(
              "Missing arguments for send_tool_call_confirmation_response"
            );
          return webApi.send_tool_call_confirmation_response(
            args as {
              sessionId: string;
              requestId: number;
              toolCallId: string;
              outcome: string;
            }
          ) as Promise<T>;
        case "execute_confirmed_command":
          if (!args)
            throw new Error("Missing arguments for execute_confirmed_command");
          if (!isStringArg(args))
            throw new Error("execute_confirmed_command expects string argument");
          return webApi.execute_confirmed_command(args) as Promise<T>;
        case "generate_conversation_title":
          if (!args)
            throw new Error(
              "Missing arguments for generate_conversation_title"
            );
          if (!isGenerateConversationTitleArgs(args))
            throw new Error("generate_conversation_title expects object with message property");
          return webApi.generate_conversation_title(args) as Promise<T>;
        case "validate_directory":
          if (!args)
            throw new Error("Missing arguments for validate_directory");
          if (!isStringArg(args))
            throw new Error("validate_directory expects string argument");
          return webApi.validate_directory(args) as Promise<T>;
        case "is_home_directory":
          if (!args) throw new Error("Missing arguments for is_home_directory");
          if (!isStringArg(args))
            throw new Error("is_home_directory expects string argument");
          return webApi.is_home_directory(args) as Promise<T>;
        case "get_home_directory":
          return webApi.get_home_directory() as Promise<T>;
        case "get_parent_directory":
          if (!args)
            throw new Error("Missing arguments for get_parent_directory");
          if (!isStringArg(args))
            throw new Error("get_parent_directory expects string argument");
          return webApi.get_parent_directory(args) as Promise<T>;
        case "list_directory_contents":
          if (!args)
            throw new Error("Missing arguments for list_directory_contents");
          if (!isStringArg(args))
            throw new Error("list_directory_contents expects string argument");
          return webApi.list_directory_contents(args) as Promise<T>;
        case "list_volumes":
          return webApi.list_volumes() as Promise<T>;
        case "list_projects":
          return webApi.list_projects(args) as Promise<T>;
        case "get_project_discussions":
          if (!args)
            throw new Error("Missing arguments for get_project_discussions");
          if (!isStringArg(args))
            throw new Error("get_project_discussions expects string argument");
          return webApi.get_project_discussions(args) as Promise<T>;
        case "list_enriched_projects":
          return webApi.list_projects_enriched() as Promise<T>;
        case "get_project":
          if (!args) throw new Error("Missing arguments for get_project");
          return webApi.get_project(
            args as { sha256: string; externalRootPath: string }
          ) as Promise<T>;
        case "start_session": {
          if (!args) throw new Error("Missing arguments for start_session");
          const sessionArgs = args as {
            sessionId: string;
            workingDirectory: string;
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
          };
          return webApi.start_session(
            sessionArgs.sessionId,
            sessionArgs.workingDirectory,
            sessionArgs.model,
            sessionArgs.backendConfig,
            sessionArgs.geminiAuth
          ) as Promise<T>;
        }
        default:
          throw new Error(`Unknown command: ${command}`);
      }
    } else {
      return invoke<T>(command, args);
    }
  },

  async listen<T>(
    event: string,
    callback: (event: { payload: T }) => void
  ): Promise<() => void> {
    if (__WEB__) {
      return webListen<T>(event, callback);
    } else {
      return listen<T>(event, callback);
    }
  },
};
