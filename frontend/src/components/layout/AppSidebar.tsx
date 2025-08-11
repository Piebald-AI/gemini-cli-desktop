import React from "react";
import { ConversationList } from "../conversation/ConversationList";
import {
  Sidebar,
  SidebarContent,
  SidebarProvider,
  SidebarTrigger,
} from "../ui/sidebar";
import type { Conversation, ProcessStatus } from "../../types";

interface AppSidebarProps {
  conversations: Conversation[];
  activeConversation: string | null;
  processStatuses: ProcessStatus[];
  onConversationSelect: (conversationId: string) => void;
  onKillProcess: (conversationId: string) => void;
  onModelChange?: (model: string) => void;
  selectedBackend: string;
  onBackendChange: (backend: string) => void;
  qwenConfig: { apiKey: string; baseUrl: string; model: string };
  onQwenConfigChange: (config: { apiKey: string; baseUrl: string; model: string }) => void;
  useOAuth: boolean;
  onOAuthChange: (useOAuth: boolean) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function AppSidebar({
  conversations,
  activeConversation,
  processStatuses,
  onConversationSelect,
  onKillProcess,
  onModelChange,
  selectedBackend,
  onBackendChange,
  qwenConfig,
  onQwenConfigChange,
  useOAuth,
  onOAuthChange,
  open,
  onOpenChange,
  children,
}: AppSidebarProps) {
  return (
    <SidebarProvider defaultOpen={true} open={open} onOpenChange={onOpenChange}>
      <Sidebar side="left" collapsible="offcanvas">
        <SidebarContent className="p-0">
          <ConversationList
            conversations={conversations}
            activeConversation={activeConversation}
            processStatuses={processStatuses}
            onConversationSelect={onConversationSelect}
            onKillProcess={onKillProcess}
            onModelChange={onModelChange}
            selectedBackend={selectedBackend}
            onBackendChange={onBackendChange}
            qwenConfig={qwenConfig}
            onQwenConfigChange={onQwenConfigChange}
            useOAuth={useOAuth}
            onOAuthChange={onOAuthChange}
          />
        </SidebarContent>
      </Sidebar>
      {children}
    </SidebarProvider>
  );
}

export { SidebarTrigger };
