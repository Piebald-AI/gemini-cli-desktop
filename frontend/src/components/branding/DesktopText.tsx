import React from 'react';
import { useBackend } from '../../contexts/BackendContext';

interface DesktopTextProps {
  size?: 'small' | 'large';
  className?: string;
}

export const DesktopText: React.FC<DesktopTextProps> = ({ size = 'small', className = '' }) => {
  const { selectedBackend } = useBackend();
  
  const gradientClass = selectedBackend === 'qwen' ? 'gradient-text-desktop-purple' : 'gradient-text-desktop';
  const sizeClass = size === 'large' ? 'text-4xl' : 'text-lg';
  
  return (
    <span className={`font-medium ${gradientClass} ${sizeClass} ${className}`}>
      Desktop
    </span>
  );
};