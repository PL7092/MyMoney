import { AIPrompt, PromptCategory } from '../types/prompts';

export class PromptService {
  private static baseUrl = '/api/prompts';
  private static promptCache: Map<string, AIPrompt[]> = new Map();
  private static cacheTime: Map<string, number> = new Map();
  private static CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Get all prompts
   */
  static async getAllPrompts(): Promise<AIPrompt[]> {
    try {
      const response = await fetch(this.baseUrl);
      const result = await response.json();
      
      if (result.success) {
        return result.data;
      }
      throw new Error(result.message || 'Erro ao buscar prompts');
    } catch (error) {
      console.error('Error fetching prompts:', error);
      throw error;
    }
  }

  /**
   * Get prompts by category with caching
   */
  static async getPromptsByCategory(category: PromptCategory): Promise<AIPrompt[]> {
    // Check cache
    const cached = this.promptCache.get(category);
    const cacheTime = this.cacheTime.get(category);
    
    if (cached && cacheTime && Date.now() - cacheTime < this.CACHE_DURATION) {
      return cached;
    }

    try {
      const response = await fetch(`${this.baseUrl}/category/${category}`);
      const result = await response.json();
      
      if (result.success) {
        // Update cache
        this.promptCache.set(category, result.data);
        this.cacheTime.set(category, Date.now());
        return result.data;
      }
      throw new Error(result.message || 'Erro ao buscar prompts');
    } catch (error) {
      console.error('Error fetching prompts by category:', error);
      // Return empty array as fallback
      return [];
    }
  }

  /**
   * Get single prompt by name and category
   */
  static async getPrompt(name: string, category: PromptCategory): Promise<AIPrompt | null> {
    try {
      const prompts = await this.getPromptsByCategory(category);
      return prompts.find(p => p.name === name && p.isActive) || null;
    } catch (error) {
      console.error('Error fetching prompt:', error);
      return null;
    }
  }

  /**
   * Replace variables in prompt with actual values
   */
  static replaceVariables(promptText: string, variables: Record<string, any>): string {
    let result = promptText;
    
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      result = result.replace(regex, String(value));
    }
    
    return result;
  }

  /**
   * Get formatted prompt with variables replaced
   */
  static async getFormattedPrompt(
    name: string, 
    category: PromptCategory, 
    variables: Record<string, any>
  ): Promise<string | null> {
    const prompt = await this.getPrompt(name, category);
    
    if (!prompt) {
      return null;
    }
    
    return this.replaceVariables(prompt.prompt, variables);
  }

  /**
   * Create new prompt
   */
  static async createPrompt(data: Partial<AIPrompt>): Promise<number> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Invalidate cache
        if (data.category) {
          this.promptCache.delete(data.category);
        }
        return result.data.id;
      }
      throw new Error(result.message || 'Erro ao criar prompt');
    } catch (error) {
      console.error('Error creating prompt:', error);
      throw error;
    }
  }

  /**
   * Update prompt
   */
  static async updatePrompt(id: number, data: Partial<AIPrompt>): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Invalidate all cache
        this.promptCache.clear();
        this.cacheTime.clear();
        return;
      }
      throw new Error(result.message || 'Erro ao atualizar prompt');
    } catch (error) {
      console.error('Error updating prompt:', error);
      throw error;
    }
  }

  /**
   * Delete prompt
   */
  static async deletePrompt(id: number): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/${id}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Invalidate all cache
        this.promptCache.clear();
        this.cacheTime.clear();
        return;
      }
      throw new Error(result.message || 'Erro ao deletar prompt');
    } catch (error) {
      console.error('Error deleting prompt:', error);
      throw error;
    }
  }

  /**
   * Reset prompt to default
   */
  static async resetPrompt(id: number): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/${id}/reset`, {
        method: 'POST'
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Invalidate all cache
        this.promptCache.clear();
        this.cacheTime.clear();
        return;
      }
      throw new Error(result.message || 'Erro ao restaurar prompt');
    } catch (error) {
      console.error('Error resetting prompt:', error);
      throw error;
    }
  }

  /**
   * Clear cache
   */
  static clearCache(): void {
    this.promptCache.clear();
    this.cacheTime.clear();
  }
}
