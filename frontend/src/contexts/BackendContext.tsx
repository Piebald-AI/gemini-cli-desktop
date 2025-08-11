import React, { createContext, useContext, ReactNode } from 'react';

interface BackendContextType {
  selectedBackend: string;
}

const BackendContext = createContext<BackendContextType | undefined>(undefined);

export const useBackend = () => {
  const context = useContext(BackendContext);
  if (context === undefined) {
    throw new Error('useBackend must be used within a BackendProvider');
  }
  return context;
};

interface BackendProviderProps {
  selectedBackend: string;
  children: ReactNode;
}

export const BackendProvider: React.FC<BackendProviderProps> = ({
  selectedBackend,
  children,
}) => {
  return (
    <BackendContext.Provider value={{ selectedBackend }}>
      {children}
    </BackendContext.Provider>
  );
};