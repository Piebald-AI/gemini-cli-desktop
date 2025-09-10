import React from "react";
import { ConversationList } from "../conversation/ConversationList";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
} from "../ui/sidebar";
import { Settings as SettingsIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Conversation, ProcessStatus } from "../../types";

interface AppSidebarProps {
  conversations: Conversation[];
  activeConversation: string | null;
  processStatuses: ProcessStatus[];
  onConversationSelect: (conversationId: string) => void;
  onKillProcess: (conversationId: string) => void;
  onModelChange?: (model: string) => void;
  onRemoveConversation: (id: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  onOpenSearch?: () => void;
}

export function AppSidebar({
  conversations,
  activeConversation,
  processStatuses,
  onConversationSelect,
  onKillProcess,
  onModelChange,
  onRemoveConversation,
  open,
  onOpenChange,
  children,
  onOpenSearch,
}: AppSidebarProps) {
  const { t } = useTranslation();
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
            onRemoveConversation={onRemoveConversation}
            onOpenSearch={onOpenSearch}
          />
        </SidebarContent>
        <SidebarFooter className="mt-auto p-2 border-t border-sidebar-border shrink-0 h-22">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("app:open-settings"))}
            className="w-full text-left text-sm text-muted-foreground hover:text-foreground flex items-center gap-2 px-2 py-2 rounded-md hover:bg-sidebar-accent"
          >
            <SettingsIcon className="h-4 w-4" />
            {t("common.settings")}
          </button>
        </SidebarFooter>
      </Sidebar>
      {children}
    </SidebarProvider>
  );
}

export { SidebarTrigger };
