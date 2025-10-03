import React from 'react';

const TestComponent = () => {
  console.log("🧪 TestComponent rendering");
  
  return (
    <div style={{ 
      padding: '20px', 
      backgroundColor: '#f0f0f0', 
      border: '2px solid red',
      fontSize: '24px',
      fontWeight: 'bold'
    }}>
      <h1>🧪 TESTE - React está funcionando!</h1>
      <p>Se você vê esta mensagem, o React está renderizando corretamente.</p>
      <p>Timestamp: {new Date().toLocaleString()}</p>
    </div>
  );
};

export default TestComponent;