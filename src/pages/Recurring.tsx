import React from 'react';
import { RecurringManager } from '../components/recurring/RecurringManager';
import { ErrorBoundary } from '../components/common/ErrorBoundary';

const Recurring: React.FC = () => {
  return (
    <ErrorBoundary>
      <RecurringManager />
    </ErrorBoundary>
  );
};

export default Recurring;