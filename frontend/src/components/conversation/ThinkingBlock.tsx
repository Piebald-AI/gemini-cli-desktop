import { useState } from "react";
import { ChevronRight, Brain } from "lucide-react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";

interface ThinkingBlockProps {
  thinking: string;
}

export function ThinkingBlock({ thinking }: ThinkingBlockProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  if (!thinking || thinking.trim().length === 0) {
    return null;
  }

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="border border-border rounded-md bg-muted/50 mb-4 group/collapsible"
    >
      <CollapsibleTrigger className="w-full flex items-center justify-between p-2 px-2.5 text-left hover:bg-muted/70 transition-colors">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Brain className="w-4 h-4" />
          <span>{t("common.thinking")}</span>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=open]/collapsible:rotate-90 " />
      </CollapsibleTrigger>
      <CollapsibleContent className="p-3 border-t border-border">
        <div className="prose prose-neutral prose-sm max-w-none dark:prose-invert text-xs text-muted-foreground">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{thinking}</ReactMarkdown>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
