import * as vscode from 'vscode';
import { StorageService } from './StorageService';
import { Category, Prompt, PromptData, IconConfig } from '../types';
import { randomUUID } from 'crypto';

export class PromptManager {
  private data: PromptData = { categories: [], prompts: [] };

  constructor(private storageService: StorageService) { }

  /**
   * Initialize the manager by loading data from disk
   */
  async initialize(): Promise<void> {
    this.data = await this.storageService.load();
    // Ensure all items have order fields
    this.ensureOrderFields();
  }

  /**
   * Ensure all categories and prompts have order fields
   */
  private ensureOrderFields(): void {
    // Assign order to categories if missing
    this.data.categories.forEach((category, index) => {
      if (category.order === undefined) {
        category.order = index;
      }
    });

    // Assign order to prompts if missing
    this.data.prompts.forEach((prompt, index) => {
      if (prompt.order === undefined) {
        prompt.order = index;
      }
    });
  }

  /**
   * Get all categories sorted by order
   */
  getCategories(): Category[] {
    return this.data.categories.sort((a, b) => a.order - b.order);
  }

  /**
   * Get root categories (categories without a parent)
   */
  getRootCategories(): Category[] {
    return this.data.categories
      .filter(c => !c.parentCategoryId)
      .sort((a, b) => a.order - b.order);
  }

  /**
   * Get subcategories of a parent category
   */
  getSubcategories(parentCategoryId: string): Category[] {
    return this.data.categories
      .filter(c => c.parentCategoryId === parentCategoryId)
      .sort((a, b) => a.order - b.order);
  }

  /**
   * Get a category by ID
   */
  getCategory(id: string): Category | undefined {
    return this.data.categories.find(c => c.id === id);
  }

  /**
   * Create a new category
   */
  async createCategory(name: string, parentCategoryId?: string): Promise<Category> {
    // Calculate order based on siblings (same parent level)
    const siblings = parentCategoryId
      ? this.getSubcategories(parentCategoryId)
      : this.getRootCategories();

    const maxOrder = siblings.length > 0
      ? Math.max(...siblings.map(c => c.order))
      : -1;

    const category: Category = {
      id: randomUUID(),
      name,
      order: maxOrder + 1,
      parentCategoryId
    };

    this.data.categories.push(category);

    // Create category folder with metadata.json file
    await this.storageService.createCategoryFolder(category, this.getCategory.bind(this));

    return category;
  }

  /**
   * Update a category
   */
  async updateCategory(
    id: string,
    name: string,
    icon?: IconConfig | null
  ): Promise<void> {
    const category = this.data.categories.find(c => c.id === id);
    if (!category) {
      throw new Error('Category not found');
    }

    category.name = name;

    // Update icon (undefined means don't change, null means remove)
    if (icon !== undefined) {
      if (icon === null) {
        delete category.icon;
      } else {
        category.icon = icon;
      }
    }

    // Update category metadata file
    await this.storageService.updateCategoryMetadata(category, this.getCategory.bind(this));
  }

  /**
   * Delete a category, all its subcategories, and all prompts
   */
  async deleteCategory(id: string): Promise<void> {
    // Get the category before deleting it (we need it for file system operations)
    const category = this.getCategory(id);
    if (!category) {
      throw new Error('Category not found');
    }

    // Get all subcategories recursively
    const categoriesToDelete = this.getAllSubcategoriesRecursive(id);
    categoriesToDelete.push(id);

    // Delete the category folder from the file system
    // This will delete all subcategories and prompts within it
    await this.storageService.deleteCategoryFolder(category, this.getCategory.bind(this));

    // Delete all categories and their prompts from memory
    this.data.categories = this.data.categories.filter(c => !categoriesToDelete.includes(c.id));
    this.data.prompts = this.data.prompts.filter(p => !categoriesToDelete.includes(p.categoryId));
  }

  /**
   * Get all subcategories recursively
   */
  private getAllSubcategoriesRecursive(parentId: string): string[] {
    const subcategories = this.getSubcategories(parentId);
    const result: string[] = [];

    for (const subcat of subcategories) {
      result.push(subcat.id);
      // Recursively get subcategories of this subcategory
      result.push(...this.getAllSubcategoriesRecursive(subcat.id));
    }

    return result;
  }

  /**
   * Get all prompts
   */
  getPrompts(): Prompt[] {
    return this.data.prompts;
  }

  /**
   * Get prompts by category sorted by order
   */
  getPromptsByCategory(categoryId: string): Prompt[] {
    return this.data.prompts
      .filter(p => p.categoryId === categoryId)
      .sort((a, b) => a.order - b.order);
  }

  /**
   * Get a prompt by ID
   */
  getPrompt(id: string): Prompt | undefined {
    return this.data.prompts.find(p => p.id === id);
  }

  /**
   * Create a new prompt
   */
  async createPrompt(name: string, content: string, categoryId: string): Promise<Prompt> {
    const categoryPrompts = this.getPromptsByCategory(categoryId);
    const maxOrder = categoryPrompts.length > 0
      ? Math.max(...categoryPrompts.map(p => p.order))
      : -1;

    const prompt: Prompt = {
      id: randomUUID(),
      name,
      content,
      categoryId,
      order: maxOrder + 1
    };

    this.data.prompts.push(prompt);

    // Save prompt as Markdown file with metadata
    const category = this.getCategory(categoryId);
    if (category) {
      await this.storageService.savePromptAsMarkdown(prompt, category, this.getCategory.bind(this));
    }

    return prompt;
  }

  /**
   * Create a prompt file in the category folder and return the file path
   */
  async createPromptFile(fileName: string, categoryId: string): Promise<string | null> {
    const category = this.getCategory(categoryId);
    if (!category) {
      throw new Error('Category not found');
    }

    return await this.storageService.createPromptFile(fileName, category, this.getCategory.bind(this));
  }

  /**
   * Save a prompt from a file (file already exists, just save metadata)
   */
  async savePromptFromFile(name: string, content: string, categoryId: string, filePath: string): Promise<Prompt> {
    const categoryPrompts = this.getPromptsByCategory(categoryId);
    const maxOrder = categoryPrompts.length > 0
      ? Math.max(...categoryPrompts.map(p => p.order))
      : -1;

    const prompt: Prompt = {
      id: randomUUID(),
      name,
      content,
      categoryId,
      order: maxOrder + 1
    };

    this.data.prompts.push(prompt);

    // Save metadata (content is already in the .md file)
    const category = this.getCategory(categoryId);
    if (category) {
      await this.storageService.savePromptAsMarkdown(prompt, category, this.getCategory.bind(this));
    }

    return prompt;
  }

  /**
   * Get the file path for a prompt
   */
  async getPromptFilePath(prompt: Prompt): Promise<string | null> {
    const category = this.getCategory(prompt.categoryId);
    if (!category) {
      return null;
    }

    return await this.storageService.getPromptFilePath(prompt, category, this.getCategory.bind(this));
  }

  /**
   * Update a prompt
   */
  async updatePrompt(
    id: string,
    name: string,
    content: string,
    categoryId: string,
    icon?: IconConfig | null
  ): Promise<void> {
    const prompt = this.data.prompts.find(p => p.id === id);
    if (!prompt) {
      throw new Error('Prompt not found');
    }

    prompt.name = name;
    prompt.content = content;
    prompt.categoryId = categoryId;

    // Update icon (undefined removes it)
    if (icon !== undefined) {
      if (icon === null) {
        delete prompt.icon;
      } else {
        prompt.icon = icon;
      }
    }

    // Save prompt as Markdown file with metadata
    const category = this.getCategory(categoryId);
    if (category) {
      await this.storageService.savePromptAsMarkdown(prompt, category, this.getCategory.bind(this));
    }
  }

  /**
   * Delete a prompt
   */
  async deletePrompt(id: string): Promise<void> {
    const prompt = this.data.prompts.find(p => p.id === id);
    if (prompt) {
      const category = this.getCategory(prompt.categoryId);
      if (category) {
        // Delete the files first
        await this.storageService.deletePromptFiles(prompt, category, this.getCategory.bind(this));
      }
    }

    this.data.prompts = this.data.prompts.filter(p => p.id !== id);
  }

  /**
   * Copy prompt content to clipboard
   */
  async copyPromptToClipboard(id: string): Promise<void> {
    const prompt = this.getPrompt(id);
    if (!prompt) {
      throw new Error('Prompt not found');
    }

    console.log(`[copyPromptToClipboard] Prompt ID: ${id}, Name: ${prompt.name}, In-memory content length: ${prompt.content.length}`);

    // ALWAYS reload from file to get the latest content
    let contentToCopy = prompt.content;
    const filePath = await this.getPromptFilePath(prompt);
    if (filePath) {
      try {
        const fs = require('fs');
        contentToCopy = fs.readFileSync(filePath, 'utf-8');
        console.log(`[copyPromptToClipboard] Reloaded from file, content length: ${contentToCopy.length}`);

        // Update the in-memory content to keep it in sync
        prompt.content = contentToCopy;
      } catch (error) {
        console.error('[copyPromptToClipboard] Failed to reload from file, using in-memory content:', error);
        // Fall back to in-memory content if file read fails
      }
    }

    if (contentToCopy.length === 0) {
      vscode.window.showWarningMessage(`Prompt "${prompt.name}" is empty. Add some content first.`);
      return;
    }

    console.log(`[copyPromptToClipboard] Copying to clipboard: "${contentToCopy.substring(0, 50)}..."`);
    await vscode.env.clipboard.writeText(contentToCopy);
    vscode.window.showInformationMessage(`Copied "${prompt.name}" to clipboard (${contentToCopy.length} characters)`);
  }

  /**
   * Preview prompt content in a read-only editor
   */
  async previewPrompt(id: string): Promise<void> {
    const prompt = this.getPrompt(id);
    if (!prompt) {
      throw new Error('Prompt not found');
    }

    console.log(`[previewPrompt] Prompt ID: ${id}, Name: ${prompt.name}`);

    // Get the file path for this prompt
    const filePath = await this.getPromptFilePath(prompt);

    if (!filePath) {
      // Fallback to untitled document if file doesn't exist
      console.log('[previewPrompt] No file path found, using untitled document');

      const vscode = require('vscode');
      const document = await vscode.workspace.openTextDocument({
        language: 'markdown',
        content: prompt.content
      });

      await vscode.window.showTextDocument(document, {
        preview: true,
        viewColumn: vscode.ViewColumn.Beside
      });

      vscode.window.showInformationMessage(
        `Preview: "${prompt.name}". Double-click the prompt in the sidebar to copy to clipboard.`,
        { modal: false }
      );
      return;
    }

    // Open the actual file
    const vscode = require('vscode');
    const uri = vscode.Uri.file(filePath);

    try {
      // Check if the file is already open in an editor
      const openEditor = vscode.window.visibleTextEditors.find(
        (editor: any) => editor.document.uri.fsPath === filePath
      );

      if (openEditor) {
        // File is already open, just focus on it
        console.log('[previewPrompt] File already open, focusing on it');
        await vscode.window.showTextDocument(openEditor.document, {
          viewColumn: openEditor.viewColumn,
          preserveFocus: false
        });
      } else {
        // Open the file
        console.log('[previewPrompt] Opening file:', filePath);
        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document, {
          preview: true,
          viewColumn: vscode.ViewColumn.Active
        });
      }
    } catch (error) {
      console.error('[previewPrompt] Error opening file:', error);
      vscode.window.showErrorMessage(`Failed to open prompt file: ${error}`);
    }
  }

  /**
   * Reorder categories (within the same parent level)
   */
  async reorderCategories(categoryIds: string[], parentCategoryId?: string): Promise<void> {
    categoryIds.forEach((id, index) => {
      const category = this.data.categories.find(c => c.id === id);
      if (category && category.parentCategoryId === parentCategoryId) {
        category.order = index;
      }
    });
    await this.storageService.save(this.data);
  }

  /**
   * Move a category to a different parent (or to root)
   */
  async moveCategoryToParent(categoryId: string, newParentId?: string): Promise<void> {
    const category = this.data.categories.find(c => c.id === categoryId);
    if (!category) {
      throw new Error('Category not found');
    }

    // Prevent moving a category into itself or its own descendants
    if (newParentId) {
      const descendants = this.getAllSubcategoriesRecursive(categoryId);
      if (categoryId === newParentId || descendants.includes(newParentId)) {
        throw new Error('Cannot move a category into itself or its descendants');
      }
    }

    const oldParentId = category.parentCategoryId;
    category.parentCategoryId = newParentId;

    // Reorder in the new parent
    const newSiblings = newParentId
      ? this.getSubcategories(newParentId)
      : this.getRootCategories();
    category.order = newSiblings.length - 1;

    // Reorder old siblings
    const oldSiblings = oldParentId
      ? this.getSubcategories(oldParentId)
      : this.getRootCategories();
    oldSiblings
      .filter(c => c.id !== categoryId)
      .forEach((c, index) => {
        c.order = index;
      });

    await this.storageService.save(this.data);
  }

  /**
   * Reorder prompts within a category
   */
  async reorderPromptsInCategory(categoryId: string, promptIds: string[]): Promise<void> {
    promptIds.forEach((id, index) => {
      const prompt = this.data.prompts.find(p => p.id === id && p.categoryId === categoryId);
      if (prompt) {
        prompt.order = index;
      }
    });
    await this.storageService.save(this.data);
  }

  /**
   * Move a prompt to a different category
   */
  async movePromptToCategory(promptId: string, targetCategoryId: string, targetOrder: number): Promise<void> {
    const prompt = this.data.prompts.find(p => p.id === promptId);
    if (!prompt) {
      throw new Error('Prompt not found');
    }

    const oldCategoryId = prompt.categoryId;
    prompt.categoryId = targetCategoryId;
    prompt.order = targetOrder;

    // Reorder prompts in the old category
    const oldCategoryPrompts = this.data.prompts
      .filter(p => p.categoryId === oldCategoryId && p.id !== promptId)
      .sort((a, b) => a.order - b.order);
    oldCategoryPrompts.forEach((p, index) => {
      p.order = index;
    });

    // Reorder prompts in the new category
    const newCategoryPrompts = this.data.prompts
      .filter(p => p.categoryId === targetCategoryId)
      .sort((a, b) => a.order - b.order);
    newCategoryPrompts.forEach((p, index) => {
      p.order = index;
    });

    await this.storageService.save(this.data);
  }

  /**
   * Move a category up in the order (decrease order number)
   */
  async moveCategoryUp(categoryId: string): Promise<boolean> {
    const category = this.data.categories.find(c => c.id === categoryId);
    if (!category) {
      return false;
    }

    // Get siblings (categories at the same level)
    const siblings = category.parentCategoryId
      ? this.getSubcategories(category.parentCategoryId)
      : this.getRootCategories();

    // Find current position
    const currentIndex = siblings.findIndex(c => c.id === categoryId);
    if (currentIndex <= 0) {
      return false; // Already at the top
    }

    // Swap order with the previous sibling
    const previousSibling = siblings[currentIndex - 1];
    const tempOrder = category.order;
    category.order = previousSibling.order;
    previousSibling.order = tempOrder;

    await this.storageService.save(this.data);
    return true;
  }

  /**
   * Move a category down in the order (increase order number)
   */
  async moveCategoryDown(categoryId: string): Promise<boolean> {
    const category = this.data.categories.find(c => c.id === categoryId);
    if (!category) {
      return false;
    }

    // Get siblings (categories at the same level)
    const siblings = category.parentCategoryId
      ? this.getSubcategories(category.parentCategoryId)
      : this.getRootCategories();

    // Find current position
    const currentIndex = siblings.findIndex(c => c.id === categoryId);
    if (currentIndex === -1 || currentIndex >= siblings.length - 1) {
      return false; // Already at the bottom
    }

    // Swap order with the next sibling
    const nextSibling = siblings[currentIndex + 1];
    const tempOrder = category.order;
    category.order = nextSibling.order;
    nextSibling.order = tempOrder;

    await this.storageService.save(this.data);
    return true;
  }

  /**
   * Move a prompt up in the order (decrease order number)
   */
  async movePromptUp(promptId: string): Promise<boolean> {
    const prompt = this.data.prompts.find(p => p.id === promptId);
    if (!prompt) {
      return false;
    }

    // Get prompts in the same category
    const categoryPrompts = this.getPromptsByCategory(prompt.categoryId);

    // Find current position
    const currentIndex = categoryPrompts.findIndex(p => p.id === promptId);
    if (currentIndex <= 0) {
      return false; // Already at the top
    }

    // Swap order with the previous prompt
    const previousPrompt = categoryPrompts[currentIndex - 1];
    const tempOrder = prompt.order;
    prompt.order = previousPrompt.order;
    previousPrompt.order = tempOrder;

    await this.storageService.save(this.data);
    return true;
  }

  /**
   * Move a prompt down in the order (increase order number)
   */
  async movePromptDown(promptId: string): Promise<boolean> {
    const prompt = this.data.prompts.find(p => p.id === promptId);
    if (!prompt) {
      return false;
    }

    // Get prompts in the same category
    const categoryPrompts = this.getPromptsByCategory(prompt.categoryId);

    // Find current position
    const currentIndex = categoryPrompts.findIndex(p => p.id === promptId);
    if (currentIndex === -1 || currentIndex >= categoryPrompts.length - 1) {
      return false; // Already at the bottom
    }

    // Swap order with the next prompt
    const nextPrompt = categoryPrompts[currentIndex + 1];
    const tempOrder = prompt.order;
    prompt.order = nextPrompt.order;
    nextPrompt.order = tempOrder;

    await this.storageService.save(this.data);
    return true;
  }


  /**
   * Resolve icon path (handles relative paths)
   */
  resolveIconPath(iconPath: string): string {
    // If it's already an absolute path, return it
    if (require('path').isAbsolute(iconPath)) {
      return iconPath;
    }

    // Otherwise, resolve relative to save location
    const saveLocation = this.storageService.getSaveLocation();
    return require('path').join(saveLocation, iconPath);
  }
}

