import React, { createContext, useContext, useReducer, useEffect, useMemo, ReactNode } from "react";
import { 
  BackendType, 
  BackendState, 
  BackendContextValue, 
  BackendAction, 
  ApiConfig,
  GeminiConfig,
  QwenConfig 
} from "../types/backend";
import { validateBackendConfig } from "../utils/backendValidation";
import { defaultBackendState } from "../utils/backendDefaults";

const BackendContext = createContext<BackendContextValue | undefined>(undefined);

// Simple localStorage helpers
const STORAGE_KEY = 'backend-state';

const loadFromStorage = (): BackendState => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with defaults to handle any missing fields
      return {
        ...defaultBackendState,
        ...parsed,
        configs: {
          ...defaultBackendState.configs,
          ...parsed.configs,
          gemini: { ...defaultBackendState.configs.gemini, ...parsed.configs?.gemini },
          qwen: { ...defaultBackendState.configs.qwen, ...parsed.configs?.qwen },
        },
      };
    }
  } catch (error) {
    console.warn('Failed to load backend state:', error);
  }
  return defaultBackendState;
};

const saveToStorage = (state: BackendState): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('Failed to save backend state:', error);
  }
};

// Reducer function for complex state management
const backendReducer = (state: BackendState, action: BackendAction): BackendState => {
  switch (action.type) {
    case 'SWITCH_BACKEND': {
      const newState = {
        ...state,
        selectedBackend: action.backend,
      };
      
      // Validate the new backend
      const currentConfig = newState.configs[action.backend];
      const validation = validateBackendConfig(action.backend, currentConfig);
      
      return {
        ...newState,
        isValid: validation.isValid,
        errors: {
          ...state.errors,
          [action.backend]: validation.isValid ? '' : validation.errors.join(', ')
        }
      };
    }
    
    case 'UPDATE_CONFIG': {
      const updatedConfigs = {
        ...state.configs,
        [action.backend]: {
          ...state.configs[action.backend],
          ...action.config,
        } as any,
      };
      
      // Validate the updated config
      const validation = validateBackendConfig(action.backend, updatedConfigs[action.backend]);
      
      const newState = {
        ...state,
        configs: updatedConfigs,
        errors: {
          ...state.errors,
          [action.backend]: validation.isValid ? '' : validation.errors.join(', ')
        }
      };
      
      // Update overall validity
      newState.isValid = state.selectedBackend === action.backend ? validation.isValid : state.isValid;
      
      return newState;
    }
    
    case 'SET_VALIDATION_ERROR':
      return {
        ...state,
        errors: {
          ...state.errors,
          [action.backend]: action.error,
        },
        isValid: state.selectedBackend === action.backend ? false : state.isValid,
      };
    
    case 'CLEAR_VALIDATION_ERROR':
      return {
        ...state,
        errors: {
          ...state.errors,
          [action.backend]: '',
        },
        isValid: state.selectedBackend === action.backend ? true : state.isValid,
      };
    
    case 'RESET_CONFIG': {
      const defaultConfig = action.backend === 'gemini' 
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
          [action.backend]: '',
        },
        isValid: state.selectedBackend === action.backend ? true : state.isValid,
      };
    }
    
    case 'LOAD_FROM_STORAGE':
      return action.state;
    
    default:
      return state;
  }
};

interface BackendProviderProps {
  children: ReactNode;
}

export const BackendProvider: React.FC<BackendProviderProps> = ({ children }) => {
  // Initialize state with useReducer
  const [state, dispatch] = useReducer(backendReducer, defaultBackendState);

  // Load from localStorage on mount
  useEffect(() => {
    const loadedState = loadFromStorage();
    dispatch({ type: 'LOAD_FROM_STORAGE', state: loadedState });
  }, []);

  // Save to localStorage on state changes
  useEffect(() => {
    saveToStorage(state);
  }, [state]);

  // Memoized actions to prevent unnecessary re-renders
  const actions = useMemo(() => ({
    switchBackend: (backend: BackendType) => {
      dispatch({ type: 'SWITCH_BACKEND', backend });
    },

    updateConfig: <T extends BackendType>(
      backend: T, 
      config: Partial<BackendState['configs'][T]>
    ) => {
      dispatch({ type: 'UPDATE_CONFIG', backend, config });
    },

    validateConfig: (backend: BackendType): boolean => {
      const config = state.configs[backend];
      const validation = validateBackendConfig(backend, config);
      
      if (!validation.isValid) {
        dispatch({ 
          type: 'SET_VALIDATION_ERROR', 
          backend, 
          error: validation.errors.join(', ') 
        });
      } else {
        dispatch({ type: 'CLEAR_VALIDATION_ERROR', backend });
      }
      
      return validation.isValid;
    },

    resetConfig: (backend: BackendType) => {
      dispatch({ type: 'RESET_CONFIG', backend });
    },
  }), [state.configs]);

  // Memoized computed values
  const computedValues = useMemo(() => {
    const currentConfig = state.configs[state.selectedBackend];
    const isCurrentBackendValid = !state.errors[state.selectedBackend];
    
    const currentModel = state.selectedBackend === 'gemini' 
      ? (currentConfig as GeminiConfig).defaultModel
      : (currentConfig as QwenConfig).model;

    const getApiConfig = (): ApiConfig | null => {
      if (state.selectedBackend === 'qwen') {
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
      }
      
      return null;
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
  const contextValue = useMemo(() => ({
    state,
    selectedBackend: state.selectedBackend,
    ...actions,
    ...computedValues,
  }), [state, actions, computedValues]);

  return (
    <BackendContext.Provider value={contextValue}>
      {children}
    </BackendContext.Provider>
  );
};

// Custom hooks for different use cases
export const useBackend = (): BackendContextValue => {
  const context = useContext(BackendContext);
  if (!context) {
    throw new Error('useBackend must be used within a BackendProvider');
  }
  return context;
};

export const useBackendConfig = <T extends BackendType>(backend: T) => {
  const { state, updateConfig } = useBackend();
  return {
    config: state.configs[backend],
    updateConfig: (config: Partial<BackendState['configs'][T]>) => 
      updateConfig(backend, config),
    isValid: !state.errors[backend],
    error: state.errors[backend],
  };
};

export const useCurrentBackend = () => {
  const { state, currentConfig, currentModel } = useBackend();
  return {
    backend: state.selectedBackend,
    config: currentConfig,
    model: currentModel,
    isValid: state.isValid,
  };
};

export const useApiConfig = () => {
  const { getApiConfig, canStartSession } = useBackend();
  return {
    apiConfig: getApiConfig(),
    canStartSession: canStartSession(),
  };
};
