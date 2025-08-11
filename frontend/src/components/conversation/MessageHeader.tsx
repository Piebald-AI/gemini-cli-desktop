import React from "react";
import { SmartLogo } from "../branding/SmartLogo";
import { UserRound } from "lucide-react";

interface MessageHeaderProps {
  sender: "user" | "assistant";
  timestamp: Date;
}

export const MessageHeader: React.FC<MessageHeaderProps> = ({
  sender,
  timestamp,
}) => {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div>
        {sender === "assistant" ? (
          <SmartLogo />
        ) : (
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
            User
          </div>
        )}
      </div>
      <span className="text-xs text-muted-foreground">
        {timestamp.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
    </div>
  );
};
