import React from 'react';
import { AccountsManager } from '../components/accounts/AccountsManager';
import { ErrorBoundary } from '../components/common/ErrorBoundary';

const Accounts: React.FC = () => {
  return (
    <ErrorBoundary>
      <AccountsManager />
    </ErrorBoundary>
  );
};

export default Accounts;