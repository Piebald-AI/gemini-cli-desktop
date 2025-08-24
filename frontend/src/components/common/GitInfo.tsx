import React, { useEffect, useState } from "react";
import { GitBranch, FolderOpen, CheckCircle, AlertCircle } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { api } from "../../lib/api";
import { GitInfo as GitInfoType } from "../../types/backend";

interface GitInfoProps {
  directory: string;
  className?: string;
  compact?: boolean;
}

export function GitInfo({ directory, className = "", compact = false }: GitInfoProps) {
  const [gitInfo, setGitInfo] = useState<GitInfoType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchGitInfo() {
      try {
        setLoading(true);
        setError(null);
        const info = await api.invoke<GitInfoType | null>("get_git_info", { path: directory });
        setGitInfo(info);
      } catch (err) {
        console.error("Failed to fetch git info:", err);
        setError("Failed to fetch git information");
      } finally {
        setLoading(false);
      }
    }

    if (directory) {
      fetchGitInfo();
    }
  }, [directory]);

  if (loading) {
    if (compact) {
      return (
        <div className={`flex items-center gap-1 text-xs text-gray-500 ${className}`}>
          <GitBranch className="h-3 w-3 animate-pulse" />
          <span>...</span>
        </div>
      );
    }
    return (
      <Card className={`border-l-4 border-l-gray-400 ${className}`}>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <FolderOpen className="h-4 w-4" />
            <span>Loading git info...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    if (compact) {
      return (
        <div className={`flex items-center gap-1 text-xs text-red-500 ${className}`}>
          <AlertCircle className="h-3 w-3" />
          <span>Git error</span>
        </div>
      );
    }
    return (
      <Card className={`border-l-4 border-l-red-400 ${className}`}>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!gitInfo) {
    if (compact) {
      return null; // Don't show anything for non-git repos in compact mode
    }
    return (
      <Card className={`border-l-4 border-l-gray-300 ${className}`}>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <FolderOpen className="h-4 w-4" />
            <div className="flex flex-col gap-1">
              <span className="font-medium">Not a git repository</span>
              <span className="text-xs opacity-75 truncate" title={gitInfo?.current_directory || directory}>
                {gitInfo?.current_directory || directory}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getBorderColor = () => {
    if (gitInfo.is_clean) return "border-l-green-400";
    if (gitInfo.has_uncommitted_changes) return "border-l-yellow-400";
    if (gitInfo.has_untracked_files) return "border-l-blue-400";
    return "border-l-gray-400";
  };

  const getStatusIcon = () => {
    if (gitInfo.is_clean) return <CheckCircle className="h-4 w-4 text-green-600" />;
    return <AlertCircle className="h-4 w-4 text-yellow-600" />;
  };

  const getStatusBadge = () => {
    if (gitInfo.is_clean) {
      return <Badge variant="outline" className="text-green-600 border-green-300">clean</Badge>;
    }
    
    const statusItems = [];
    if (gitInfo.has_uncommitted_changes) {
      statusItems.push("modified");
    }
    if (gitInfo.has_untracked_files) {
      statusItems.push("untracked");
    }
    
    return (
      <Badge variant="outline" className="text-yellow-600 border-yellow-300">
        {statusItems.join(", ")}
      </Badge>
    );
  };

  // Compact version - just show branch and a tiny status dot
  if (compact) {
    const getStatusColor = () => {
      if (gitInfo.is_clean) return "text-green-500";
      if (gitInfo.has_uncommitted_changes) return "text-yellow-500";
      if (gitInfo.has_untracked_files) return "text-blue-500";
      return "text-gray-500";
    };

    return (
      <div className={`flex items-center gap-1 text-xs text-gray-600 ${className}`} title={`${gitInfo.current_directory} - ${gitInfo.status}`}>
        <GitBranch className="h-3 w-3 text-gray-500" />
        <span className="font-mono truncate max-w-24">{gitInfo.branch}</span>
        <div className={`w-1.5 h-1.5 rounded-full ${getStatusColor().replace('text-', 'bg-')}`} />
      </div>
    );
  }

  return (
    <Card className={`border-l-4 ${getBorderColor()} ${className}`}>
      <CardContent className="p-3">
        <div className="flex flex-col gap-2">
          {/* Directory */}
          <div className="flex items-center gap-2 text-sm">
            <FolderOpen className="h-4 w-4 text-gray-500" />
            <span className="font-medium truncate" title={gitInfo.current_directory}>
              {gitInfo.current_directory.split('/').pop() || gitInfo.current_directory.split('\\').pop() || gitInfo.current_directory}
            </span>
          </div>
          
          {/* Branch and status */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <GitBranch className="h-4 w-4 text-gray-500 flex-shrink-0" />
              <span className="text-sm font-mono truncate" title={gitInfo.branch}>
                {gitInfo.branch}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {getStatusIcon()}
              {getStatusBadge()}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}