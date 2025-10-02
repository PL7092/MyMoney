import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { RefreshCw, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export const BackendStatus: React.FC = () => {
  const [status, setStatus] = useState<'checking' | 'connected' | 'disconnected' | 'error'>('checking');
  const [baseUrl, setBaseUrl] = useState<string>('');
  const [isChecking, setIsChecking] = useState(false);

  const checkConnection = async () => {
    setIsChecking(true);
    setStatus('checking');

    const base = (localStorage.getItem('api_base_url') || '').trim();
    setBaseUrl(base);

    if (!base) {
      setStatus('disconnected');
      setIsChecking(false);
      return;
    }

    try {
      const url = `${base.replace(/\/$/, '')}/api/health`;
      console.log('Testing connection to:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          setStatus('connected');
        } else {
          setStatus('error');
        }
      } else {
        setStatus('error');
      }
    } catch (error) {
      console.error('Backend connection test failed:', error);
      setStatus('error');
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  const getStatusBadge = () => {
    switch (status) {
      case 'checking':
        return <Badge variant="secondary" className="gap-1"><RefreshCw className="h-3 w-3 animate-spin" /> Verificando...</Badge>;
      case 'connected':
        return <Badge variant="default" className="gap-1 bg-green-500"><CheckCircle className="h-3 w-3" /> Conectado</Badge>;
      case 'disconnected':
        return <Badge variant="secondary" className="gap-1"><AlertCircle className="h-3 w-3" /> Não Configurado</Badge>;
      case 'error':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Erro de Conexão</Badge>;
    }
  };

  const configureBackend = () => {
    const url = prompt('Digite a URL do seu servidor backend (ex: http://unraid:3000):', baseUrl);
    if (url) {
      localStorage.setItem('api_base_url', url.trim());
      checkConnection();
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Estado da Ligação Backend</CardTitle>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {baseUrl ? (
            <p className="text-sm text-muted-foreground">
              <strong>URL:</strong> {baseUrl}/api
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhuma URL de backend configurada
            </p>
          )}

          {status === 'disconnected' && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
                Para usar todas as funcionalidades, configure a URL do seu servidor MariaDB/backend.
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-300">
                Exemplo: http://seu-servidor:3000
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-200 mb-1">
                Não foi possível conectar ao backend.
              </p>
              <p className="text-xs text-red-600 dark:text-red-300">
                Verifique se o servidor está em execução e acessível.
              </p>
            </div>
          )}

          {status === 'connected' && (
            <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
              <p className="text-sm text-green-800 dark:text-green-200">
                ✅ Backend conectado com sucesso! Todas as funcionalidades estão disponíveis.
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={checkConnection}
              disabled={isChecking}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isChecking ? 'animate-spin' : ''}`} />
              Testar Ligação
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={configureBackend}
            >
              Configurar Backend
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};