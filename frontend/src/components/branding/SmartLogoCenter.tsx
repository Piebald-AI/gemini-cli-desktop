import React from 'react';
import { useBackend } from '../../contexts/BackendContext';
import { GeminiWordmark } from './GeminiWordmark';
import { QwenWordmark } from './QwenWordmark';

export const SmartLogoCenter: React.FC = () => {
  const { selectedBackend } = useBackend();
  
  if (selectedBackend === 'qwen') {
    return <QwenWordmark height={40} />;
  }
  
  return <GeminiWordmark height={35} />;
};