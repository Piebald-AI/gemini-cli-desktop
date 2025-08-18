import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { Routes, Route, Outlet, Navigate } from "react-router-dom";
import { api } from "./lib/api";
import { AppSidebar } from "./components/layout/AppSidebar";
import { MessageInputBar } from "./components/conversation/MessageInputBar";
import { AppHeader } from "./components/layout/AppHeader";
import { CustomTitleBar } from "./components/layout/CustomTitleBar";
import { CliWarnings } from "./components/common/CliWarnings";
import { SidebarInset } from "./components/ui/sidebar";
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
import { CliIO } from "./types";
import "./index.css";

function RootLayoutContent() {
  const [selectedModel, setSelectedModel] =
    useState<string>("gemini-2.5-flash");
  const [cliIOLogs, setCliIOLogs] = useState<CliIO[]>([]);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Use backend context instead of local state
  const { apiConfig } = useApiConfig();
  const { selectedBackend, state: backendState } = useBackend();

  // Set document title based on selected backend
  useEffect(() => {
    const backendText = getBackendText(selectedBackend);
    document.title = backendText.desktopName;
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
    currentConversation,
    conversations,
    selectedModel,
    isCliInstalled,
    updateConversation,
    createNewConversation,
    setActiveConversation,
    setupEventListenerForConversation,
    fetchProcessStatuses,
  });

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

      if (workingDirectory) {
        console.log("Debug - apiConfig:", apiConfig);
        console.log("Debug - selectedBackend:", selectedBackend);

        // Prepare session parameters based on backend type
        const sessionParams: any = {
          sessionId: convId,  // Tauri auto-converts to session_id
          workingDirectory: workingDirectory,  // Tauri auto-converts to working_directory
          model: selectedModel,
        };

        // For Qwen backend, pass full backend_config
        // For Gemini backend, pass geminiAuth with the appropriate configuration
        if (selectedBackend === "qwen") {
          // Always ensure backend_config is set for Qwen to trigger qwen CLI
          sessionParams.backendConfig = {  // Tauri auto-converts to backend_config
            api_key: apiConfig?.api_key || "", // Empty string if OAuth
            base_url: apiConfig?.base_url || "https://openrouter.ai/api/v1",
            model: apiConfig?.model || selectedModel,
          };
        } else if (selectedBackend === "gemini") {
          const geminiConfig = backendState.configs.gemini;
          sessionParams.geminiAuth = {  // Tauri auto-converts to gemini_auth
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

        await api.invoke("start_session", sessionParams);
      }

      await setupEventListenerForConversation(convId);
      return convId;
    },
    [
      selectedModel,
      selectedBackend,
      apiConfig,
      createNewConversation,
      setActiveConversation,
      setupEventListenerForConversation,
    ]
  );

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
        <AppHeader />

        <div className="flex-1 flex flex-col bg-background min-h-0">
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
                status.conversation_id === activeConversation && status.is_alive
            ) && (
              <MessageInputBar
                input={input}
                isCliInstalled={isCliInstalled}
                cliIOLogs={cliIOLogs}
                handleInputChange={handleInputChange}
                handleSendMessage={handleSendMessage}
              />
            )}
        </div>
      </SidebarInset>
    </AppSidebar>
  );
}

function RootLayout() {
  return (
    <BackendProvider>
      <div className="h-screen w-full">
        <CustomTitleBar />
        <div className="h-[calc(100vh-2rem)] w-full">
          <RootLayoutContent />
        </div>
      </div>
    </BackendProvider>
  );
}

function App() {
  return (
    <Routes>
      <Route element={<RootLayout />}>
        <Route index element={<HomeDashboard />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/:id" element={<ProjectDetailPage />} />
        <Route path="mcp" element={<McpServersPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
