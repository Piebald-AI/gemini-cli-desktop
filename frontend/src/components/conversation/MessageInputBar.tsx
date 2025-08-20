import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { MentionInput } from "../common/MentionInput";
import { Send, Info, ImagePlus } from "lucide-react";
import { useBackend } from "../../contexts/BackendContext";
import { getBackendText } from "../../utils/backendText";
import { CliIO } from "../../types";

interface MessageInputBarProps {
  input: string;
  isCliInstalled: boolean | null;
  cliIOLogs: CliIO[];
  handleInputChange: (
    _event: React.ChangeEvent<HTMLInputElement> | null,
    newValue: string,
    _newPlainTextValue: string,
    _mentions: unknown[]
  ) => void;
  handleSendMessage: (e: React.FormEvent) => Promise<void>;
  workingDirectory?: string;
}

export const MessageInputBar: React.FC<MessageInputBarProps> = ({
  input,
  isCliInstalled,
  cliIOLogs,
  handleInputChange,
  handleSendMessage,
  workingDirectory = ".",
}) => {
  const { t } = useTranslation();
  const { selectedBackend } = useBackend();
  const backendText = getBackendText(selectedBackend);
  return (
    <div className="sticky bottom-0 bg-white dark:bg-neutral-900 flex items-center border-t border-gray-200 dark:border-neutral-700">
      <div className="px-6 py-2 w-full">
        <div className="mx-auto">
          <form className="flex gap-3 items-end" onSubmit={handleSendMessage}>
            <div className="flex-1 relative">
              <MentionInput
                value={input}
                onChange={handleInputChange}
                workingDirectory={workingDirectory}
                placeholder={
                  isCliInstalled === false
                    ? backendText.cliNotFound
                    : t("messageInput.placeholder")
                }
                disabled={isCliInstalled === false}
                className="h-9 w-full"
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
    </div>
  );
};
