// Utility functions for date formatting and manipulation
export const formatDatePT = (date: string | Date): string => {
  const d = new Date(date);
  return d.toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

// ... keep existing code (formatDatePT function)

export const formatDateWithUserFormat = (date: string | Date): string => {
  const d = new Date(date);
  const format = localStorage.getItem('dateFormat') || 'DD/MM/YYYY';
  
  if (format === 'MM/DD/YYYY') {
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

export const formatDateTimePT = (date: string | Date): string => {
  const d = new Date(date);
  return d.toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// ... keep existing code (remaining functions)

export const formatMonthYearPT = (date: Date): string => {
  return date.toLocaleDateString('pt-PT', {
    month: 'long',
    year: 'numeric'
  });
};

export const formatMonthPT = (monthIndex: number): string => {
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  return months[monthIndex];
};

export const configureDateInput = (input: HTMLInputElement): void => {
  if (input.type === 'date') {
    input.setAttribute('data-date-format', 'dd/mm/yyyy');
    input.setAttribute('data-date', input.value);
    
    input.addEventListener('change', function() {
      this.setAttribute('data-date', this.value);
    });
  }
};

export const getCurrentMonthRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0]
  };
};

export const formatDateForInput = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

export const getDateRange = (months: number) => {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const start = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
  
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0]
  };
};