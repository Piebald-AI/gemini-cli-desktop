import React from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { GeminiIcon } from "@/components/branding/GeminiIcon";
import { QwenIcon } from "@/components/branding/QwenIcon";
import { useBackend } from "@/contexts/BackendContext";
import { getBackendText } from "@/utils/backendText";

interface AboutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AboutDialog: React.FC<AboutDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const { t } = useTranslation();
  const { selectedBackend } = useBackend();
  const backendText = getBackendText(selectedBackend);

  const appName = backendText.desktopName;
  const appVersion = "0.3.10";
  const currentYear = new Date().getFullYear();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="space-y-6">
          <div className="flex items-center justify-center">
            <div className="w-16 h-16 flex items-center justify-center">
              {selectedBackend === "qwen" ? (
                <QwenIcon height={64} width={64} />
              ) : (
                <GeminiIcon height={64} width={64} />
              )}
            </div>
          </div>

          <div className="text-center space-y-2">
            <DialogTitle className="text-2xl font-bold">{appName}</DialogTitle>
            <DialogDescription className="text-base">
              {t("about.version", { version: appVersion })}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="text-center text-sm text-muted-foreground">
            <ReactMarkdown
              components={{
                p: ({ children }) => <span>{children}</span>,
                strong: ({ children }) => (
                  <strong className="font-semibold">{children}</strong>
                ),
              }}
            >
              {t("about.description")}
            </ReactMarkdown>{" "}
            <a
              href="https://github.com/Piebald-AI/gemini-desktop"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {t("about.github")}
            </a>
            .
          </div>

          <div className="text-center text-sm space-y-2 text-muted-foreground">
            <ReactMarkdown
              components={{
                p: ({ children }) => <div>{children}</div>,
                strong: ({ children }) => (
                  <strong className="font-semibold">{children}</strong>
                ),
              }}
            >
              {`• ${t("about.feature1")}`}
            </ReactMarkdown>
            <ReactMarkdown
              components={{
                p: ({ children }) => <div>{children}</div>,
                strong: ({ children }) => (
                  <strong className="font-semibold">{children}</strong>
                ),
              }}
            >
              {`• ${t("about.feature2")}`}
            </ReactMarkdown>
            <ReactMarkdown
              components={{
                p: ({ children }) => <div>{children}</div>,
                strong: ({ children }) => (
                  <strong className="font-semibold">{children}</strong>
                ),
              }}
            >
              {`• ${t("about.feature3")}`}
            </ReactMarkdown>
            <ReactMarkdown
              components={{
                p: ({ children }) => <div>{children}</div>,
                strong: ({ children }) => (
                  <strong className="font-semibold">{children}</strong>
                ),
              }}
            >
              {`• ${t("about.feature4")}`}
            </ReactMarkdown>
            <ReactMarkdown
              components={{
                p: ({ children }) => <div>{children}</div>,
                strong: ({ children }) => (
                  <strong className="font-semibold">{children}</strong>
                ),
              }}
            >
              {`• ${t("about.feature5")}`}
            </ReactMarkdown>
          </div>

          <div className="pt-4 border-t border-border">
            <DialogDescription className="text-center text-xs text-muted-foreground">
              {t("about.copyright", { year: currentYear, appName })}
            </DialogDescription>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
