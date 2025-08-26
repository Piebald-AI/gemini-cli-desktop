import React from "react";
import { useTranslation } from "react-i18next";
import { MessageSquare, Sparkles } from "lucide-react";
import { useCurrentBackend } from "../../contexts/BackendContext";
import { getBackendText } from "../../utils/backendText";
import { Code } from "../ui/code";

export const NewChatPlaceholder: React.FC = () => {
  const { t } = useTranslation();
  const { backend, model } = useCurrentBackend();
  const backendText = getBackendText(backend);

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
      <div className="mb-6">
        <MessageSquare className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
        <h2 className="text-lg font-semibold text-foreground mb-2">
          {t("newChatPlaceholder.title")}
        </h2>
        <p className="text-muted-foreground text-sm max-w-md">
          {t("newChatPlaceholder.descriptionBefore")}
          <Code>{model || "AI"}</Code>
          {t("newChatPlaceholder.descriptionAfter", {
            backendName: backendText.name
          })}
        </p>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Sparkles className="h-4 w-4" />
        <span>{t("newChatPlaceholder.tip")}</span>
      </div>
    </div>
  );
};