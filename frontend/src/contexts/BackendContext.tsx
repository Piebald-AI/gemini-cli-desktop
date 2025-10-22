import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useMemo,
  ReactNode,
} from "react";
import {
  BackendType,
  BackendState,
  BackendContextValue,
  BackendAction,
  ApiConfig,
  GeminiConfig,
  QwenConfig,
  LLxprtConfig,
} from "../types/backend";
import { defaultBackendState } from "../utils/backendDefaults";

const BackendContext = createContext<BackendContextValue | undefined>(
  undefined
);

// Simple localStorage helpers
const STORAGE_KEY = "backend-state";

const loadFromStorage = (): BackendState => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      console.log("Loading backend state from storage:", parsed);
      // Merge with defaults to handle any missing fields
      const result = {
        ...defaultBackendState,
        ...parsed,
        configs: {
          ...defaultBackendState.configs,
          ...parsed.configs,
          gemini: {
            ...defaultBackendState.configs.gemini,
            ...parsed.configs?.gemini,
          },
          qwen: {
            ...defaultBackendState.configs.qwen,
            ...parsed.configs?.qwen,
          },
          llxprt: {
            ...defaultBackendState.configs.llxprt,
            ...parsed.configs?.llxprt,
          },
        },
      };
      console.log("Merged backend state:", result);
      return result;
    }
    console.log("No stored backend state, using defaults");
  } catch (error) {
    console.warn("Failed to load backend state:", error);
  }
  return defaultBackendState;
};

const saveToStorage = (state: BackendState): void => {
  try {
    console.log("Saving backend state to storage:", state);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("Failed to save backend state:", error);
  }
};

// Reducer function for complex state management
const backendReducer = (
  state: BackendState,
  action: BackendAction
): BackendState => {
  switch (action.type) {
    case "SWITCH_BACKEND": {
      const newState = {
        ...state,
        selectedBackend: action.backend,
      };

      // Security validation delegated to underlying CLIs
      return {
        ...newState,
        isValid: true,
        errors: {
          ...state.errors,
          [action.backend]: "",
        },
      };
    }

    case "UPDATE_CONFIG": {
      const updatedConfigs = {
        ...state.configs,
        [action.backend]: {
          ...state.configs[action.backend],
          ...action.config,
        },
      };

      // Security validation delegated to underlying CLIs
      const newState = {
        ...state,
        configs: updatedConfigs,
        errors: {
          ...state.errors,
          [action.backend]: "",
        },
      };

      // Update overall validity
      newState.isValid = true;

      return newState;
    }

    case "SET_VALIDATION_ERROR":
      return {
        ...state,
        errors: {
          ...state.errors,
          [action.backend]: action.error,
        },
        isValid:
          state.selectedBackend === action.backend ? false : state.isValid,
      };

    case "CLEAR_VALIDATION_ERROR":
      return {
        ...state,
        errors: {
          ...state.errors,
          [action.backend]: "",
        },
        isValid:
          state.selectedBackend === action.backend ? true : state.isValid,
      };

    case "RESET_CONFIG": {
      const defaultConfig =
        action.backend === "gemini"
          ? defaultBackendState.configs.gemini
          : defaultBackendState.configs.qwen;

      return {
        ...state,
        configs: {
          ...state.configs,
          [action.backend]: defaultConfig,
        },
        errors: {
          ...state.errors,
          [action.backend]: "",
        },
        isValid:
          state.selectedBackend === action.backend ? true : state.isValid,
      };
    }

    case "LOAD_FROM_STORAGE":
      return action.state;

    default:
      return state;
  }
};

interface BackendProviderProps {
  children: ReactNode;
}

export const BackendProvider: React.FC<BackendProviderProps> = ({
  children,
}) => {
  // Initialize state with useReducer, loading from storage immediately
  const [state, dispatch] = useReducer(backendReducer, null, () =>
    loadFromStorage()
  );

  // Save to localStorage on state changes
  useEffect(() => {
    saveToStorage(state);
  }, [state]);

  // Memoized actions to prevent unnecessary re-renders
  const actions = useMemo(
    () => ({
      switchBackend: (backend: BackendType) => {
        dispatch({ type: "SWITCH_BACKEND", backend });
      },

      updateConfig: <T extends BackendType>(
        backend: T,
        config: Partial<BackendState["configs"][T]>
      ) => {
        dispatch({ type: "UPDATE_CONFIG", backend, config });
      },

      validateConfig: (backend: BackendType): boolean => {
        // Security validation delegated to underlying CLIs
        dispatch({ type: "CLEAR_VALIDATION_ERROR", backend });
        return true;
      },

      resetConfig: (backend: BackendType) => {
        dispatch({ type: "RESET_CONFIG", backend });
      },
    }),
    [state.configs]
  );

  // Memoized computed values
  const computedValues = useMemo(() => {
    const currentConfig = state.configs[state.selectedBackend];
    const isCurrentBackendValid = !state.errors[state.selectedBackend];

    const currentModel =
      state.selectedBackend === "gemini"
        ? (currentConfig as GeminiConfig).defaultModel
        : state.selectedBackend === "llxprt"
          ? (currentConfig as LLxprtConfig).model
          : (currentConfig as QwenConfig).model;

    const getApiConfig = (): ApiConfig | null => {
      if (state.selectedBackend === "qwen") {
        const qwenConfig = state.configs.qwen;
        if (qwenConfig.useOAuth) {
          return { model: qwenConfig.model };
        } else {
          return {
            api_key: qwenConfig.apiKey,
            base_url: qwenConfig.baseUrl,
            model: qwenConfig.model,
          };
        }
      } else if (state.selectedBackend === "llxprt") {
        const llxprtConfig = state.configs.llxprt;
        return {
          api_key: llxprtConfig.apiKey,
          base_url: llxprtConfig.baseUrl || undefined,
          model: llxprtConfig.model,
        };
      } else if (state.selectedBackend === "gemini") {
        const geminiConfig = state.configs.gemini;
        if (geminiConfig.authMethod === "gemini-api-key") {
          return {
            api_key: geminiConfig.apiKey,
            model: currentModel,
          };
        } else {
          // For OAuth, Vertex AI, or Cloud Shell, no API key needed
          return { model: currentModel };
        }
      }
      return { model: currentModel };
    };

    const canStartSession = (): boolean => {
      return isCurrentBackendValid && !!currentModel;
    };

    return {
      currentConfig,
      isCurrentBackendValid,
      currentModel,
      getApiConfig,
      canStartSession,
    };
  }, [state]);

  // Memoized context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({
      state,
      selectedBackend: state.selectedBackend,
      ...actions,
      ...computedValues,
    }),
    [state, actions, computedValues]
  );

  return (
    <BackendContext.Provider value={contextValue}>
      {children}
    </BackendContext.Provider>
  );
};

// Custom hooks for different use cases
// eslint-disable-next-line react-refresh/only-export-components
export const useBackend = (): BackendContextValue => {
  const context = useContext(BackendContext);
  if (!context) {
    throw new Error("useBackend must be used within a BackendProvider");
  }
  return context;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useBackendConfig = <T extends BackendType>(backend: T) => {
  const { state, updateConfig } = useBackend();
  return {
    config: state.configs[backend],
    updateConfig: (config: Partial<BackendState["configs"][T]>) =>
      updateConfig(backend, config),
    isValid: !state.errors[backend],
    error: state.errors[backend],
  };
};

// eslint-disable-next-line react-refresh/only-export-components
export const useCurrentBackend = () => {
  const { state, currentConfig, currentModel } = useBackend();
  return {
    backend: state.selectedBackend,
    config: currentConfig,
    model: currentModel,
    isValid: state.isValid,
  };
};

// eslint-disable-next-line react-refresh/only-export-components
export const useApiConfig = () => {
  const { getApiConfig, canStartSession } = useBackend();
  return {
    apiConfig: getApiConfig(),
    canStartSession: canStartSession(),
  };
};
