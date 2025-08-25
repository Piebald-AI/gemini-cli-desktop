import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useConversation } from "../contexts/ConversationContext";
import { MessageContent } from "../components/conversation/MessageContent";
import { ThinkingBlock } from "../components/conversation/ThinkingBlock";
import { ToolCallDisplay } from "../components/common/ToolCallDisplay";
import { SmartLogo } from "../components/branding/SmartLogo";
import { SmartLogoCenter } from "../components/branding/SmartLogoCenter";
import { DesktopText } from "../components/branding/DesktopText";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../components/ui/card";
import { Info, UserRound, FolderKanban } from "lucide-react";
import { ModelContextProtocol } from "../components/common/ModelContextProtocol";
import { ToolCallConfirmationRequest } from "../utils/toolCallParser";
import { getBackendText } from "../utils/backendText";
import { useBackend } from "../contexts/BackendContext";

export const HomeDashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    currentConversation,
    messagesContainerRef,
    handleConfirmToolCall,
    confirmationRequests,
  } = useConversation();

  const { selectedBackend } = useBackend();
  const backendText = getBackendText(selectedBackend);

  return (
    <>
      {currentConversation ? (
        <div
          ref={messagesContainerRef as React.RefObject<HTMLDivElement>}
          className="flex-1 min-h-0 overflow-y-auto p-6 relative"
        >
          <div className="space-y-8 pb-4 max-w-4xl mx-auto">
            {currentConversation.messages.map((message, index) => (
              <div
                key={message.id}
                className={`w-full ${
                  message.sender === "user" ? "flex justify-start" : ""
                }`}
              >
                <div className="w-full">
                  {/* Header with logo and timestamp */}
                  <div className="flex items-center gap-2 mb-4">
                    {message.sender === "assistant" ? (
                      <div>
                        <SmartLogo />
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center gap-2">
                          <div
                            className="size-5.5 flex items-center justify-center overflow-hidden rounded-full"
                            style={{
                              background:
                                "radial-gradient(circle, #346bf1 0%, #3186ff 50%, #4fa0ff 100%)",
                            }}
                          >
                            <UserRound className="size-4" />
                          </div>
                          {t("dashboard.user")}
                        </div>
                      </div>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {message.timestamp.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  {message.parts.map((msgPart) =>
                    msgPart.type === "thinking" ? (
                      <ThinkingBlock thinking={msgPart.thinking} />
                    ) : msgPart.type === "text" ? (
                      /* Message Content */
                      <div className="text-sm text-gray-900 dark:text-gray-100 mb-2">
                        <MessageContent
                          content={msgPart.text}
                          sender={message.sender}
                          isStreaming={
                            currentConversation?.isStreaming &&
                            index === currentConversation.messages.length - 1
                          }
                        />
                      </div>
                    ) : msgPart.type === "toolCall" ? (
                      <>
                        {(() => {
                          const hasConfirmation = confirmationRequests.has(
                            msgPart.toolCall.id
                          );
                          const confirmationRequest = confirmationRequests.get(
                            msgPart.toolCall.id
                          );

                          // Force type assertion to debug the issue
                          const confirmationRequestTyped =
                            confirmationRequest as
                              | ToolCallConfirmationRequest
                              | undefined;
                          console.log(
                            "Confirmation request typed:",
                            confirmationRequestTyped
                          );

                          // Try with explicit undefined check
                          const finalConfirmationRequest = confirmationRequest
                            ? confirmationRequest
                            : undefined;

                          return (
                            <ToolCallDisplay
                              key={`${msgPart.toolCall.id}-${hasConfirmation}-${Date.now()}`}
                              toolCall={msgPart.toolCall}
                              hasConfirmationRequest={hasConfirmation}
                              confirmationRequest={finalConfirmationRequest}
                              confirmationRequests={confirmationRequests}
                              onConfirm={handleConfirmToolCall}
                            />
                          );
                        })()}
                      </>
                    ) : null
                  )}

                  {currentConversation.isStreaming &&
                    index === currentConversation.messages.length - 1 &&
                    message.parts.some(
                      (part) => part.type === "text" || part.type === "thinking"
                    ) && (
                      <div className="text-gray-400 italic text-xs">
                        <span className="animate-pulse">●</span>{" "}
                        {t("dashboard.generating")}
                      </div>
                    )}

                  {/* Info button for raw JSON */}
                  <div className="mt-2 flex justify-start">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <Info className="h-3 w-3 mr-1" />
                          {t("dashboard.rawJsonButton")}
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>
                            {t("dashboard.rawJsonTitle")}
                          </DialogTitle>
                        </DialogHeader>
                        <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                          <pre className="text-xs whitespace-pre-wrap break-all font-mono">
                            {JSON.stringify(message, null, 2)}
                          </pre>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
          <div className="flex flex-row items-center mb-4 gap-2">
            <SmartLogoCenter />
            <DesktopText size="large" />
          </div>

          <p className="text-muted-foreground mb-6">
            {backendText.tagline}
          </p>

          {/* Dashboard tiles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-3xl">
            {/* Projects Card */}
            <Card
              className="cursor-pointer transition-colors hover:bg-accent w-full"
              onClick={() => navigate("/projects")}
            >
              <CardHeader className="flex flex-row items-center gap-3">
                <div className="shrink-0 h-6 w-6 flex items-center justify-center">
                  <FolderKanban className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="text-left">
                  <CardTitle className="text-base">
                    {t("dashboard.projectsCard.title")}
                  </CardTitle>
                  <CardDescription>
                    {t("dashboard.projectsCard.description")}
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>
            <Card
              className="cursor-pointer transition-colors hover:bg-accent w-full"
              onClick={() => navigate("/mcp")}
            >
              <CardHeader className="flex flex-row items-center gap-3">
                <div className="shrink-0 h-6 w-6 flex items-center justify-center">
                  <ModelContextProtocol className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="text-left">
                  <CardTitle className="text-base">
                    {t("dashboard.mcpCard.title")}
                  </CardTitle>
                  <CardDescription>
                    {t("dashboard.mcpCard.description")}
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>
          </div>
        </div>
      )}
    </>
  );
};
