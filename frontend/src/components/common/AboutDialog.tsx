import React from "react";
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

interface AboutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AboutDialog: React.FC<AboutDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const { selectedBackend } = useBackend();
  
  const appName = selectedBackend === "qwen" ? "Qwen Desktop" : "Gemini Desktop";
  const appVersion = "0.1.0";
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
            <DialogTitle className="text-2xl font-bold">
              {appName}
            </DialogTitle>
            <DialogDescription className="text-base">
              Version {appVersion}
            </DialogDescription>
          </div>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <DialogDescription className="text-center">
            A powerful, modern desktop and web UI for <strong>Gemini CLI</strong> and <strong>Qwen Code</strong>. Built with Tauri and web technologies. Cross-platform, open-source on{" "}
            <a 
              href="https://github.com/Piebald-AI/gemini-desktop" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              GitHub
            </a>.
          </DialogDescription>
          
          <DialogDescription className="text-center text-sm space-y-2">
            <div>• Choose between Gemini models (Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 2.5 Flash-Lite)</div>
            <div>• Use <strong>Qwen.ai OAuth/custom OpenAI-compatible providers</strong> and models with Qwen Code</div>
            <div>• Send messages to/from AI and receive response; handle tool call requests; Markdown support</div>
            <div>• Observe Gemini's <strong>thought process</strong></div>
            <div>• View and handle edit requests with clear file diffs</div>
          </DialogDescription>
          
          <div className="pt-4 border-t border-border">
            <DialogDescription className="text-center text-xs text-muted-foreground">
              © {currentYear} Gemini Desktop. All rights reserved.
            </DialogDescription>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};