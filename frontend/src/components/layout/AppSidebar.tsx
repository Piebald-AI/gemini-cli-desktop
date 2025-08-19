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
  open,
  onOpenChange,
  children,
}: AppSidebarProps) {
  return (
    <SidebarProvider
      defaultOpen={true}
      open={open}
      onOpenChange={onOpenChange}
      resizable={true}
    >
      <Sidebar side="left" collapsible="offcanvas">
        <SidebarContent className="p-0">
          <ConversationList
            conversations={conversations}
            activeConversation={activeConversation}
            processStatuses={processStatuses}
            onConversationSelect={onConversationSelect}
            onKillProcess={onKillProcess}
            onModelChange={onModelChange}
          />
        </SidebarContent>
      </Sidebar>
      {children}
    </SidebarProvider>
  );
}

export { SidebarTrigger };
