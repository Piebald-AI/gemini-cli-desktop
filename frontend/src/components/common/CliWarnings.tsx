import React, { useState, useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { AlertCircleIcon, AlertTriangle, X, Info } from "lucide-react";
import { Button } from "../ui/button";
import { useBackend } from "../../contexts/BackendContext";
import { getBackendText } from "../../utils/backendText";

interface CliWarningsProps {
  selectedModel: string;
  isCliInstalled: boolean | null;
}

export const CliWarnings: React.FC<CliWarningsProps> = ({
  selectedModel,
  isCliInstalled,
}) => {
  const { selectedBackend } = useBackend();
  const backendText = getBackendText(selectedBackend);
  const [isQwenLoginAlertDismissed, setIsQwenLoginAlertDismissed] =
    useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem("qwen-login-alert-dismissed");
    setIsQwenLoginAlertDismissed(dismissed === "true");
  }, []);

  const dismissQwenLoginAlert = () => {
    setIsQwenLoginAlertDismissed(true);
    localStorage.setItem("qwen-login-alert-dismissed", "true");
  };
  return (
    <>
      {selectedBackend === "qwen" && !isQwenLoginAlertDismissed && (
        <div className="p-4">
          <Alert className="bg-blue-50 border-blue-300 dark:bg-blue-950 dark:border-blue-700">
            <Info className="!text-blue-500 dark:!text-blue-300" />
            <AlertTitle className="text-blue-800 dark:text-blue-300 flex items-center justify-between">
              <span>{backendText.loginNotSupportedTitle}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-blue-500 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/70"
                onClick={dismissQwenLoginAlert}
              >
                <X className="h-4 w-4" />
              </Button>
            </AlertTitle>
            <AlertDescription className="text-blue-800 dark:text-blue-300">
              <p>
                {backendText.oauthNotSupported} To login, please first use the
                CLI directly for authentication.
              </p>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {selectedModel === "gemini-2.5-flash-lite" && (
        <div className="p-4">
          <Alert className="bg-yellow-50 border-yellow-300 dark:bg-yellow-950 dark:border-yellow-700">
            <AlertTriangle className="!text-yellow-500 dark:!text-yellow-300" />
            <AlertTitle className="text-yellow-800 dark:text-yellow-300">
              Model unavailable
            </AlertTitle>
            <AlertDescription className="text-yellow-800 dark:text-yellow-300">
              <p>
                Unfortunately, Gemini 2.5 Flash-Lite isn't usable, due to
                thinking issues. See here for more details:{" "}
                <a
                  href="https://github.com/google-gemini/gemini-cli/issues/1953"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4"
                >
                  #1953
                </a>{" "}
                and{" "}
                <a
                  href="https://github.com/google-gemini/gemini-cli/issues/4548"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4"
                >
                  #4548
                </a>
                . Waiting on PR{" "}
                <a
                  href="https://github.com/google-gemini/gemini-cli/pull/3033"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4"
                >
                  #3033
                </a>
                /
                <a
                  href="https://github.com/google-gemini/gemini-cli/pull/4652"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4"
                >
                  #4652
                </a>
                .
              </p>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {isCliInstalled === false && (
        <div className="p-4">
          <Alert
            variant="destructive"
            className="bg-red-50 border-red-300 dark:bg-red-950 dark:border-red-700 dark:text-red-300"
          >
            <AlertCircleIcon />
            <AlertTitle>{backendText.cliNotFound}</AlertTitle>
            <AlertDescription className="dark:text-red-300">
              <p>
                <span>
                  {backendText.installMessage}
                  {selectedBackend === "gemini" && (
                    <>
                      {" "}
                      <a
                        href="https://github.com/google-gemini/gemini-cli"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-4"
                      >
                        the official repository
                      </a>
                      .
                    </>
                  )}
                </span>
              </p>
            </AlertDescription>
          </Alert>
        </div>
      )}
    </>
  );
};
