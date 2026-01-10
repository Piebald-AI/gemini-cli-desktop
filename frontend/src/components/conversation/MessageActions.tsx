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
import { Info } from "lucide-react";
import { type ToolCall } from "../../utils/toolCallParser";
import { CodeMirrorViewer } from "../common/CodeMirrorViewer";

interface Message {
  id: string;
  content: string;
  sender: "user" | "assistant";
  timestamp: Date;
  toolCalls?: ToolCall[];
  thinking?: string;
}

interface MessageActionsProps {
  message: Message;
}

export const MessageActions: React.FC<MessageActionsProps> = ({ message }) => {
  const { t } = useTranslation();

  return (
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
            <DialogTitle>{t("dashboard.rawJsonTitle")}</DialogTitle>
          </DialogHeader>
          <div className="rounded-lg overflow-hidden border border-border">
            <CodeMirrorViewer
              code={JSON.stringify(message, null, 2)}
              language="json"
              readOnly={true}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
