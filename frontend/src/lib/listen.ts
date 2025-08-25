import { webListen } from "./webApi";
import { listen as tauriListen } from "@tauri-apps/api/event";

export async function listen<T>(
  event: string,
  callback: (event: { payload: T }) => void
): Promise<() => void> {
  if (__WEB__) {
    return webListen<T>(event, callback);
  } else {
    return tauriListen<T>(event, callback);
  }
}
