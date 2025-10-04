import React, { useState, useRef } from 'react';
import { useFinance } from '../../contexts/FinanceContext';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Progress } from '../ui/progress';
import { Alert, AlertDescription } from '../ui/alert';
import { useToast } from '../ui/use-toast';
import { Upload, Download, FileText, AlertCircle, Sparkles, CheckCircle, Loader2, X } from 'lucide-react';
import { SmartImportReview } from './SmartImportReview';

interface ImportResult {
  success: boolean;
  message: string;
  importedCount: number;
  errors: string[];
}

interface UploadStatus {
  status: 'idle' | 'uploading' | 'processing' | 'ai_processing' | 'completed' | 'error';
  progress: number;
  message: string;
  sessionId?: string;
  error?: string;
}

export const ImportExport: React.FC = () => {
  const { 
    transactions, budgets, accounts, categories,
    addTransaction, addBudget, addAccount 
  } = useFinance();
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [textData, setTextData] = useState('');
  const [uploadMode, setUploadMode] = useState<'file' | 'text'>('file');
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({
    status: 'idle',
    progress: 0,
    message: ''
  });
  const [showReview, setShowReview] = useState(false);

  const supportedFormats = ['.csv', '.xlsx', '.xls', '.pdf'];
  const maxFileSize = 10 * 1024 * 1024; // 10MB

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar formato
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!supportedFormats.includes(fileExtension)) {
      toast({
        title: "Formato não suportado",
        description: `Formatos suportados: ${supportedFormats.join(', ')}`,
        variant: "destructive"
      });
      return;
    }

    // Validar tamanho
    if (file.size > maxFileSize) {
      toast({
        title: "Ficheiro muito grande",
        description: "O ficheiro deve ter menos de 10MB",
        variant: "destructive"
      });
      return;
    }

    setSelectedFile(file);
    setUploadStatus({
      status: 'idle',
      progress: 0,
      message: `Ficheiro selecionado: ${file.name}`
    });
  };

  const handleSmartImport = async () => {
    if (uploadMode === 'file' && !selectedFile) {
      toast({
        title: "Erro",
        description: "Selecione um ficheiro para importar",
        variant: "destructive"
      });
      return;
    }

    if (uploadMode === 'text' && !textData.trim()) {
      toast({
        title: "Erro", 
        description: "Cole os dados para importar",
        variant: "destructive"
      });
      return;
    }

    try {
      if (uploadMode === 'file') {
        await handleFileUpload();
      } else {
        await handleTextUpload();
      }
    } catch (error) {
      console.error('Erro no Smart Import:', error);
      setUploadStatus({
        status: 'error',
        progress: 0,
        message: 'Erro durante a importação',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('userId', user?.id || 'public-user');

    try {
      setUploadStatus({
        status: 'uploading',
        progress: 10,
        message: 'A enviar ficheiro...'
      });

      const response = await fetch('/api/smart-import/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setUploadStatus({
          status: 'processing',
          progress: 50,
          message: 'A processar ficheiro...',
          sessionId: result.sessionId
        });

        // Aguardar processamento
        await pollProcessingStatus(result.sessionId);
      } else {
        throw new Error(result.message || 'Erro no upload');
      }
    } catch (error) {
      console.error('Erro no upload:', error);
      setUploadStatus({
        status: 'error',
        progress: 0,
        message: 'Erro no upload do ficheiro',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  };

  const handleTextUpload = async () => {
    try {
      setUploadStatus({
        status: 'uploading',
        progress: 10,
        message: 'A processar dados...'
      });

      const response = await fetch('/api/smart-import/paste', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          textData,
          userId: user?.id || 'public-user'
        })
      });

      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setUploadStatus({
          status: 'processing',
          progress: 50,
          message: 'A processar dados...',
          sessionId: result.sessionId
        });

        // Aguardar processamento
        await pollProcessingStatus(result.sessionId);
      } else {
        throw new Error(result.message || 'Erro no processamento');
      }
    } catch (error) {
      console.error('Erro no processamento:', error);
      setUploadStatus({
        status: 'error',
        progress: 0,
        message: 'Erro no processamento dos dados',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  };

  const pollProcessingStatus = async (sessionId: string) => {
    const maxAttempts = 30;
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await fetch(`/api/smart-import/status/${sessionId}`);
        const status = await response.json();

        if (status.status === 'completed') {
          setUploadStatus({
            status: 'completed',
            progress: 100,
            message: 'Processamento concluído! A rever transações...',
            sessionId
          });
          setShowReview(true);
          return;
        }

        if (status.status === 'error') {
          throw new Error(status.error || 'Erro no processamento');
        }

        // Atualizar progresso
        const progressMap: Record<string, number> = {
          'parsing': 30,
          'ai_processing': 60,
          'enriching': 80,
          'detecting_duplicates': 90
        };

        setUploadStatus({
          status: status.status,
          progress: progressMap[status.status] || 50,
          message: status.message || 'A processar...',
          sessionId
        });

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 2000);
        } else {
          throw new Error('Timeout no processamento');
        }
      } catch (error) {
        console.error('Erro no polling:', error);
        setUploadStatus({
          status: 'error',
          progress: 0,
          message: 'Erro no processamento',
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        });
      }
    };

    poll();
  };

  const resetImport = () => {
    setSelectedFile(null);
    setTextData('');
    setUploadStatus({
      status: 'idle',
      progress: 0,
      message: ''
    });
    setShowReview(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const exportTransactions = () => {
    const csvContent = [
      'Type,Amount,Description,CategoryId,Entity,AccountId,Date,Tags',
      ...transactions.map(transaction => 
        `${transaction.type},${transaction.amount},"${transaction.description}",${transaction.categoryId},"${transaction.entity || ''}",${transaction.accountId},${transaction.date},"${transaction.tags?.join(', ') || ''}"`
      )
    ].join('\n');
    
    downloadCSV(csvContent, 'transactions.csv');
  };

  const exportBudgets = () => {
    const csvContent = [
      'Name,Amount,Period,StartDate,EndDate,CategoryId,IsActive',
      ...budgets.map(budget => 
        `"${budget.name}",${budget.amount},${budget.period},${budget.startDate},${budget.endDate},${budget.categoryId},${budget.isActive}`
      )
    ].join('\n');
    
    downloadCSV(csvContent, 'budgets.csv');
  };

  const exportAccounts = () => {
    const csvContent = [
      'Name,Type,Balance,Currency,BankName,AccountNumber,IsActive',
      ...accounts.map(account => 
        `"${account.name}",${account.type},${account.balance},${account.currency},"${account.bankName || ''}","${account.accountNumber || ''}",${account.isActive}`
      )
    ].join('\n');
    
    downloadCSV(csvContent, 'accounts.csv');
  };

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Sucesso",
      description: `Arquivo ${filename} baixado com sucesso`,
    });
  };

  if (showReview && uploadStatus.sessionId) {
    return (
      <SmartImportReview
        sessionId={uploadStatus.sessionId}
        onComplete={() => {
          setShowReview(false);
          resetImport();
        }}
        onCancel={() => {
          setShowReview(false);
          resetImport();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Importar/Exportar Dados</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Seção de Importação */}
        <Card className="bg-gradient-card shadow-card">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              <Upload className="h-6 w-6" />
              Importar
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Importação inteligente com IA sempre ativa - Suporte para CSV, XLS, XLSX e PDF
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Indicador de Smart AI sempre ativo */}
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-green-600" />
                <p className="text-sm text-green-700 font-medium">
                  Smart AI Ativo
                </p>
              </div>
              <p className="text-sm text-green-600 mt-1">
                Categorização automática, detecção de duplicatas e validação inteligente
              </p>
            </div>

            {/* Seletor de modo de importação */}
            <div className="space-y-2">
              <Label>Método de Importação</Label>
              <div className="flex gap-2">
                <Button
                  variant={uploadMode === 'file' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setUploadMode('file')}
                  className="flex-1"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Ficheiro
                </Button>
                <Button
                  variant={uploadMode === 'text' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setUploadMode('text')}
                  className="flex-1"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Colar Dados
                </Button>
              </div>
            </div>

            {/* Upload de ficheiro */}
            {uploadMode === 'file' && (
              <div className="space-y-2">
                <Label htmlFor="file-upload">Selecionar Ficheiro</Label>
                <Input
                  ref={fileInputRef}
                  id="file-upload"
                  type="file"
                  accept=".csv,.xls,.xlsx,.pdf"
                  onChange={handleFileSelect}
                />
                <p className="text-xs text-muted-foreground">
                  Formatos suportados: CSV, XLS, XLSX, PDF (máx. 10MB)
                </p>
              </div>
            )}

            {/* Área de texto para colar dados */}
            {uploadMode === 'text' && (
              <div className="space-y-2">
                <Label htmlFor="paste-data">Colar Dados</Label>
                <Textarea
                  id="paste-data"
                  placeholder="Cole aqui dados CSV separados por vírgula ou dados tabulares..."
                  value={textData}
                  onChange={(e) => setTextData(e.target.value)}
                  className="min-h-32 resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Cole dados CSV ou tabulares diretamente
                </p>
              </div>
            )}

            {/* Progresso do upload */}
            {uploadStatus.status !== 'idle' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{uploadStatus.message}</span>
                  {uploadStatus.status === 'error' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={resetImport}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <Progress value={uploadStatus.progress} className="w-full" />
                {uploadStatus.status === 'uploading' && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    A processar...
                  </div>
                )}
                {uploadStatus.status === 'completed' && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    Processamento concluído!
                  </div>
                )}
                {uploadStatus.status === 'error' && uploadStatus.error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{uploadStatus.error}</AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* Botão de importação */}
            <Button 
              onClick={handleSmartImport}
              disabled={
                uploadStatus.status === 'uploading' || 
                uploadStatus.status === 'processing' ||
                uploadStatus.status === 'ai_processing' ||
                (uploadMode === 'file' && !selectedFile) ||
                (uploadMode === 'text' && !textData.trim())
              }
              className="w-full"
            >
              {uploadStatus.status === 'uploading' || uploadStatus.status === 'processing' || uploadStatus.status === 'ai_processing' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  A processar...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Importar com Smart AI
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Seção de Exportação */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              <Download className="h-6 w-6" />
              Exportar
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Exportar dados em formato CSV
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Transações</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    {transactions.length} transações disponíveis
                  </p>
                  <Button 
                    onClick={exportTransactions} 
                    variant="outline" 
                    className="w-full"
                    disabled={transactions.length === 0}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Exportar Transações
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Orçamentos</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    {budgets.length} orçamentos disponíveis
                  </p>
                  <Button 
                    onClick={exportBudgets} 
                    variant="outline" 
                    className="w-full"
                    disabled={budgets.length === 0}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Exportar Orçamentos
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Contas</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    {accounts.length} contas disponíveis
                  </p>
                  <Button 
                    onClick={exportAccounts} 
                    variant="outline" 
                    className="w-full"
                    disabled={accounts.length === 0}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Exportar Contas
                  </Button>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
       </div>

       {/* Componente de revisão do Smart Import */}
       {showReview && uploadStatus.sessionId && (
         <SmartImportReview
           sessionId={uploadStatus.sessionId}
           onCancel={() => {
             setShowReview(false);
             resetImport();
           }}
           onComplete={() => {
             setShowReview(false);
             resetImport();
             // Recarregar dados se necessário
             window.location.reload();
           }}
         />
       )}
     </div>
   );
 };