import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { webApi, webListen } from "./webApi";
import { toast } from "sonner";

declare global {
  interface Window {
    pendingToolCallInput?: string;
  }
}

// Abstraction layer for API calls
export const api = {
  async invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
    try {
      if (__WEB__) {
        switch (command) {
          case "check_cli_installed":
            return (await webApi.check_cli_installed()) as T;
          case "send_message":
            if (!args) throw new Error("Missing arguments for send_message");
            return await webApi.send_message(
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
            ) as T;
          case "get_process_statuses":
            return (await webApi.get_process_statuses()) as T;
          case "kill_process":
            if (!args) throw new Error("Missing arguments for kill_process");
            return await webApi.kill_process(
              args as { conversationId: string }
            ) as T;
          case "send_tool_call_confirmation_response":
            if (!args)
              throw new Error(
                "Missing arguments for send_tool_call_confirmation_response"
              );
            return await webApi.send_tool_call_confirmation_response(
              args as {
                sessionId: string;
                requestId: number;
                toolCallId: string;
                outcome: string;
              }
            ) as T;
          case "execute_confirmed_command":
            if (!args)
              throw new Error(
                "Missing arguments for execute_confirmed_command"
              );
            return await webApi.execute_confirmed_command(
              args as unknown as string
            ) as T;
          case "generate_conversation_title":
            if (!args)
              throw new Error(
                "Missing arguments for generate_conversation_title"
              );
            return await webApi.generate_conversation_title(
              args as { message: string; model?: string }
            ) as T;
          case "validate_directory":
            if (!args)
              throw new Error("Missing arguments for validate_directory");
            return await webApi.validate_directory(args as unknown as string) as T;
          case "is_home_directory":
            if (!args)
              throw new Error("Missing arguments for is_home_directory");
            return await webApi.is_home_directory(args as unknown as string) as T;
          case "get_home_directory":
            return (await webApi.get_home_directory()) as T;
          case "get_parent_directory":
            if (!args)
              throw new Error("Missing arguments for get_parent_directory");
            return await webApi.get_parent_directory(args as unknown as string) as T;
          case "list_directory_contents":
            if (!args)
              throw new Error("Missing arguments for list_directory_contents");
            return await webApi.list_directory_contents(
              args as unknown as string
            ) as T;
          case "list_volumes":
            return await webApi.list_volumes() as T;
          case "list_projects":
            return await webApi.list_projects(args) as T;
          case "get_project_discussions":
            if (!args)
              throw new Error("Missing arguments for get_project_discussions");
            return await webApi.get_project_discussions(
              args as unknown as string
            ) as T;
          case "list_enriched_projects":
            return await webApi.list_projects_enriched() as T;
          case "get_project":
            if (!args) throw new Error("Missing arguments for get_project");
            return await webApi.get_project(
              args as { sha256: string; externalRootPath: string }
            ) as T;
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
            };
            return await webApi.start_session(
              sessionArgs.sessionId,
              sessionArgs.workingDirectory,
              sessionArgs.model,
              sessionArgs.backendConfig
            ) as T;
          }
          default:
            throw new Error(`Unknown command: ${command}`);
        }
      } else {
        console.log("command", command);
        return await invoke<T>(command, args);
      }
    } catch (error:
      | unknown
      | { error: string }
      | { response: { data: { error: string } } }) {
      let e;
      if (error && typeof error === "object") {
        if ("error" in error && typeof error.error === "string") {
          e = error.error;
        } else if ("response" in error && error.response) {
          e = error.response.data.error;
        }
      } else {
        e = error;
      }
      console.error(e);
      toast.error(e);
      throw error;
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
