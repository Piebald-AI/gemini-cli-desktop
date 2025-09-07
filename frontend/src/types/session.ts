export interface SessionProgressPayload {
  stage: SessionProgressStage;
  message: string;
  progress_percent?: number;
  details?: string;
}

export enum SessionProgressStage {
  Starting = "starting",
  ValidatingCli = "validating_cli",
  SpawningProcess = "spawning_process",
  Initializing = "initializing",
  Authenticating = "authenticating",
  CreatingSession = "creating_session",
  Ready = "ready",
  Failed = "failed",
}
