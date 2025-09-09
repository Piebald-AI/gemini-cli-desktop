import { Progress } from "../ui/progress";
import {
  SessionProgressPayload,
  SessionProgressStage,
} from "../../types/session";

interface InlineSessionProgressProps {
  progress: SessionProgressPayload | null;
  className?: string;
}

export function InlineSessionProgress({
  progress,
  className,
}: InlineSessionProgressProps) {
  if (!progress || progress.stage === SessionProgressStage.Ready) {
    return null;
  }

  const isFailed = progress.stage === SessionProgressStage.Failed;
  const progressPercent = progress.progress_percent || 0;
  // Always display backend-provided progress message
  const displayMessage = progress.message;

  return (
    <div className={className}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        <span className="truncate">{displayMessage}</span>
        <span className="shrink-0">{progressPercent}%</span>
      </div>
      <Progress
        value={progressPercent}
        className="h-1"
        color={isFailed ? "destructive" : "primary"}
      />
    </div>
  );
}
