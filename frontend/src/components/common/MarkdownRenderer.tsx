import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import { Code } from "@/components/ui/code";
import CodeBlock from "@/components/common/CodeBlock";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

// Helper function to determine if a URL is external
function isExternalUrl(href: string): boolean {
  try {
    const url = new URL(href);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// Helper function to handle link clicks
async function handleLinkClick(href: string, event: React.MouseEvent) {
  if (isExternalUrl(href)) {
    event.preventDefault();
    try {
      await openUrl(href);
    } catch (error) {
      console.error("Failed to open URL with Tauri opener:", error);
      // Fallback to default behavior if Tauri opener fails
      window.open(href, "_blank", "noopener,noreferrer");
    }
  }
}

export function MarkdownRenderer({ children }: { children: string }) {
  return (
    <div className="prose prose-neutral prose-sm max-w-none dark:prose-invert text-sm break-words overflow-wrap-anywhere">
      <ReactMarkdown
        components={{
          code: ({ children, className }) => {
            const content = (children as string) || "";

            // Detect if this should be a code block:
            // 1. Has a language class (className starts with "language-")
            // 2. Contains newlines (multiline content is typically a code block)
            const hasLanguageClass = className?.startsWith("language-");
            const hasNewlines = content.includes("\n");
            const isCodeBlock = hasLanguageClass || hasNewlines;

            if (isCodeBlock) {
              // Extract language from className, defaulting to empty string for code blocks without language
              const language = className?.replace("language-", "") || "";
              return <CodeBlock code={content.trim()} language={language} />;
            } else {
              // Render as inline code
              return <Code>{children}</Code>;
            }
          },
          a: ({ href, children, ...props }) => (
            <a
              href={href}
              onClick={(e) => href && handleLinkClick(href, e)}
              className="text-primary hover:text-primary/80 underline underline-offset-2"
              {...props}
            >
              {children}
            </a>
          ),
          table: ({ node: _node, ...props }) => (
            <div className="rounded-md overflow-hidden border border-neutral-200 dark:border-neutral-800 max-w-full">
              <div className="overflow-x-auto w-full">
                <Table className="not-prose" {...props} />
              </div>
            </div>
          ),
          thead: ({ node: _node, ...props }) => <TableHeader {...props} />,
          tbody: ({ node: _node, ...props }) => <TableBody {...props} />,
          tfoot: ({ node: _node, ...props }) => <TableFooter {...props} />,
          tr: ({ node: _node, ...props }) => <TableRow {...props} />,
          th: ({ node: _node, ...props }) => (
            <TableHead className="p-3" {...props} />
          ),
          td: ({ node: _node, ...props }) => (
            <TableCell
              className="align-top p-3 text-wrap break-words"
              {...props}
            />
          ),
          pre: (props) => <pre {...props} className="not-prose" />,
        }}
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeRaw, rehypeKatex]}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
