import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Progress } from '../ui/progress';
import { Alert, AlertDescription } from '../ui/alert';
import { useToast } from '../ui/use-toast';
import { 
  Upload, 
  FileText, 
  Sparkles, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  X
} from 'lucide-react';
import { SmartImportReview } from './SmartImportReview';

interface UploadStatus {
  status: 'idle' | 'uploading' | 'processing' | 'ai_processing' | 'completed' | 'error';
  progress: number;
  message: string;
  sessionId?: string;
  error?: string;
}

interface SmartImportUploadProps {
  onComplete?: () => void;
}

export const SmartImportUpload: React.FC<SmartImportUploadProps> = ({ onComplete }) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({
    status: 'idle',
    progress: 0,
    message: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [textData, setTextData] = useState('');
  const [uploadMode, setUploadMode] = useState<'file' | 'text'>('file');
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

  const handleFileUpload = async () => {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('file', selectedFile);

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
        throw new Error('Erro no upload do ficheiro');
      }

      const result = await response.json();
      
      setUploadStatus({
        status: 'processing',
        progress: 30,
        message: 'A processar ficheiro...',
        sessionId: result.sessionId
      });

      // Monitorizar o progresso
      monitorProcessing(result.sessionId);

    } catch (error) {
      console.error('Erro no upload:', error);
      setUploadStatus({
        status: 'error',
        progress: 0,
        message: 'Erro no upload do ficheiro',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
      
      toast({
        title: "Erro no upload",
        description: "Não foi possível enviar o ficheiro",
        variant: "destructive"
      });
    }
  };

  const handleTextUpload = async () => {
    if (!textData.trim()) {
      toast({
        title: "Dados em falta",
        description: "Introduza os dados de texto para processar",
        variant: "destructive"
      });
      return;
    }

    try {
      setUploadStatus({
        status: 'uploading',
        progress: 10,
        message: 'A enviar dados de texto...'
      });

      const response = await fetch('/api/smart-import/paste', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ textData })
      });

      if (!response.ok) {
        throw new Error('Erro no processamento dos dados');
      }

      const result = await response.json();
      
      setUploadStatus({
        status: 'processing',
        progress: 30,
        message: 'A processar dados...',
        sessionId: result.sessionId
      });

      // Monitorizar o progresso
      monitorProcessing(result.sessionId);

    } catch (error) {
      console.error('Erro no processamento:', error);
      setUploadStatus({
        status: 'error',
        progress: 0,
        message: 'Erro no processamento dos dados',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
      
      toast({
        title: "Erro no processamento",
        description: "Não foi possível processar os dados",
        variant: "destructive"
      });
    }
  };

  const monitorProcessing = async (sessionId: string) => {
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/smart-import/status/${sessionId}`);
        if (!response.ok) throw new Error('Erro ao verificar status');
        
        const status = await response.json();
        
        switch (status.status) {
          case 'processing':
            setUploadStatus({
              status: 'processing',
              progress: 50,
              message: 'A analisar dados...',
              sessionId
            });
            setTimeout(checkStatus, 2000);
            break;
            
          case 'ai_processing':
            setUploadStatus({
              status: 'ai_processing',
              progress: 75,
              message: 'A aplicar inteligência artificial...',
              sessionId
            });
            setTimeout(checkStatus, 2000);
            break;
            
          case 'completed':
            setUploadStatus({
              status: 'completed',
              progress: 100,
              message: 'Processamento concluído!',
              sessionId
            });
            setShowReview(true);
            break;
            
          case 'error':
            setUploadStatus({
              status: 'error',
              progress: 0,
              message: 'Erro no processamento',
              sessionId,
              error: status.error
            });
            break;
            
          default:
            setTimeout(checkStatus, 2000);
        }
      } catch (error) {
        console.error('Erro ao verificar status:', error);
        setUploadStatus({
          status: 'error',
          progress: 0,
          message: 'Erro ao verificar progresso',
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        });
      }
    };

    checkStatus();
  };

  const handleReviewComplete = async (acceptedTransactions: any[]) => {
    try {
      // Aqui implementaríamos a gravação final das transações
      // Por agora, apenas mostramos uma mensagem de sucesso
      
      toast({
        title: "Importação concluída",
        description: `${acceptedTransactions.length} transações importadas com sucesso`,
      });
      
      // Limpar estado
      resetUpload();
      
      if (onComplete) {
        onComplete();
      }
      
    } catch (error) {
      console.error('Erro na importação final:', error);
      toast({
        title: "Erro na importação",
        description: "Erro ao gravar as transações",
        variant: "destructive"
      });
    }
  };

  const handleReviewCancel = () => {
    setShowReview(false);
    resetUpload();
  };

  const resetUpload = () => {
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

  const getStatusIcon = () => {
    switch (uploadStatus.status) {
      case 'uploading':
      case 'processing':
      case 'ai_processing':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-600" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Sparkles className="h-5 w-5 text-blue-600" />;
    }
  };

  const getStatusColor = () => {
    switch (uploadStatus.status) {
      case 'completed':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      case 'uploading':
      case 'processing':
      case 'ai_processing':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  };

  if (showReview && uploadStatus.sessionId) {
    return (
      <SmartImportReview
        sessionId={uploadStatus.sessionId}
        onComplete={handleReviewComplete}
        onCancel={handleReviewCancel}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            Importação Inteligente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Seletor de modo */}
            <div className="flex gap-2">
              <Button
                variant={uploadMode === 'file' ? 'default' : 'outline'}
                onClick={() => setUploadMode('file')}
                className="flex-1"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload de Ficheiro
              </Button>
              <Button
                variant={uploadMode === 'text' ? 'default' : 'outline'}
                onClick={() => setUploadMode('text')}
                className="flex-1"
              >
                <FileText className="h-4 w-4 mr-2" />
                Colar Texto
              </Button>
            </div>

            {uploadMode === 'file' ? (
              /* Upload de ficheiro */
              <div className="space-y-4">
                <div>
                  <Label htmlFor="file-upload">Selecionar Ficheiro</Label>
                  <Input
                    id="file-upload"
                    type="file"
                    ref={fileInputRef}
                    accept={supportedFormats.join(',')}
                    onChange={handleFileSelect}
                    disabled={uploadStatus.status !== 'idle'}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Formatos suportados: {supportedFormats.join(', ')} (máx. 10MB)
                  </p>
                </div>

                {selectedFile && (
                  <Alert>
                    <FileText className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Ficheiro selecionado:</strong> {selectedFile.name}
                      <br />
                      <strong>Tamanho:</strong> {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </AlertDescription>
                  </Alert>
                )}

                <Button
                  onClick={handleFileUpload}
                  disabled={!selectedFile || uploadStatus.status !== 'idle'}
                  className="w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Processar Ficheiro
                </Button>
              </div>
            ) : (
              /* Upload de texto */
              <div className="space-y-4">
                <div>
                  <Label htmlFor="text-data">Dados de Transações</Label>
                  <Textarea
                    id="text-data"
                    placeholder="Cole aqui os dados das transações (CSV, texto estruturado, etc.)"
                    value={textData}
                    onChange={(e) => setTextData(e.target.value)}
                    disabled={uploadStatus.status !== 'idle'}
                    rows={8}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Suporta dados CSV, texto estruturado ou dados copiados de bancos
                  </p>
                </div>

                <Button
                  onClick={handleTextUpload}
                  disabled={!textData.trim() || uploadStatus.status !== 'idle'}
                  className="w-full"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Processar Texto
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Status do processamento */}
      {uploadStatus.status !== 'idle' && (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {getStatusIcon()}
                <span className={`font-medium ${getStatusColor()}`}>
                  {uploadStatus.message}
                </span>
                {uploadStatus.status !== 'error' && uploadStatus.status !== 'completed' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetUpload}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {uploadStatus.progress > 0 && uploadStatus.status !== 'error' && (
                <Progress value={uploadStatus.progress} className="w-full" />
              )}

              {uploadStatus.error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {uploadStatus.error}
                  </AlertDescription>
                </Alert>
              )}

              {uploadStatus.status === 'completed' && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Processamento concluído! Clique em "Continuar" para revisar as transações.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Informações sobre o Smart Import */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Como funciona a Importação Inteligente?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">1</div>
              <div>
                <strong>Análise Automática:</strong> O sistema analisa automaticamente os dados e identifica transações.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">2</div>
              <div>
                <strong>Sugestões IA:</strong> A inteligência artificial sugere categorias, entidades e tags baseadas no histórico.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">3</div>
              <div>
                <strong>Deteção de Duplicados:</strong> Identifica possíveis transações duplicadas para evitar importações repetidas.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">4</div>
              <div>
                <strong>Revisão Manual:</strong> Permite revisar e editar todas as sugestões antes da importação final.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};