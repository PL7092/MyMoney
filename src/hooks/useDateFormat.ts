import { useSettings } from '@/contexts/SettingsContext';

export const useDateFormat = () => {
  const { settings } = useSettings();
  
  // Fallback to localStorage when settings are not available
  const dateFormat = settings?.appSettings?.dateFormat || localStorage.getItem('dateFormat') || 'DD/MM/YYYY';

  const formatDateForDisplay = (date: string | Date): string => {
    const d = new Date(date);
    
    if (dateFormat === 'MM/DD/YYYY') {
      return d.toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric'
      });
    }
    
    return d.toLocaleDateString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatDateTimeForDisplay = (date: string | Date): string => {
    const d = new Date(date);
    
    if (dateFormat === 'MM/DD/YYYY') {
      return d.toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    
    return d.toLocaleDateString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateForInput = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  return {
    formatDateForDisplay,
    formatDateTimeForDisplay,
    formatDateForInput,
    dateFormat
  };
};