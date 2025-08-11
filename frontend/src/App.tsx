import { useState, useRef, useCallback, useEffect } from "react";
import { Routes, Route, Outlet, Navigate } from "react-router-dom";
import { api } from "./lib/api";
import { AppSidebar } from "./components/layout/AppSidebar";
import { MessageInputBar } from "./components/conversation/MessageInputBar";
import { AppHeader } from "./components/layout/AppHeader";
import { CliWarnings } from "./components/common/CliWarnings";
import { SidebarInset } from "./components/ui/sidebar";
import { ConversationContext } from "./contexts/ConversationContext";
import { BackendProvider } from "./contexts/BackendContext";
import { HomeDashboard } from "./pages/HomeDashboard";
import ProjectsPage from "./pages/Projects";
import ProjectDetailPage from "./pages/ProjectDetail";

// Hooks
import { useConversationManager } from "./hooks/useConversationManager";
import { useProcessManager } from "./hooks/useProcessManager";
import { useMessageHandler } from "./hooks/useMessageHandler";
import { useToolCallConfirmation } from "./hooks/useToolCallConfirmation";
import { useConversationEvents } from "./hooks/useConversationEvents";
import { useCliInstallation } from "./hooks/useCliInstallation";
import { CliIO } from "./types";
import "./index.css";

function RootLayout() {
  const [selectedModel, setSelectedModel] =
    useState<string>("gemini-2.5-flash");
  const [selectedBackend, setSelectedBackend] = useState<string>("gemini");
  const [qwenConfig, setQwenConfig] = useState({
    apiKey: "",
    baseUrl: "",
    model: ""
  });
  const [useOAuth, setUseOAuth] = useState<boolean>(false);
  const [cliIOLogs, setCliIOLogs] = useState<CliIO[]>([]);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Load settings from localStorage on component mount
  useEffect(() => {
    try {
      const savedBackend = localStorage.getItem('gemini-desktop-backend');
      const savedQwenConfig = localStorage.getItem('gemini-desktop-qwen-config');
      const savedOAuth = localStorage.getItem('gemini-desktop-use-oauth');
      
      if (savedBackend) {
        setSelectedBackend(savedBackend);
      }
      
      if (savedQwenConfig) {
        const parsedConfig = JSON.parse(savedQwenConfig);
        setQwenConfig(parsedConfig);
      }
      
      if (savedOAuth !== null) {
        setUseOAuth(savedOAuth === 'true');
      }
    } catch (error) {
      console.warn('Failed to load settings from localStorage:', error);
    }
  }, []);

  // Custom hooks for cleaner code
  const isCliInstalled = useCliInstallation();

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

  const handleBackendChange = useCallback((backend: string) => {
    setSelectedBackend(backend);
    try {
      localStorage.setItem('gemini-desktop-backend', backend);
    } catch (error) {
      console.warn('Failed to save backend to localStorage:', error);
    }
  }, []);

  const handleQwenConfigChange = useCallback((config: { apiKey: string; baseUrl: string; model: string }) => {
    setQwenConfig(config);
    try {
      localStorage.setItem('gemini-desktop-qwen-config', JSON.stringify(config));
    } catch (error) {
      console.warn('Failed to save Qwen config to localStorage:', error);
    }
  }, []);

  const handleOAuthChange = useCallback((useOAuth: boolean) => {
    setUseOAuth(useOAuth);
    try {
      localStorage.setItem('gemini-desktop-use-oauth', useOAuth.toString());
    } catch (error) {
      console.warn('Failed to save OAuth setting to localStorage:', error);
    }
  }, []);

  const startNewConversation = useCallback(
    async (title: string, workingDirectory?: string): Promise<string> => {
      const convId = Date.now().toString();
      createNewConversation(convId, title, [], false);
      setActiveConversation(convId);

      if (workingDirectory) {
        const backendConfig = selectedBackend === "qwen" ? {
          api_key: qwenConfig.apiKey,
          base_url: qwenConfig.baseUrl,
          model: qwenConfig.model
        } : null;

        console.log("Debug - selectedBackend:", selectedBackend);
        console.log("Debug - qwenConfig:", qwenConfig);
        console.log("Debug - backendConfig:", backendConfig);

        await api.invoke("start_session", {
          sessionId: convId,
          workingDirectory,
          model: selectedModel,
          backendConfig,
        });
      }

      await setupEventListenerForConversation(convId);
      return convId;
    },
    [
      selectedModel,
      selectedBackend,
      qwenConfig,
      createNewConversation,
      setActiveConversation,
      setupEventListenerForConversation,
    ]
  );

  return (
    <BackendProvider selectedBackend={selectedBackend}>
      <AppSidebar
        conversations={conversations}
        activeConversation={activeConversation}
        processStatuses={processStatuses}
        onConversationSelect={handleConversationSelect}
        onKillProcess={handleKillProcess}
        onModelChange={handleModelChange}
        selectedBackend={selectedBackend}
        onBackendChange={handleBackendChange}
        qwenConfig={qwenConfig}
        onQwenConfigChange={handleQwenConfigChange}
        useOAuth={useOAuth}
        onOAuthChange={handleOAuthChange}
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
            value={{
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
            }}
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
