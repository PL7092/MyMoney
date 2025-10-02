import React from 'react';
import { InvestmentManager } from '../components/investments/InvestmentManager';
import { ErrorBoundary } from '../components/common/ErrorBoundary';

const Investments: React.FC = () => {
  return (
    <ErrorBoundary>
      <InvestmentManager />
    </ErrorBoundary>
  );
};

export default Investments;