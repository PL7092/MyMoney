import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { useToast } from '../ui/use-toast';
import { 
  CheckCircle, 
  AlertTriangle, 
  Edit3, 
  Save, 
  X, 
  Upload,
  FileText,
  Sparkles,
  Eye,
  EyeOff,
  Copy
} from 'lucide-react';
import { useFinance } from '../../contexts/FinanceContext';

interface SmartTransaction {
  id: string;
  originalData: {
    date: string;
    description: string;
    amount: number;
    entity?: string;
    reference?: string;
  };
  suggestions: {
    category: {
      id: string;
      name: string;
      confidence: number;
      reason: string;
    };
    entity: {
      name: string;
      confidence: number;
      reason: string;
    };
    type: 'income' | 'expense' | 'transfer';
    tags: string[];
  };
  userChoices?: {
    categoryId?: string;
    entity?: string;
    type?: 'income' | 'expense' | 'transfer';
    tags?: string[];
    description?: string;
  };
  status: 'pending' | 'reviewed' | 'accepted' | 'rejected';
  duplicateWarning?: {
    isDuplicate: boolean;
    similarTransactions: Array<{
      id: string;
      date: string;
      description: string;
      amount: number;
      similarity: number;
    }>;
  };
}

interface SmartImportReviewProps {
  sessionId: string;
  onComplete: (acceptedTransactions: SmartTransaction[]) => void;
  onCancel: () => void;
}

export const SmartImportReview: React.FC<SmartImportReviewProps> = ({
  sessionId,
  onComplete,
  onCancel
}) => {
  const { categories, accounts } = useFinance();
  const { toast } = useToast();
  
  const [transactions, setTransactions] = useState<SmartTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showDuplicates, setShowDuplicates] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'duplicates'>('all');

  useEffect(() => {
    loadTransactions();
  }, [sessionId]);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/smart-import/transactions/${sessionId}`);
      
      if (!response.ok) {
        throw new Error('Erro ao carregar transações');
      }
      
      const data = await response.json();
      setTransactions(data.transactions || []);
    } catch (error) {
      console.error('Erro ao carregar transações:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as transações",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptSuggestion = async (transactionId: string) => {
    const transaction = transactions.find(t => t.id === transactionId);
    if (!transaction) return;

    try {
      const response = await fetch('/api/smart-import/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          transactionId,
          userChoice: {
            categoryId: transaction.suggestions.category.id,
            entity: transaction.suggestions.entity.name,
            type: transaction.suggestions.type,
            tags: transaction.suggestions.tags,
            accepted: true
          }
        })
      });

      if (response.ok) {
        setTransactions(prev => prev.map(t => 
          t.id === transactionId 
            ? { ...t, status: 'accepted' as const }
            : t
        ));
        
        toast({
          title: "Sugestão aceite",
          description: "A transação foi marcada como aceite"
        });
      }
    } catch (error) {
      console.error('Erro ao aceitar sugestão:', error);
      toast({
        title: "Erro",
        description: "Erro ao aceitar sugestão",
        variant: "destructive"
      });
    }
  };

  const handleRejectTransaction = async (transactionId: string) => {
    try {
      const response = await fetch('/api/smart-import/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          transactionId,
          userChoice: {
            accepted: false
          }
        })
      });

      if (response.ok) {
        setTransactions(prev => prev.map(t => 
          t.id === transactionId 
            ? { ...t, status: 'rejected' as const }
            : t
        ));
        
        toast({
          title: "Transação rejeitada",
          description: "A transação foi marcada como rejeitada"
        });
      }
    } catch (error) {
      console.error('Erro ao rejeitar transação:', error);
      toast({
        title: "Erro",
        description: "Erro ao rejeitar transação",
        variant: "destructive"
      });
    }
  };

  const handleEditTransaction = (transactionId: string) => {
    setEditingId(transactionId);
  };

  const handleSaveEdit = async (transactionId: string, editedData: any) => {
    try {
      const response = await fetch('/api/smart-import/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          transactionId,
          userChoice: {
            ...editedData,
            accepted: true
          }
        })
      });

      if (response.ok) {
        setTransactions(prev => prev.map(t => 
          t.id === transactionId 
            ? { 
                ...t, 
                userChoices: editedData,
                status: 'reviewed' as const 
              }
            : t
        ));
        
        setEditingId(null);
        toast({
          title: "Transação atualizada",
          description: "As alterações foram guardadas"
        });
      }
    } catch (error) {
      console.error('Erro ao guardar alterações:', error);
      toast({
        title: "Erro",
        description: "Erro ao guardar alterações",
        variant: "destructive"
      });
    }
  };

  const handleCompleteImport = async () => {
    const acceptedTransactions = transactions.filter(t => 
      t.status === 'accepted' || t.status === 'reviewed'
    );
    
    if (acceptedTransactions.length === 0) {
      toast({
        title: "Nenhuma transação selecionada",
        description: "Selecione pelo menos uma transação para importar",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);
      
      const response = await fetch('/api/smart-import/finalize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          approvedTransactions: acceptedTransactions.map(t => ({
            date: t.originalData.date,
            description: t.originalData.description,
            amount: t.originalData.amount,
            type: t.suggestions.type,
            category_id: t.userChoices?.categoryId || t.suggestions.category.id,
            account_id: t.userChoices?.accountId || null, // Note: account_id não está definido nas suggestions
            userFeedback: t.status === 'reviewed' || t.status === 'accepted'
          }))
        })
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: "Importação finalizada!",
          description: `${result.summary.success} transações importadas com sucesso`,
        });
        
        // Chamar callback de conclusão
        onComplete(acceptedTransactions);
      } else {
        throw new Error(result.error || 'Erro ao finalizar importação');
      }
    } catch (error) {
      console.error('Erro ao finalizar importação:', error);
      toast({
        title: "Erro",
        description: "Erro ao finalizar importação",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-100 text-green-800';
    if (confidence >= 0.6) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'accepted':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'rejected':
        return <X className="h-4 w-4 text-red-600" />;
      case 'reviewed':
        return <Edit3 className="h-4 w-4 text-blue-600" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    }
  };

  const filteredTransactions = transactions.filter(t => {
    if (filter === 'pending') return t.status === 'pending';
    if (filter === 'duplicates') return t.duplicateWarning?.isDuplicate;
    return true;
  });

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2">A carregar transações...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            Revisão de Importação Inteligente
          </CardTitle>
          <div className="flex items-center gap-4">
            <Select value={filter} onValueChange={(value: any) => setFilter(value)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as transações</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="duplicates">Possíveis duplicados</SelectItem>
              </SelectContent>
            </Select>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDuplicates(!showDuplicates)}
            >
              {showDuplicates ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showDuplicates ? 'Ocultar' : 'Mostrar'} duplicados
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 mb-4">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Total: {transactions.length} transações</span>
              <span>Aceites: {transactions.filter(t => t.status === 'accepted' || t.status === 'reviewed').length}</span>
              <span>Rejeitadas: {transactions.filter(t => t.status === 'rejected').length}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {filteredTransactions.map((transaction) => (
          <TransactionReviewCard
            key={transaction.id}
            transaction={transaction}
            categories={categories}
            isEditing={editingId === transaction.id}
            showDuplicates={showDuplicates}
            onAccept={() => handleAcceptSuggestion(transaction.id)}
            onReject={() => handleRejectTransaction(transaction.id)}
            onEdit={() => handleEditTransaction(transaction.id)}
            onSave={(data) => handleSaveEdit(transaction.id, data)}
            onCancelEdit={() => setEditingId(null)}
            getConfidenceColor={getConfidenceColor}
            getStatusIcon={getStatusIcon}
          />
        ))}
      </div>

      {filteredTransactions.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-gray-500">
            Nenhuma transação encontrada com os filtros aplicados.
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button onClick={handleCompleteImport} className="bg-blue-600 hover:bg-blue-700">
          Importar Transações Selecionadas
        </Button>
      </div>
    </div>
  );
};

// Componente separado para cada cartão de transação
interface TransactionReviewCardProps {
  transaction: SmartTransaction;
  categories: any[];
  isEditing: boolean;
  showDuplicates: boolean;
  onAccept: () => void;
  onReject: () => void;
  onEdit: () => void;
  onSave: (data: any) => void;
  onCancelEdit: () => void;
  getConfidenceColor: (confidence: number) => string;
  getStatusIcon: (status: string) => React.ReactNode;
}

const TransactionReviewCard: React.FC<TransactionReviewCardProps> = ({
  transaction,
  categories,
  isEditing,
  showDuplicates,
  onAccept,
  onReject,
  onEdit,
  onSave,
  onCancelEdit,
  getConfidenceColor,
  getStatusIcon
}) => {
  const [editData, setEditData] = useState({
    categoryId: transaction.userChoices?.categoryId || transaction.suggestions.category.id,
    entity: transaction.userChoices?.entity || transaction.suggestions.entity.name,
    type: transaction.userChoices?.type || transaction.suggestions.type,
    description: transaction.userChoices?.description || transaction.originalData.description,
    tags: transaction.userChoices?.tags || transaction.suggestions.tags
  });

  const handleSave = () => {
    onSave(editData);
  };

  return (
    <Card className={`${transaction.status === 'rejected' ? 'opacity-50' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            {getStatusIcon(transaction.status)}
            <span className="font-medium">
              {transaction.originalData.date} - €{transaction.originalData.amount.toFixed(2)}
            </span>
          </div>
          <div className="flex gap-2">
            {transaction.status === 'pending' && (
              <>
                <Button size="sm" variant="outline" onClick={onEdit}>
                  <Edit3 className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={onAccept}>
                  <CheckCircle className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={onReject}>
                  <X className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Dados originais */}
        <div className="mb-4 p-3 bg-gray-50 rounded">
          <h4 className="font-medium mb-2">Dados Originais:</h4>
          <p><strong>Descrição:</strong> {transaction.originalData.description}</p>
          {transaction.originalData.entity && (
            <p><strong>Entidade:</strong> {transaction.originalData.entity}</p>
          )}
          {transaction.originalData.reference && (
            <p><strong>Referência:</strong> {transaction.originalData.reference}</p>
          )}
        </div>

        {/* Sugestões da IA */}
        {!isEditing ? (
          <div className="mb-4 p-3 bg-blue-50 rounded">
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-600" />
              Sugestões da IA:
            </h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <strong>Categoria:</strong>
                <span>{transaction.suggestions.category.name}</span>
                <Badge className={getConfidenceColor(transaction.suggestions.category.confidence)}>
                  {Math.round(transaction.suggestions.category.confidence * 100)}%
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <strong>Entidade:</strong>
                <span>{transaction.suggestions.entity.name}</span>
                <Badge className={getConfidenceColor(transaction.suggestions.entity.confidence)}>
                  {Math.round(transaction.suggestions.entity.confidence * 100)}%
                </Badge>
              </div>
              <div>
                <strong>Tipo:</strong> {transaction.suggestions.type}
              </div>
              {transaction.suggestions.tags.length > 0 && (
                <div className="flex items-center gap-2">
                  <strong>Tags:</strong>
                  {transaction.suggestions.tags.map((tag, index) => (
                    <Badge key={index} variant="outline">{tag}</Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Formulário de edição */
          <div className="mb-4 p-3 bg-yellow-50 rounded">
            <h4 className="font-medium mb-2">Editar Transação:</h4>
            <div className="space-y-3">
              <div>
                <Label>Categoria</Label>
                <Select 
                  value={editData.categoryId} 
                  onValueChange={(value) => setEditData({...editData, categoryId: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Entidade</Label>
                <Input 
                  value={editData.entity}
                  onChange={(e) => setEditData({...editData, entity: e.target.value})}
                />
              </div>
              
              <div>
                <Label>Tipo</Label>
                <Select 
                  value={editData.type} 
                  onValueChange={(value: any) => setEditData({...editData, type: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Receita</SelectItem>
                    <SelectItem value="expense">Despesa</SelectItem>
                    <SelectItem value="transfer">Transferência</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Descrição</Label>
                <Input 
                  value={editData.description}
                  onChange={(e) => setEditData({...editData, description: e.target.value})}
                />
              </div>
              
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave}>
                  <Save className="h-4 w-4 mr-1" />
                  Guardar
                </Button>
                <Button size="sm" variant="outline" onClick={onCancelEdit}>
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Aviso de duplicados */}
        {showDuplicates && transaction.duplicateWarning?.isDuplicate && (
          <Alert className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Possível duplicado detectado!</strong>
              <div className="mt-2">
                {transaction.duplicateWarning.similarTransactions.map((similar, index) => (
                  <div key={index} className="text-sm">
                    {similar.date} - {similar.description} - €{similar.amount.toFixed(2)} 
                    (Similaridade: {Math.round(similar.similarity * 100)}%)
                  </div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};