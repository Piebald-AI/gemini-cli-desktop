import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { MentionInput, MentionInputRef } from "../common/MentionInput";
import { Send, Info, ImagePlus, Play, Loader2 } from "lucide-react";
import { useBackend } from "../../contexts/BackendContext";
import { getBackendText } from "../../utils/backendText";
import { CliIO } from "../../types";
import { GitInfo } from "../common/GitInfo";

interface MessageInputBarProps {
  input: string;
  isCliInstalled: boolean | null;
  cliIOLogs: CliIO[];
  handleInputChange: (
    _event: React.ChangeEvent<HTMLTextAreaElement> | null,
    newValue: string,
    _newPlainTextValue: string,
    _mentions: unknown[]
  ) => void;
  handleSendMessage: (e: React.FormEvent) => Promise<void>;
  workingDirectory?: string;
  isConversationActive: boolean;
  onContinueConversation: () => void;
  isContinuingConversation: boolean;
  isNew?: boolean;
}

export interface MessageInputBarRef {
  insertMention: (mention: string) => void;
  closeDropdown: () => void;
}

export const MessageInputBar = forwardRef<
  MessageInputBarRef,
  MessageInputBarProps
>(
  (
    {
      input,
      isCliInstalled,
      cliIOLogs,
      handleInputChange,
      handleSendMessage,
      workingDirectory = ".",
      isConversationActive,
      onContinueConversation,
      isContinuingConversation,
      isNew,
    },
    ref
  ) => {
    const { t } = useTranslation();
    const { selectedBackend } = useBackend();
    const backendText = getBackendText(selectedBackend);
    const mentionInputRef = useRef<MentionInputRef>(null);

    // Expose the insertMention method via ref
    useImperativeHandle(
      ref,
      () => ({
        insertMention: (mention: string) => {
          if (mentionInputRef.current) {
            mentionInputRef.current.insertMention(mention);
          }
        },
        closeDropdown: () => {
          if (mentionInputRef.current) {
            mentionInputRef.current.closeDropdown();
          }
        },
      }),
      []
    );

    if (!isConversationActive) {
      if (isNew) {
        return null;
      }
      return (
        <div className="sticky bottom-0 bg-white dark:bg-neutral-900 flex items-center p-6">
          <Button
            className="w-full"
            onClick={onContinueConversation}
            disabled={isContinuingConversation}
          >
            {isContinuingConversation ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t("messageInput.startingConversation")}
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                {t("messageInput.continueConversation")}
              </>
            )}
          </Button>
        </div>
      );
    }

    return (
      <div className="sticky bottom-0 bg-white dark:bg-neutral-900 flex items-center">
        <div className="px-6 pb-3 pt-2 w-full">
          {/* Git info - positioned above input */}
          {workingDirectory && workingDirectory !== "." && (
            <GitInfo directory={workingDirectory} compact={true} />
          )}
          <form
            className="flex gap-2 items-end mt-2"
            onSubmit={handleSendMessage}
          >
            <div className="flex-1 relative">
              <MentionInput
                ref={mentionInputRef}
                value={input}
                onChange={handleInputChange}
                workingDirectory={workingDirectory}
                placeholder={
                  isCliInstalled === false
                    ? backendText.cliNotFound
                    : t("messageInput.placeholder")
                }
                disabled={isCliInstalled === false}
                className="w-full"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
              />
            </div>
            <Button
              type="submit"
              disabled={isCliInstalled === false || !input.trim()}
              size="icon"
            >
              <Send />
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  title={t("messageInput.viewCliLogs")}
                >
                  <Info className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{t("messageInput.cliLogsTitle")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {cliIOLogs.map((log, index) => (
                    <div key={index} className="border rounded p-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-xs font-mono px-2 py-1 rounded ${
                            log.type === "input"
                              ? "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                              : "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                          }`}
                        >
                          {log.type === "input"
                            ? t("messageInput.logTypeIn")
                            : t("messageInput.logTypeOut")}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {log.timestamp.toLocaleTimeString()}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {log.conversationId}
                        </span>
                      </div>
                      <pre className="text-xs whitespace-pre-wrap break-all font-mono bg-white dark:bg-gray-900 p-2 rounded border">
                        {log.data}
                      </pre>
                    </div>
                  ))}
                  {cliIOLogs.length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                      {t("messageInput.noLogsMessage")}
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            <Button type="button" disabled={true} size="icon" variant="outline">
              <ImagePlus />
            </Button>
          </form>
        </div>
      </div>
    );
  }
);

MessageInputBar.displayName = "MessageInputBar";
