import React from 'react';
import { ReportsManager } from '../components/reports/ReportsManager';
import { ErrorBoundary } from '../components/common/ErrorBoundary';

const Reports: React.FC = () => {
  return (
    <ErrorBoundary>
      <ReportsManager />
    </ErrorBoundary>
  );
};

export default Reports;