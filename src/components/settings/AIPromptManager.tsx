import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { AlertCircle, Plus, Edit, Trash2, RotateCcw, Save, X, Info } from 'lucide-react';
import { Alert, AlertDescription } from '../ui/alert';
import { useToast } from '@/hooks/use-toast';
import { AIPrompt, PromptCategory, CATEGORY_LABELS, PROMPT_VARIABLES } from '../../types/prompts';
import { PromptService } from '../../services/PromptService';

export const AIPromptManager: React.FC = () => {
  const { toast } = useToast();
  const [prompts, setPrompts] = useState<AIPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPrompt, setEditingPrompt] = useState<AIPrompt | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<PromptCategory>('chat_responses');

  useEffect(() => {
    loadPrompts();
  }, []);

  const loadPrompts = async () => {
    setLoading(true);
    try {
      const data = await PromptService.getAllPrompts();
      setPrompts(data);
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao carregar prompts',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const groupedPrompts = prompts.reduce((acc, prompt) => {
    if (!acc[prompt.category]) {
      acc[prompt.category] = [];
    }
    acc[prompt.category].push(prompt);
    return acc;
  }, {} as Record<PromptCategory, AIPrompt[]>);

  const handleSavePrompt = async (data: Partial<AIPrompt>) => {
    try {
      if (editingPrompt?.id) {
        await PromptService.updatePrompt(editingPrompt.id, data);
        toast({
          title: 'Sucesso',
          description: 'Prompt atualizado com sucesso'
        });
      } else {
        await PromptService.createPrompt({ ...data, category: selectedCategory });
        toast({
          title: 'Sucesso',
          description: 'Prompt criado com sucesso'
        });
      }
      loadPrompts();
      setIsDialogOpen(false);
      setEditingPrompt(null);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao salvar prompt',
        variant: 'destructive'
      });
    }
  };

  const handleDeletePrompt = async (id: number) => {
    if (!confirm('Tem certeza que deseja deletar este prompt?')) return;

    try {
      await PromptService.deletePrompt(id);
      toast({
        title: 'Sucesso',
        description: 'Prompt deletado com sucesso'
      });
      loadPrompts();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao deletar prompt',
        variant: 'destructive'
      });
    }
  };

  const handleResetPrompt = async (id: number) => {
    if (!confirm('Tem certeza que deseja restaurar este prompt para o padrão?')) return;

    try {
      await PromptService.resetPrompt(id);
      toast({
        title: 'Sucesso',
        description: 'Prompt restaurado com sucesso'
      });
      loadPrompts();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao restaurar prompt',
        variant: 'destructive'
      });
    }
  };

  const handleToggleActive = async (prompt: AIPrompt) => {
    try {
      await PromptService.updatePrompt(prompt.id, { isActive: !prompt.isActive });
      loadPrompts();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao atualizar prompt',
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Gerencie os prompts de IA utilizados na aplicação. Use variáveis como <code>{'{total_expenses}'}</code> para inserir dados dinâmicos.
        </AlertDescription>
      </Alert>

      <Accordion type="single" collapsible className="space-y-4">
        {Object.entries(groupedPrompts).map(([category, categoryPrompts]) => (
          <AccordionItem key={category} value={category} className="border rounded-lg">
            <AccordionTrigger className="px-4 hover:no-underline">
              <div className="flex items-center justify-between w-full pr-4">
                <div className="flex items-center gap-3">
                  <span className="font-medium">{CATEGORY_LABELS[category as PromptCategory]}</span>
                  <Badge variant="secondary">{categoryPrompts.length} prompts</Badge>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-3 mt-3">
                {categoryPrompts.map(prompt => (
                  <Card key={prompt.id} className={!prompt.isActive ? 'opacity-50' : ''}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{prompt.name}</h4>
                            {prompt.isDefault && (
                              <Badge variant="outline" className="text-xs">Padrão</Badge>
                            )}
                            <Switch
                              checked={prompt.isActive}
                              onCheckedChange={() => handleToggleActive(prompt)}
                            />
                          </div>
                          {prompt.description && (
                            <p className="text-sm text-muted-foreground">{prompt.description}</p>
                          )}
                          <div className="bg-muted p-3 rounded text-sm font-mono max-h-32 overflow-y-auto">
                            {prompt.prompt}
                          </div>
                          {prompt.variables.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {prompt.variables.map(variable => (
                                <Badge key={variable} variant="secondary" className="text-xs">
                                  {`{${variable}}`}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingPrompt(prompt);
                              setIsDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {!prompt.isDefault && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeletePrompt(prompt.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleResetPrompt(prompt.id)}
                            title="Restaurar para padrão"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setEditingPrompt(null);
                        setSelectedCategory(category as PromptCategory);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Novo Prompt
                    </Button>
                  </DialogTrigger>
                  <PromptDialog
                    prompt={editingPrompt}
                    category={selectedCategory}
                    onSave={handleSavePrompt}
                    onClose={() => {
                      setIsDialogOpen(false);
                      setEditingPrompt(null);
                    }}
                  />
                </Dialog>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
};

interface PromptDialogProps {
  prompt: AIPrompt | null;
  category: PromptCategory;
  onSave: (data: Partial<AIPrompt>) => void;
  onClose: () => void;
}

const PromptDialog: React.FC<PromptDialogProps> = ({ prompt, category, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    name: prompt?.name || '',
    prompt: prompt?.prompt || '',
    description: prompt?.description || '',
    variables: prompt?.variables || [],
    isActive: prompt?.isActive ?? true
  });

  const availableVariables = Object.values(PROMPT_VARIABLES);

  return (
    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>
          {prompt ? 'Editar Prompt' : 'Novo Prompt'}
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        <div>
          <Label htmlFor="name">Nome</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="nome_do_prompt"
          />
        </div>

        <div>
          <Label htmlFor="description">Descrição</Label>
          <Input
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Breve descrição do prompt"
          />
        </div>

        <div>
          <Label htmlFor="prompt">Prompt</Label>
          <Textarea
            id="prompt"
            value={formData.prompt}
            onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
            placeholder="Digite o prompt usando variáveis como {total_expenses}"
            rows={8}
            className="font-mono text-sm"
          />
        </div>

        <div>
          <Label>Variáveis Disponíveis</Label>
          <div className="grid grid-cols-2 gap-2 mt-2 max-h-40 overflow-y-auto border rounded p-2">
            {availableVariables.map(variable => (
              <div key={variable.name} className="text-xs p-2 bg-muted rounded">
                <code className="font-mono font-bold">{`{${variable.name}}`}</code>
                <p className="text-muted-foreground mt-1">{variable.description}</p>
                <p className="text-muted-foreground italic">Ex: {variable.example}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            checked={formData.isActive}
            onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
          />
          <Label>Ativo</Label>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          <X className="h-4 w-4 mr-2" />
          Cancelar
        </Button>
        <Button 
          onClick={() => onSave(formData)}
          disabled={!formData.name || !formData.prompt}
        >
          <Save className="h-4 w-4 mr-2" />
          Salvar
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};
