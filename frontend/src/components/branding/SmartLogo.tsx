import { useBackend } from '../../contexts/BackendContext';
import { GeminiWordmark } from './GeminiWordmark';
import { QwenWordmark } from './QwenWordmark';

export const SmartLogo = () => {
  const { selectedBackend } = useBackend();

  if (selectedBackend === 'qwen') {
    return (
      <QwenWordmark height={20} />
    );
  }

  return <GeminiWordmark height={16} />;
};