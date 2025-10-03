import express from 'express';
import db from '../db.js';

const router = express.Router();

// Get all prompts
router.get('/', async (req, res) => {
  try {
    if (!db.pool) await db.createConnection();
    
    const rows = await db.query(
      'SELECT * FROM ai_prompts ORDER BY category, name'
    );
    
    const prompts = rows.map(row => ({
      id: row.id,
      name: row.name,
      category: row.category,
      prompt: row.prompt,
      description: row.description,
      variables: row.variables ? JSON.parse(row.variables) : [],
      isActive: Boolean(row.is_active),
      isDefault: Boolean(row.is_default),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
    
    res.json({ success: true, data: prompts });
  } catch (error) {
    console.error('Error fetching prompts:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar prompts' });
  }
});

// Get prompts by category
router.get('/category/:category', async (req, res) => {
  const { category } = req.params;
  
  try {
    if (!db.pool) await db.createConnection();
    
    const rows = await db.query(
      'SELECT * FROM ai_prompts WHERE category = ? AND is_active = TRUE ORDER BY name',
      [category]
    );
    
    const prompts = rows.map(row => ({
      id: row.id,
      name: row.name,
      category: row.category,
      prompt: row.prompt,
      description: row.description,
      variables: row.variables ? JSON.parse(row.variables) : [],
      isActive: Boolean(row.is_active),
      isDefault: Boolean(row.is_default),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
    
    res.json({ success: true, data: prompts });
  } catch (error) {
    console.error('Error fetching prompts by category:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar prompts' });
  }
});

// Get single prompt
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    if (!db.pool) await db.createConnection();
    
    const rows = await db.query(
      'SELECT * FROM ai_prompts WHERE id = ?',
      [id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Prompt não encontrado' });
    }
    
    const row = rows[0];
    const prompt = {
      id: row.id,
      name: row.name,
      category: row.category,
      prompt: row.prompt,
      description: row.description,
      variables: row.variables ? JSON.parse(row.variables) : [],
      isActive: Boolean(row.is_active),
      isDefault: Boolean(row.is_default),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
    
    res.json({ success: true, data: prompt });
  } catch (error) {
    console.error('Error fetching prompt:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar prompt' });
  }
});

// Create new prompt
router.post('/', async (req, res) => {
  const { name, category, prompt, description, variables } = req.body;
  
  try {
    if (!db.pool) await db.createConnection();
    
    const result = await db.query(
      'INSERT INTO ai_prompts (name, category, prompt, description, variables, is_active, is_default) VALUES (?, ?, ?, ?, ?, TRUE, FALSE)',
      [name, category, prompt, description || null, JSON.stringify(variables || [])]
    );
    
    res.json({ 
      success: true, 
      data: { id: result.insertId },
      message: 'Prompt criado com sucesso' 
    });
  } catch (error) {
    console.error('Error creating prompt:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ success: false, message: 'Já existe um prompt com este nome nesta categoria' });
    } else {
      res.status(500).json({ success: false, message: 'Erro ao criar prompt' });
    }
  }
});

// Update prompt
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, prompt, description, variables, isActive } = req.body;
  
  try {
    if (!db.pool) await db.createConnection();
    
    // Check if prompt exists
    const existing = await db.query(
      'SELECT is_default FROM ai_prompts WHERE id = ?',
      [id]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Prompt não encontrado' });
    }
    
    const result = await db.query(
      'UPDATE ai_prompts SET name = ?, prompt = ?, description = ?, variables = ?, is_active = ? WHERE id = ?',
      [name, prompt, description || null, JSON.stringify(variables || []), isActive ? 1 : 0, id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Prompt não encontrado' });
    }
    
    res.json({ success: true, message: 'Prompt atualizado com sucesso' });
  } catch (error) {
    console.error('Error updating prompt:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ success: false, message: 'Já existe um prompt com este nome nesta categoria' });
    } else {
      res.status(500).json({ success: false, message: 'Erro ao atualizar prompt' });
    }
  }
});

// Delete prompt (only if not default)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    if (!db.pool) await db.createConnection();
    
    // Check if prompt is default
    const existing = await db.query(
      'SELECT is_default FROM ai_prompts WHERE id = ?',
      [id]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Prompt não encontrado' });
    }
    
    if (existing[0].is_default) {
      return res.status(400).json({ success: false, message: 'Não é possível deletar prompts padrão' });
    }
    
    const result = await db.query(
      'DELETE FROM ai_prompts WHERE id = ?',
      [id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Prompt não encontrado' });
    }
    
    res.json({ success: true, message: 'Prompt deletado com sucesso' });
  } catch (error) {
    console.error('Error deleting prompt:', error);
    res.status(500).json({ success: false, message: 'Erro ao deletar prompt' });
  }
});

// Reset prompt to default
router.post('/:id/reset', async (req, res) => {
  const { id } = req.params;
  
  try {
    if (!db.pool) await db.createConnection();
    
    // Get the current prompt info
    const current = await db.query(
      'SELECT name, category FROM ai_prompts WHERE id = ?',
      [id]
    );
    
    if (current.length === 0) {
      return res.status(404).json({ success: false, message: 'Prompt não encontrado' });
    }
    
    // Find default prompt
    const defaultPrompt = await db.query(
      'SELECT prompt, description, variables FROM ai_prompts WHERE name = ? AND category = ? AND is_default = TRUE',
      [current[0].name, current[0].category]
    );
    
    if (defaultPrompt.length === 0) {
      return res.status(404).json({ success: false, message: 'Prompt padrão não encontrado' });
    }
    
    // Update to default values
    await db.query(
      'UPDATE ai_prompts SET prompt = ?, description = ?, variables = ? WHERE id = ?',
      [defaultPrompt[0].prompt, defaultPrompt[0].description, defaultPrompt[0].variables, id]
    );
    
    res.json({ success: true, message: 'Prompt restaurado para o padrão' });
  } catch (error) {
    console.error('Error resetting prompt:', error);
    res.status(500).json({ success: false, message: 'Erro ao restaurar prompt' });
  }
});

export default router;
