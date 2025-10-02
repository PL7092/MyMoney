import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Progress } from '../ui/progress';
import { Upload, FileText, Clipboard, Download, CheckCircle, AlertCircle, X } from 'lucide-react';
import { toast } from '../../hooks/use-toast';
import { useFinance } from '../../contexts/FinanceContext';
import { Badge } from '../ui/badge';
import Papa from 'papaparse';

interface TransactionImportWizardProps {
  onClose: () => void;
}

interface ParsedTransaction {
  description: string;
  amount: number;
  type: 'income' | 'expense';
  date: string;
  category_id?: string;
  account_id?: string;
  entity?: string;
  isDuplicate?: boolean;
}

export const TransactionImportWizard: React.FC<TransactionImportWizardProps> = ({ onClose }) => {
  const { accounts, categories } = useFinance();
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [parsedTransactions, setParsedTransactions] = useState<ParsedTransaction[]>([]);
  const [importResults, setImportResults] = useState<any>(null);
  const [pasteData, setPasteData] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState('upload');

  const supportedFormats = [
    { ext: 'CSV', desc: 'Arquivos separados por vírgula' },
    { ext: 'TXT', desc: 'Dados de texto estruturado' },
    { ext: 'XLSX', desc: 'Planilhas Excel (converta para CSV)' },
    { ext: 'XLS', desc: 'Planilhas Excel legadas (converta para CSV)' }
  ];

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) { // 20MB limit
        toast({
          title: "Arquivo muito grande",
          description: "O arquivo deve ter no máximo 20MB",
          variant: "destructive"
        });
        return;
      }
      setSelectedFile(file);
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const file = files[0];
      setSelectedFile(file);
      processFile(file);
    }
  };

  const processFile = async (file: File) => {
    setIsProcessing(true);
    setProcessingProgress(0);
    
    try {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      
      if (fileExtension === 'csv' || fileExtension === 'txt') {
        const text = await file.text();
        parseCSVData(text);
      } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        toast({
          title: "Formato Excel",
          description: "Por favor, exporte como CSV para importar dados Excel",
          variant: "destructive"
        });
        setIsProcessing(false);
        return;
      } else {
        throw new Error('Formato de arquivo não suportado');
      }
    } catch (error) {
      console.error('Error processing file:', error);
      toast({
        title: "Erro no processamento",
        description: "Não foi possível processar o arquivo",
        variant: "destructive"
      });
      setIsProcessing(false);
    }
  };

  const parseCSVData = (csvText: string) => {
    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const transactions = results.data.map((row: any, index: number) => {
            setProcessingProgress(((index + 1) / results.data.length) * 100);
            
            // Try to map common column names
            const description = row['Descrição'] || row['Description'] || row['Memo'] || row['Detalhes'] || '';
            const amountStr = row['Montante'] || row['Amount'] || row['Valor'] || row['Value'] || '0';
            const dateStr = row['Data'] || row['Date'] || new Date().toISOString().split('T')[0];
            const typeStr = row['Tipo'] || row['Type'] || 'expense';
            
            // Parse amount
            let amount = 0;
            if (typeof amountStr === 'string') {
              // Remove currency symbols and parse
              const cleanAmount = amountStr.replace(/[€$£,\s]/g, '').replace(',', '.');
              amount = Math.abs(parseFloat(cleanAmount) || 0);
            } else {
              amount = Math.abs(Number(amountStr) || 0);
            }

            // Determine type based on amount or explicit type
            let type: 'income' | 'expense' = 'expense';
            if (typeStr.toLowerCase().includes('income') || typeStr.toLowerCase().includes('receita') || 
                (typeof amountStr === 'string' && amountStr.includes('+'))) {
              type = 'income';
            }

            // Parse date
            let date = new Date().toISOString().split('T')[0];
            if (dateStr) {
              const parsedDate = new Date(dateStr);
              if (!isNaN(parsedDate.getTime())) {
                date = parsedDate.toISOString().split('T')[0];
              }
            }

            return {
              description: description || 'Transação importada',
              amount,
              type,
              date,
              category_id: categories.length > 0 ? categories[0].id : undefined,
              account_id: accounts.length > 0 ? accounts[0].id : undefined,
              entity: row['Entidade'] || row['Entity'] || 'Importação'
            } as ParsedTransaction;
          });

          setParsedTransactions(transactions);
          setProcessingProgress(100);
          
          toast({
            title: "Arquivo processado",
            description: `${transactions.length} transações encontradas`,
          });
        } catch (error) {
          console.error('Error parsing CSV:', error);
          toast({
            title: "Erro na análise",
            description: "Formato de dados não reconhecido",
            variant: "destructive"
          });
        }
        setIsProcessing(false);
      },
      error: (error) => {
        console.error('CSV parse error:', error);
        toast({
          title: "Erro no CSV",
          description: "Não foi possível analisar o arquivo CSV",
          variant: "destructive"
        });
        setIsProcessing(false);
      }
    });
  };

  const processPasteData = () => {
    if (!pasteData.trim()) {
      toast({
        title: "Dados vazios",
        description: "Cole os dados das transações no campo acima",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    parseCSVData(pasteData);
  };

  const importTransactions = async () => {
    if (parsedTransactions.length === 0) {
      toast({
        title: "Nenhuma transação",
        description: "Não há transações para importar",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    setProcessingProgress(0);

    try {
      const response = await fetch('/api/import/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactions: parsedTransactions,
          smartImport: true
        }),
      });

      if (!response.ok) {
        throw new Error('Falha na importação');
      }

      const result = await response.json();
      setImportResults(result.data);
      
      toast({
        title: "Importação concluída",
        description: result.message,
      });
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: "Erro na importação",
        description: "Não foi possível importar as transações",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const resetWizard = () => {
    setSelectedFile(null);
    setParsedTransactions([]);
    setImportResults(null);
    setPasteData('');
    setProcessingProgress(0);
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">Smart Import de Transações</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Importação inteligente com detecção automática e categorização
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {!importResults ? (
          <>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="upload" className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Carregar Ficheiro
                </TabsTrigger>
                <TabsTrigger value="paste" className="flex items-center gap-2">
                  <Clipboard className="h-4 w-4" />
                  Colar Dados
                </TabsTrigger>
              </TabsList>

              <TabsContent value="upload" className="space-y-4">
                <div 
                  className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-muted-foreground/50 transition-colors"
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  <div className="space-y-4">
                    <div className="mx-auto w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                    
                    <div>
                      <h3 className="font-medium">Arraste ficheiros aqui ou clique para selecionar</h3>
                      <p className="text-sm text-muted-foreground">Máximo 20MB por ficheiro</p>
                    </div>

                    <Input
                      type="file"
                      accept=".csv,.xlsx,.xls,.txt"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="file-upload"
                    />
                    <Label htmlFor="file-upload" className="cursor-pointer">
                      <Button variant="outline" type="button">Selecionar Ficheiro</Button>
                    </Label>

                    {selectedFile && (
                      <div className="text-sm">
                        <Badge variant="secondary">{selectedFile.name}</Badge>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {supportedFormats.map((format) => (
                    <div key={format.ext} className="p-3 border rounded-lg">
                      <div className="font-medium text-sm">{format.ext}</div>
                      <div className="text-xs text-muted-foreground">{format.desc}</div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="paste" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="paste-data">Cole os dados das transações (CSV format)</Label>
                  <Textarea
                    id="paste-data"
                    placeholder="Data,Descrição,Montante,Tipo&#10;2024-01-15,Supermercado,-45.67,expense&#10;2024-01-15,Salário,2500.00,income"
                    value={pasteData}
                    onChange={(e) => setPasteData(e.target.value)}
                    rows={8}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Formato esperado: Data, Descrição, Montante, Tipo (uma transação por linha)
                  </p>
                </div>

                <Button onClick={processPasteData} disabled={isProcessing || !pasteData.trim()}>
                  <Clipboard className="h-4 w-4 mr-2" />
                  Processar Dados
                </Button>
              </TabsContent>
            </Tabs>

            {isProcessing && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Processando...</span>
                  <span>{Math.round(processingProgress)}%</span>
                </div>
                <Progress value={processingProgress} />
              </div>
            )}

            {parsedTransactions.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-medium">Preview das Transações ({parsedTransactions.length})</h3>
                
                <div className="border rounded-lg max-h-60 overflow-y-auto">
                  <div className="p-2 bg-muted text-xs font-medium grid grid-cols-4 gap-2">
                    <span>Data</span>
                    <span>Descrição</span>
                    <span>Montante</span>
                    <span>Tipo</span>
                  </div>
                  {parsedTransactions.slice(0, 10).map((transaction, index) => (
                    <div key={index} className="p-2 text-sm border-t grid grid-cols-4 gap-2">
                      <span>{new Date(transaction.date).toLocaleDateString()}</span>
                      <span className="truncate">{transaction.description}</span>
                      <span className={transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}>
                        €{transaction.amount.toFixed(2)}
                      </span>
                      <Badge variant={transaction.type === 'income' ? 'default' : 'secondary'} className="text-xs">
                        {transaction.type === 'income' ? 'Receita' : 'Despesa'}
                      </Badge>
                    </div>
                  ))}
                  {parsedTransactions.length > 10 && (
                    <div className="p-2 text-xs text-muted-foreground text-center">
                      ... e mais {parsedTransactions.length - 10} transações
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <Button onClick={resetWizard} variant="outline" className="flex-1">
                    Reiniciar
                  </Button>
                  <Button onClick={importTransactions} disabled={isProcessing} className="flex-1">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Importar {parsedTransactions.length} Transações
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4">
            <div className="text-center">
              <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold">Importação Concluída!</h3>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 border rounded-lg">
                <div className="text-2xl font-bold text-green-600">{importResults.imported}</div>
                <div className="text-sm text-muted-foreground">Importadas</div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{importResults.duplicates}</div>
                <div className="text-sm text-muted-foreground">Duplicados</div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-2xl font-bold text-red-600">{importResults.errors?.length || 0}</div>
                <div className="text-sm text-muted-foreground">Erros</div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button onClick={resetWizard} variant="outline" className="flex-1">
                Nova Importação
              </Button>
              <Button onClick={onClose} className="flex-1">
                Concluir
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};