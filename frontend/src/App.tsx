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
import { CliWarnings } from "./components/common/CliWarnings";
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
import { useTauriMenu } from "./hooks/useTauriMenu";
import { CliIO } from "./types";
import "./index.css";
import { platform } from "@tauri-apps/plugin-os";
import { AboutDialog } from "./components/common/AboutDialog";

function RootLayoutContent() {
  const [selectedModel, setSelectedModel] =
    useState<string>("gemini-2.5-flash");
  const [cliIOLogs, setCliIOLogs] = useState<CliIO[]>([]);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [directoryPanelOpen, setDirectoryPanelOpen] = useState(false);
  const [workingDirectory, setWorkingDirectory] = useState<string>(".");
  const [sessionWorkingDirectories, setSessionWorkingDirectories] = useState<
    Map<string, string>
  >(new Map());
  const messageInputBarRef = useRef<MessageInputBarRef>(null);

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
    currentConversation,
    setActiveConversation,
    updateConversation,
    createNewConversation,
  } = useConversationManager();

  const { processStatuses, fetchProcessStatuses, handleKillProcess } =
    useProcessManager();

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
    conversations,
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
    if (activeConversation) {
      const sessionWd = sessionWorkingDirectories.get(activeConversation);
      if (sessionWd) {
        console.log(
          "🏠 [App] Using session working directory for",
          activeConversation,
          ":",
          sessionWd
        );
        setWorkingDirectory(sessionWd);
      } else {
        console.log(
          "🏠 [App] No session working directory found, using default"
        );
      }
    }
  }, [activeConversation, sessionWorkingDirectories]);

  const handleConversationSelect = useCallback(
    (conversationId: string) => {
      setActiveConversation(conversationId);
      setupEventListenerForConversation(conversationId);
    },
    [setActiveConversation, setupEventListenerForConversation]
  );

  const handleModelChange = useCallback((model: string) => {
    setSelectedModel(model);
  }, []);

  const startNewConversation = useCallback(
    async (title: string, workingDirectory?: string): Promise<string> => {
      const convId = Date.now().toString();
      createNewConversation(convId, title, [], false);
      setActiveConversation(convId);

      // Store working directory for this session
      if (workingDirectory) {
        console.log(
          "🏠 [App] Storing working directory for session",
          convId,
          ":",
          workingDirectory
        );
        setSessionWorkingDirectories(
          (prev) => new Map(prev.set(convId, workingDirectory))
        );
      }

      if (workingDirectory) {
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

      await setupEventListenerForConversation(convId);
      return convId;
    },
    [
      selectedModel,
      selectedBackend,
      apiConfig,
      backendState.configs.gemini,
      createNewConversation,
      setActiveConversation,
      setupEventListenerForConversation,
      setSessionWorkingDirectories,
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

  // Handle mention insertion from DirectoryPanel
  const handleMentionInsert = useCallback((mention: string) => {
    if (messageInputBarRef.current) {
      messageInputBarRef.current.insertMention(mention);
      // Close the dropdown after inserting the mention
      messageInputBarRef.current.closeDropdown();
    }
  }, []);

  return (
    <AppSidebar
      conversations={conversations}
      activeConversation={activeConversation}
      processStatuses={processStatuses}
      onConversationSelect={handleConversationSelect}
      onKillProcess={handleKillProcess}
      onModelChange={handleModelChange}
      open={sidebarOpen}
      onOpenChange={setSidebarOpen}
    >
      <SidebarInset>
        <AppHeader
          onDirectoryPanelToggle={toggleDirectoryPanel}
          isDirectoryPanelOpen={directoryPanelOpen}
          hasActiveConversation={!!activeConversation}
        />

        <div className="flex-1 flex bg-background min-h-0 h-full">
          {/* Main content area */}
          <div className="flex-1 flex flex-col max-w-full h-full">
            <CliWarnings
              selectedModel={selectedModel}
              isCliInstalled={isCliInstalled}
            />

            <ConversationContext.Provider
              value={useMemo(
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
                  handleConfirmToolCall,
                  confirmationRequests,
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
                  handleConfirmToolCall,
                  confirmationRequests,
                ]
              )}
            >
              <Outlet />
            </ConversationContext.Provider>

            {activeConversation &&
              processStatuses.find(
                (status) =>
                  status.conversation_id === activeConversation &&
                  status.is_alive
              ) && (
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
        </div>
      </SidebarInset>
    </AppSidebar>
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
