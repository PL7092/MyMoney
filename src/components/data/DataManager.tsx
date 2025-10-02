import React, { useState } from 'react';
import { useFinance } from '../../contexts/FinanceContext';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { useToast } from '../ui/use-toast';
import { Plus, Edit, Trash2, Tag, Building2, Brain, Palette } from 'lucide-react';
import type { Category, Entity, AIRule } from '../../contexts/FinanceContext';

// Category Form Component
const CategoryForm: React.FC<{
  category?: Category | null;
  onClose: () => void;
  onSave: (category: any) => void;
}> = ({ category, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: category?.name || '',
    type: category?.type || 'expense',
    color: category?.color || '#FF6B6B',
    icon: category?.icon || '',
    isActive: category?.isActive ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{category ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome da categoria"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Tipo</Label>
              <Select value={formData.type} onValueChange={(value: any) => setFormData({ ...formData, type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Receita</SelectItem>
                  <SelectItem value="expense">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="color">Cor</Label>
              <Input
                id="color"
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="icon">Ícone</Label>
              <Input
                id="icon"
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                placeholder="Nome do ícone"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">
              {category ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Entity Form Component
const EntityForm: React.FC<{
  entity?: Entity | null;
  onClose: () => void;
  onSave: (entity: any) => void;
}> = ({ entity, onClose, onSave }) => {
  const [entityFormData, setEntityFormData] = useState({
    name: entity?.name || '',
    type: entity?.type || 'merchant',
    isActive: entity?.isActive ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(entityFormData);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{entity ? 'Editar Entidade' : 'Nova Entidade'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={entityFormData.name}
                onChange={(e) => setEntityFormData({ ...entityFormData, name: e.target.value })}
                placeholder="Nome da entidade"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Tipo</Label>
              <Select value={entityFormData.type} onValueChange={(value) => setEntityFormData({ ...entityFormData, type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="merchant">Comerciante</SelectItem>
                  <SelectItem value="bank">Banco</SelectItem>
                  <SelectItem value="employer">Empregador</SelectItem>
                  <SelectItem value="government">Governo</SelectItem>
                  <SelectItem value="other">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">
              {entity ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// AI Rule Form Component
const AIRuleForm: React.FC<{
  aiRule?: AIRule | null;
  onClose: () => void;
  onSave: (aiRule: any) => void;
}> = ({ aiRule, onClose, onSave }) => {
  const [aiRuleFormData, setAiRuleFormData] = useState({
    name: aiRule?.name || '',
    description: aiRule?.description || '',
    isActive: aiRule?.isActive ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const ruleData = {
      ...aiRuleFormData,
      conditions: [],
      actions: [],
    };
    
    onSave(ruleData);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{aiRule ? 'Editar Regra IA' : 'Nova Regra IA'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              value={aiRuleFormData.name}
              onChange={(e) => setAiRuleFormData({ ...aiRuleFormData, name: e.target.value })}
              placeholder="Nome da regra"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              value={aiRuleFormData.description}
              onChange={(e) => setAiRuleFormData({ ...aiRuleFormData, description: e.target.value })}
              placeholder="Descrição da regra"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">
              {aiRule ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export const DataManager: React.FC = () => {
  const { 
    categories, addCategory, updateCategory, deleteCategory,
    entities, addEntity, updateEntity, deleteEntity,
    aiRules, addAIRule, updateAIRule, deleteAIRule
  } = useFinance();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState('categories');
  
  // Category state
  const [isCategoryFormOpen, setIsCategoryFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  
  // Entity state
  const [isEntityFormOpen, setIsEntityFormOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null);
  
  // AI Rule state
  const [isAIRuleFormOpen, setIsAIRuleFormOpen] = useState(false);
  const [editingAIRule, setEditingAIRule] = useState<AIRule | null>(null);

  // Category handlers
  const handleSaveCategory = async (categoryData: any) => {
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, categoryData);
        toast({ title: "Sucesso", description: "Categoria atualizada com sucesso" });
      } else {
        await addCategory(categoryData);
        toast({ title: "Sucesso", description: "Categoria criada com sucesso" });
      }
      setIsCategoryFormOpen(false);
      setEditingCategory(null);
    } catch (error) {
      toast({ title: "Erro", description: "Erro ao salvar categoria", variant: "destructive" });
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta categoria?')) {
      try {
        await deleteCategory(id);
        toast({ title: "Sucesso", description: "Categoria excluída com sucesso" });
      } catch (error) {
        toast({ title: "Erro", description: "Erro ao excluir categoria", variant: "destructive" });
      }
    }
  };

  // Entity handlers
  const handleSaveEntity = async (entityData: any) => {
    try {
      if (editingEntity) {
        await updateEntity(editingEntity.id, entityData);
        toast({ title: "Sucesso", description: "Entidade atualizada com sucesso" });
      } else {
        await addEntity(entityData);
        toast({ title: "Sucesso", description: "Entidade criada com sucesso" });
      }
      setIsEntityFormOpen(false);
      setEditingEntity(null);
    } catch (error) {
      toast({ title: "Erro", description: "Erro ao salvar entidade", variant: "destructive" });
    }
  };

  const handleDeleteEntity = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta entidade?')) {
      try {
        await deleteEntity(id);
        toast({ title: "Sucesso", description: "Entidade excluída com sucesso" });
      } catch (error) {
        toast({ title: "Erro", description: "Erro ao excluir entidade", variant: "destructive" });
      }
    }
  };

  // AI Rule handlers
  const handleSaveAIRule = async (aiRuleData: any) => {
    try {
      if (editingAIRule) {
        await updateAIRule(editingAIRule.id, aiRuleData);
        toast({ title: "Sucesso", description: "Regra IA atualizada com sucesso" });
      } else {
        await addAIRule(aiRuleData);
        toast({ title: "Sucesso", description: "Regra IA criada com sucesso" });
      }
      setIsAIRuleFormOpen(false);
      setEditingAIRule(null);
    } catch (error) {
      toast({ title: "Erro", description: "Erro ao salvar regra IA", variant: "destructive" });
    }
  };

  const handleDeleteAIRule = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta regra IA?')) {
      try {
        await deleteAIRule(id);
        toast({ title: "Sucesso", description: "Regra IA excluída com sucesso" });
      } catch (error) {
        toast({ title: "Erro", description: "Erro ao excluir regra IA", variant: "destructive" });
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Gestão de Dados</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="categories">Categorias</TabsTrigger>
          <TabsTrigger value="entities">Entidades</TabsTrigger>
          <TabsTrigger value="ai-rules">Regras IA</TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Categorias</h2>
            <Button onClick={() => setIsCategoryFormOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Categoria
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((category) => (
              <Card key={category.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: category.color }}
                    />
                    <CardTitle className="text-base">{category.name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Tag className="h-4 w-4" />
                    <span>{category.type === 'income' ? 'Receita' : 'Despesa'}</span>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingCategory(category);
                        setIsCategoryFormOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteCategory(category.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>

          {categories.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <Palette className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">Nenhuma categoria encontrada</h3>
                <p className="text-muted-foreground mb-4">
                  Comece criando suas primeiras categorias.
                </p>
                <Button onClick={() => setIsCategoryFormOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeira Categoria
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="entities" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Entidades</h2>
            <Button onClick={() => setIsEntityFormOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Entidade
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {entities.map((entity) => (
              <Card key={entity.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    <CardTitle className="text-base">{entity.name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground">{entity.type}</p>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingEntity(entity);
                        setIsEntityFormOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteEntity(entity.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>

          {entities.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">Nenhuma entidade encontrada</h3>
                <p className="text-muted-foreground mb-4">
                  Comece criando suas primeiras entidades.
                </p>
                <Button onClick={() => setIsEntityFormOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeira Entidade
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="ai-rules" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Regras IA</h2>
            <Button onClick={() => setIsAIRuleFormOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Regra IA
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {aiRules.map((aiRule) => (
              <Card key={aiRule.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    <CardTitle className="text-base">{aiRule.name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground">{aiRule.description}</p>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingAIRule(aiRule);
                        setIsAIRuleFormOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteAIRule(aiRule.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>

          {aiRules.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">Nenhuma regra IA encontrada</h3>
                <p className="text-muted-foreground mb-4">
                  Comece criando suas primeiras regras IA.
                </p>
                <Button onClick={() => setIsAIRuleFormOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeira Regra IA
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Forms */}
      {isCategoryFormOpen && (
        <CategoryForm
          category={editingCategory}
          onClose={() => {
            setIsCategoryFormOpen(false);
            setEditingCategory(null);
          }}
          onSave={handleSaveCategory}
        />
      )}

      {isEntityFormOpen && (
        <EntityForm
          entity={editingEntity}
          onClose={() => {
            setIsEntityFormOpen(false);
            setEditingEntity(null);
          }}
          onSave={handleSaveEntity}
        />
      )}

      {isAIRuleFormOpen && (
        <AIRuleForm
          aiRule={editingAIRule}
          onClose={() => {
            setIsAIRuleFormOpen(false);
            setEditingAIRule(null);
          }}
          onSave={handleSaveAIRule}
        />
      )}
    </div>
  );
};