import { Search, FileText, MapPin } from "lucide-react";
import { type ToolCall } from "../../utils/toolCallParser";

interface SearchMatch {
  file: string;
  line_number?: number;
  line_content?: string;
  matches?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
}

interface SearchResult {
  matches?: SearchMatch[];
  total?: number;
  pattern?: string;
  message?: string;
}

interface SearchRendererProps {
  toolCall: ToolCall;
}

export function SearchRenderer({ toolCall }: SearchRendererProps) {
  const result = toolCall.result as SearchResult;

  // Extract search pattern from input
  const getSearchInfo = () => {
    try {
      if (toolCall.inputJsonRpc) {
        const input = JSON.parse(toolCall.inputJsonRpc);
        return {
          pattern: input.params?.pattern || input.params?.query || "unknown",
          path: input.params?.path || ".",
        };
      }
    } catch {
      // Intentionally ignore parse errors
    }
    return { pattern: "unknown", path: "." };
  };

  const { pattern, path } = getSearchInfo();
  const matches = result.matches || [];
  const total = result.total || matches.length;

  // Highlight search pattern in text
  const highlightMatches = (text: string, searchPattern: string) => {
    if (!text || !searchPattern) return text;

    try {
      const regex = new RegExp(
        `(${searchPattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
        "gi"
      );
      const parts = text.split(regex);

      return parts.map((part, i) =>
        regex.test(part) ? (
          <span
            key={i}
            className="bg-yellow-200 dark:bg-yellow-700 px-1 rounded"
          >
            {part}
          </span>
        ) : (
          part
        )
      );
    } catch {
      return text;
    }
  };

  // Group matches by file
  const groupedMatches = matches.reduce(
    (acc, match) => {
      const file = match.file;
      if (!acc[file]) {
        acc[file] = [];
      }
      acc[file].push(match);
      return acc;
    },
    {} as Record<string, SearchMatch[]>
  );

  return (
    <div className="mt-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-blue-500" />
        <div className="text-sm">
          <span className="font-medium">Search Results</span>
          <span className="text-muted-foreground ml-2">
            Found {total} matches for "{pattern}" in {path}
          </span>
        </div>
      </div>

      {/* Results */}
      {Object.keys(groupedMatches).length > 0 ? (
        <div className="space-y-4">
          {Object.entries(groupedMatches).map(([file, fileMatches]) => (
            <div key={file} className="border rounded-lg p-4">
              {/* File header */}
              <div className="flex items-center gap-2 mb-3 pb-2 border-b">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono text-sm font-medium">{file}</span>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                  {fileMatches.length} matches
                </span>
              </div>

              {/* Matches in this file */}
              <div className="space-y-2">
                {fileMatches.map((match, i) => (
                  <div key={i} className="border-l-2 border-blue-500 pl-4">
                    {match.line_number && (
                      <div className="flex items-center gap-2 mb-1">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          Line {match.line_number}
                        </span>
                      </div>
                    )}
                    {match.line_content && (
                      <pre className="bg-muted p-2 rounded text-sm overflow-x-auto">
                        <code>
                          {highlightMatches(match.line_content, pattern)}
                        </code>
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <div>No matches found</div>
          {result.message && (
            <div className="text-sm mt-2">{result.message}</div>
          )}
        </div>
      )}
    </div>
  );
}
