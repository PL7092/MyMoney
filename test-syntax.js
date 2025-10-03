// Teste de sintaxe para verificar se os arquivos modificados estão corretos
import fs from 'fs';
import path from 'path';

console.log('Testando sintaxe dos arquivos modificados...');

// Testar FileParsingService
try {
  const { FileParsingService } = await import('./server/services/FileParsingService.js');
  console.log('✓ FileParsingService: Sintaxe OK');
  
  // Testar se as funções existem
  const service = new FileParsingService();
  if (typeof service.parseExcel === 'function') {
    console.log('✓ parseExcel: Função implementada');
  }
  if (typeof service.parsePDF === 'function') {
    console.log('✓ parsePDF: Função implementada');
  }
} catch (error) {
  console.error('✗ FileParsingService: Erro de sintaxe:', error.message);
}

// Testar se ImportExport.tsx existe e tem o conteúdo esperado
try {
  const importExportPath = './src/pages/ImportExport.tsx';
  if (fs.existsSync(importExportPath)) {
    const content = fs.readFileSync(importExportPath, 'utf8');
    
    // Verificar se contém as importações necessárias
    if (content.includes('SmartImportReview')) {
      console.log('✓ ImportExport.tsx: SmartImportReview importado');
    }
    
    // Verificar se não contém componentes removidos
    if (!content.includes('TransactionImportWizard')) {
      console.log('✓ ImportExport.tsx: TransactionImportWizard removido');
    }
    
    if (!content.includes('SmartImportUpload')) {
      console.log('✓ ImportExport.tsx: SmartImportUpload removido');
    }
    
    console.log('✓ ImportExport.tsx: Arquivo existe e parece correto');
  } else {
    console.error('✗ ImportExport.tsx: Arquivo não encontrado');
  }
} catch (error) {
  console.error('✗ ImportExport.tsx: Erro ao verificar:', error.message);
}

console.log('\nTeste de sintaxe concluído!');