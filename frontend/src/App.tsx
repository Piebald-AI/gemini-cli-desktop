import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { Routes, Route, Outlet, Navigate } from "react-router-dom";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { api } from "./lib/api";
import { AppSidebar } from "./components/layout/AppSidebar";
import {
  MessageInputBar,
  MessageInputBarRef,
} from "./components/conversation/MessageInputBar";
import { AppHeader } from "./components/layout/AppHeader";
import { CustomTitleBar } from "./components/layout/CustomTitleBar";
import { DirectoryPanel } from "./components/common/DirectoryPanel";
import { SidebarInset } from "./components/ui/sidebar";
import { Toaster } from "./components/ui/sonner";
import { ConversationContext } from "./contexts/ConversationContext";
import {
  BackendProvider,
  useApiConfig,
  useBackend,
} from "./contexts/BackendContext";
import { getBackendText } from "./utils/backendText";
import { HomeDashboard } from "./pages/HomeDashboard";
import ProjectsPage from "./pages/Projects";
import ProjectDetailPage from "./pages/ProjectDetail";
import { McpServersPage } from "./pages/McpServersPage";

// Hooks
import { useConversationManager } from "./hooks/useConversationManager";
import { useProcessManager } from "./hooks/useProcessManager";
import { useMessageHandler } from "./hooks/useMessageHandler";
import { useToolCallConfirmation } from "./hooks/useToolCallConfirmation";
import { useConversationEvents } from "./hooks/useConversationEvents";
import { useCliInstallation } from "./hooks/useCliInstallation";
import { useSessionProgress } from "./hooks/useSessionProgress";
import { useTauriMenu } from "./hooks/useTauriMenu";
import { CliIO, Conversation, Message } from "./types";
import "./index.css";
import { platform } from "@tauri-apps/plugin-os";
import { AboutDialog } from "./components/common/AboutDialog";

function RootLayoutContent() {
  const { progress, startListeningForSession } = useSessionProgress();

  const [selectedModel, setSelectedModel] =
    useState<string>("gemini-2.5-flash");
  const [cliIOLogs, setCliIOLogs] = useState<CliIO[]>([]);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [directoryPanelOpen, setDirectoryPanelOpen] = useState(false);
  const [workingDirectory, setWorkingDirectory] = useState<string>(".");
  const [isContinuingConversation, setIsContinuingConversation] =
    useState(false);
  const messageInputBarRef = useRef<MessageInputBarRef>(null);
  const listenerCleanups = useRef(new Map<string, () => void>());

  // Get the current working directory (default fallback)
  useEffect(() => {
    const getCurrentWorkingDirectory = async () => {
      console.log("🏠 [App] Initializing default working directory...");
      try {
        const cwd = await api.get_home_directory();
        console.log("🏠 [App] Got home directory from API:", cwd);
        setWorkingDirectory(cwd);
      } catch (error) {
        console.warn(
          "🏠 [App] Failed to get working directory, using current directory:",
          error
        );
        setWorkingDirectory(".");
      }
    };
    getCurrentWorkingDirectory();
  }, []);

  // Use backend context instead of local state
  const { apiConfig } = useApiConfig();
  const { selectedBackend, state: backendState } = useBackend();

  // Set document title based on selected backend
  useEffect(() => {
    const backendText = getBackendText(selectedBackend);
    document.title = backendText.desktopName;

    // Also update native window title on desktop platforms
    if (!__WEB__) {
      getCurrentWindow().setTitle(backendText.desktopName);
    }
  }, [selectedBackend]);

  // Custom hooks for cleaner code
  const isCliInstalled = useCliInstallation(selectedBackend);

  const {
    conversations,
    activeConversation,
    setActiveConversation,
    updateConversation,
    createNewConversation,
    loadConversationFromHistory,
    removeConversation,
  } = useConversationManager();

  const { processStatuses, fetchProcessStatuses, handleKillProcess } =
    useProcessManager();

  const conversationsWithStatus = useMemo(() => {
    return conversations.map((conv) => {
      const processStatus = processStatuses.find(
        (status) =>
          status.conversation_id === conv.id ||
          status.conversation_id === conv.metadata?.timestamp
      );
      return {
        ...conv,
        isActive: processStatus?.is_alive ?? false,
      };
    });
  }, [conversations, processStatuses]);

  const currentConversationWithStatus = useMemo(() => {
    return conversationsWithStatus.find((c) => c.id === activeConversation);
  }, [conversationsWithStatus, activeConversation]);

  const currentConversation = useMemo(() => {
    return currentConversationWithStatus
      ? ({
          ...currentConversationWithStatus,
          isActive: undefined,
        } as unknown as Conversation)
      : undefined;
  }, [currentConversationWithStatus]);

  const {
    confirmationRequests,
    setConfirmationRequests,
    handleConfirmToolCall,
  } = useToolCallConfirmation({
    activeConversation,
    updateConversation,
  });

  const { setupEventListenerForConversation } = useConversationEvents(
    setCliIOLogs,
    setConfirmationRequests,
    updateConversation
  );

  const { input, handleInputChange, handleSendMessage } = useMessageHandler({
    activeConversation,
    conversations: conversationsWithStatus,
    selectedModel,
    isCliInstalled,
    updateConversation,
    createNewConversation,
    setActiveConversation,
    setupEventListenerForConversation,
    fetchProcessStatuses,
  });

  // Update working directory when active conversation changes
  useEffect(() => {
    if (currentConversationWithStatus?.workingDirectory) {
      setWorkingDirectory(currentConversationWithStatus.workingDirectory);
    }
  }, [currentConversationWithStatus]);

  // Progress listener started in startNewConversation

  useEffect(() => {
    const setup = async () => {
      const activeConversations = new Set(
        conversationsWithStatus.map((c) => c.id)
      );
      // Cleanup listeners for deleted conversations
      for (const id of listenerCleanups.current.keys()) {
        if (!activeConversations.has(id)) {
          const cleanup = listenerCleanups.current.get(id);
          if (cleanup) {
            cleanup();
          }
          listenerCleanups.current.delete(id);
        }
      }

      // Add listeners for new conversations
      for (const conversation of conversationsWithStatus) {
        if (!listenerCleanups.current.has(conversation.id)) {
          const cleanup = await setupEventListenerForConversation(
            conversation.id
          );
          listenerCleanups.current.set(conversation.id, cleanup);
        }
      }
    };

    setup();
  }, [conversationsWithStatus, setupEventListenerForConversation]);

  const handleModelChange = useCallback((model: string) => {
    setSelectedModel(model);
  }, []);

  const startNewConversation = useCallback(
    async (
      title: string,
      workingDirectory?: string,
      initialMessages: Message[] = [],
      conversationId?: string
    ): Promise<string> => {
      const convId = conversationId || Date.now().toString();
      createNewConversation(
        convId,
        title,
        initialMessages,
        false,
        workingDirectory
      );
      setActiveConversation(convId);

      if (workingDirectory) {
        // Start listening for progress before starting the session
        await startListeningForSession(convId);
        console.log(
          "🔄 [APP] Started listening for session progress: ",
          convId
        );

        console.log("Debug - apiConfig:", apiConfig);
        console.log("Debug - selectedBackend:", selectedBackend);

        let backendConfig;
        let geminiAuth;

        // For Qwen backend, pass full backend_config
        // For Gemini backend, pass geminiAuth with the appropriate configuration
        if (selectedBackend === "qwen") {
          // Always ensure backend_config is set for Qwen to trigger qwen CLI
          backendConfig = {
            // Tauri auto-converts to backend_config
            api_key: apiConfig?.api_key || "", // Empty string if OAuth
            base_url: apiConfig?.base_url || "https://openrouter.ai/api/v1",
            model: apiConfig?.model || selectedModel,
          };
        } else if (selectedBackend === "gemini") {
          const geminiConfig = backendState.configs.gemini;
          geminiAuth = {
            // Tauri auto-converts to gemini_auth
            method: geminiConfig.authMethod,
            api_key:
              geminiConfig.authMethod === "gemini-api-key"
                ? geminiConfig.apiKey
                : undefined,
            vertex_project:
              geminiConfig.authMethod === "vertex-ai"
                ? geminiConfig.vertexProject
                : undefined,
            vertex_location:
              geminiConfig.authMethod === "vertex-ai"
                ? geminiConfig.vertexLocation
                : undefined,
          };
        }

        await api.start_session({
          sessionId: convId,
          workingDirectory,
          model: selectedModel,
          backendConfig,
          geminiAuth,
        });
      }

      return convId;
    },
    [
      selectedModel,
      selectedBackend,
      apiConfig,
      backendState.configs.gemini,
      createNewConversation,
      setActiveConversation,
      startListeningForSession,
    ]
  );

  const toggleDirectoryPanel = useCallback(() => {
    setDirectoryPanelOpen((prev) => !prev);
  }, []);

  // Auto-close directory panel when active conversation ends
  useEffect(() => {
    if (!activeConversation && directoryPanelOpen) {
      setDirectoryPanelOpen(false);
    }
  }, [activeConversation, directoryPanelOpen]);

  const handleContinueConversation = useCallback(
    async (conversationToContinue: Conversation) => {
      if (!conversationToContinue || isContinuingConversation) return;

      setIsContinuingConversation(true);
      try {
        const newTitle = `(Continued) ${conversationToContinue.title}`;

        await startNewConversation(
          newTitle,
          conversationToContinue.workingDirectory,
          conversationToContinue.messages
        );
      } finally {
        setIsContinuingConversation(false);
      }
    },
    [startNewConversation, isContinuingConversation]
  );

  // Handle mention insertion from DirectoryPanel
  const handleMentionInsert = useCallback((mention: string) => {
    if (messageInputBarRef.current) {
      messageInputBarRef.current.insertMention(mention);
      // Close the dropdown after inserting the mention
      messageInputBarRef.current.closeDropdown();
    }
  }, []);

  // Conversation context with progress
  const contextValue = useMemo(
    () => ({
      conversations,
      activeConversation,
      currentConversation,
      input,
      isCliInstalled,
      messagesContainerRef,
      cliIOLogs,
      handleInputChange,
      handleSendMessage,
      selectedModel,
      startNewConversation,
      loadConversationFromHistory,
      handleConfirmToolCall,
      confirmationRequests,
      removeConversation,
      progress,
    }),
    [
      conversations,
      activeConversation,
      currentConversation,
      input,
      isCliInstalled,
      messagesContainerRef,
      cliIOLogs,
      handleInputChange,
      handleSendMessage,
      selectedModel,
      startNewConversation,
      loadConversationFromHistory,
      handleConfirmToolCall,
      confirmationRequests,
      removeConversation,
      progress,
    ]
  );

  return (
    <ConversationContext.Provider value={contextValue}>
      <AppSidebar
        conversations={conversationsWithStatus}
        activeConversation={activeConversation}
        processStatuses={processStatuses}
        onConversationSelect={setActiveConversation}
        onKillProcess={handleKillProcess}
        onRemoveConversation={removeConversation}
        onModelChange={handleModelChange}
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
      >
        <SidebarInset>
          <AppHeader
            onDirectoryPanelToggle={toggleDirectoryPanel}
            isDirectoryPanelOpen={directoryPanelOpen}
            hasActiveConversation={!!activeConversation}
            onReturnToDashboard={() => setActiveConversation(null)}
          />
          <div className="flex flex-col h-full">
            <Outlet context={{ workingDirectory }} />
            {currentConversationWithStatus && (
              <>
                {console.log(
                  "📝 [App] Rendering MessageInputBar with workingDirectory:",
                  workingDirectory
                )}
                <MessageInputBar
                  ref={messageInputBarRef}
                  input={input}
                  isCliInstalled={isCliInstalled}
                  cliIOLogs={cliIOLogs}
                  handleInputChange={handleInputChange}
                  handleSendMessage={handleSendMessage}
                  workingDirectory={workingDirectory}
                  isConversationActive={currentConversationWithStatus.isActive}
                  onContinueConversation={() =>
                    handleContinueConversation(currentConversationWithStatus)
                  }
                  isContinuingConversation={isContinuingConversation}
                  isNew={currentConversationWithStatus.isNew}
                  isStreaming={currentConversationWithStatus.isStreaming}
                />
              </>
            )}
          </div>

          {/* Directory Panel */}
          {directoryPanelOpen && activeConversation && (
            <DirectoryPanel
              workingDirectory={workingDirectory}
              onDirectoryChange={(path) => {
                console.log("📁 [App] Directory changed to:", path);
                // Optionally update working directory or perform other actions
              }}
              onMentionInsert={handleMentionInsert}
              className="w-80 flex-shrink-0"
            />
          )}
        </SidebarInset>
      </AppSidebar>
    </ConversationContext.Provider>
  );
}

function RootLayoutInner() {
  // Set up Tauri menu for non-Windows desktop platforms
  const { isAboutDialogOpen, setIsAboutDialogOpen } = useTauriMenu();

  return (
    <div className="h-screen w-full">
      <CustomTitleBar />
      <div className="size-full">
        <RootLayoutContent />
      </div>

      {/* About Dialog for non-Windows platforms using Tauri menu */}
      {!__WEB__ && platform() !== "windows" && (
        <AboutDialog
          open={isAboutDialogOpen}
          onOpenChange={setIsAboutDialogOpen}
        />
      )}
    </div>
  );
}

function RootLayout() {
  return (
    <BackendProvider>
      <RootLayoutInner />
    </BackendProvider>
  );
}

function App() {
  return (
    <>
      <Routes>
        <Route element={<RootLayout />}>
          <Route index element={<HomeDashboard />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:id" element={<ProjectDetailPage />} />
          <Route path="mcp" element={<McpServersPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <Toaster richColors />
    </>
  );
}

export default App;
