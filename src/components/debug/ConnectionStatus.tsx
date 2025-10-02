import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";

interface ConnectionStatusProps {
  className?: string;
}

export function ConnectionStatus({ className }: ConnectionStatusProps) {
  const [status, setStatus] = useState<{
    backend: 'checking' | 'connected' | 'error';
    database: 'checking' | 'connected' | 'error';
    message?: string;
  }>({
    backend: 'checking',
    database: 'checking'
  });
  const [isChecking, setIsChecking] = useState(false);
  const { toast } = useToast();

  const checkConnection = async () => {
    setIsChecking(true);
    setStatus({ backend: 'checking', database: 'checking' });

    try {
      // Check backend health
      const healthResponse = await fetch('/api/health');
      
      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        setStatus({
          backend: 'connected',
          database: healthData.database?.status === 'connected' ? 'connected' : 'error',
          message: healthData.database?.error
        });
      } else {
        setStatus({
          backend: 'error',
          database: 'error',
          message: 'Backend não está respondendo'
        });
      }
    } catch (error) {
      setStatus({
        backend: 'error',
        database: 'error',
        message: 'Falha na conexão com o backend'
      });
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkConnection();
    // Check every 30 seconds
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'checking':
        return <RefreshCw className="h-4 w-4 text-yellow-500 animate-spin" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Conectado</Badge>;
      case 'error':
        return <Badge variant="destructive">Erro</Badge>;
      case 'checking':
        return <Badge variant="outline">Verificando...</Badge>;
      default:
        return <Badge variant="outline">Desconhecido</Badge>;
    }
  };

  const handleRetry = () => {
    toast({
      title: "Reconectando...",
      description: "Tentando restabelecer conexão com o backend.",
    });
    checkConnection();
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          Status da Conexão
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRetry}
            disabled={isChecking}
          >
            <RefreshCw className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon(status.backend)}
            <span className="font-medium">Backend API</span>
          </div>
          {getStatusBadge(status.backend)}
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon(status.database)}
            <span className="font-medium">Base de Dados</span>
          </div>
          {getStatusBadge(status.database)}
        </div>

        {status.message && (
          <Alert variant={status.database === 'error' ? 'destructive' : 'default'}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {status.message}
            </AlertDescription>
          </Alert>
        )}

        {(status.backend === 'error' || status.database === 'error') && (
          <div className="pt-2">
            <Button onClick={handleRetry} variant="outline" className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" />
              Tentar Novamente
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}