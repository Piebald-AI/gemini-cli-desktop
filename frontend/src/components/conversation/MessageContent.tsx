import React from "react";
import { MarkdownRenderer } from "../common/MarkdownRenderer";

interface MessageContentProps {
  content: string;
}

export const MessageContent = React.memo(({ content }: MessageContentProps) => {
  return <MarkdownRenderer>{content}</MarkdownRenderer>;
});

MessageContent.displayName = "MessageContent";
