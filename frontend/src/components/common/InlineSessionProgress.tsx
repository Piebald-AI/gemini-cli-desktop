import { Progress } from "../ui/progress";
import {
  SessionProgressPayload,
  SessionProgressStage,
} from "../../types/session";
import { useWittyLoadingPhrase } from "../../hooks/useWittyLoadingPhrase";

interface InlineSessionProgressProps {
  progress: SessionProgressPayload | null;
  className?: string;
}

export function InlineSessionProgress({
  progress,
  className,
}: InlineSessionProgressProps) {
  const isActive =
    progress &&
    progress.stage !== SessionProgressStage.Ready &&
    progress.stage !== SessionProgressStage.Failed;
  const { formattedMessage } = useWittyLoadingPhrase({ isActive: !!isActive });

  if (!progress || progress.stage === SessionProgressStage.Ready) {
    return null;
  }

  const isFailed = progress.stage === SessionProgressStage.Failed;
  const progressPercent = progress.progress_percent || 0;

  // Use witty phrases for all non-failed states, fallback to original message only for failures
  const displayMessage = isFailed ? progress.message : formattedMessage;

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
