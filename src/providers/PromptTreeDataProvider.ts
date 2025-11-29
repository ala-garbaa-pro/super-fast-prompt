import * as vscode from 'vscode';
import { PromptManager } from '../services/PromptManager';
import { Category, Prompt } from '../types';

export class PromptTreeViewProvider implements vscode.TreeDataProvider<TreeItem>, vscode.TreeDragAndDropController<TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | null | void> = new vscode.EventEmitter<TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  // Drag and drop support
  dropMimeTypes = ['application/vnd.code.tree.superFastPromptsView'];
  dragMimeTypes = ['application/vnd.code.tree.superFastPromptsView'];

  constructor(private promptManager: PromptManager) { }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TreeItem): Thenable<TreeItem[]> {
    if (!element) {
      // Root level - show root categories only
      const categories = this.promptManager.getRootCategories();

      if (categories.length === 0) {
        return Promise.resolve([]);
      }

      return Promise.resolve(
        categories.map(cat => new CategoryTreeItem(cat, vscode.TreeItemCollapsibleState.Collapsed, this.promptManager))
      );
    } else if (element instanceof CategoryTreeItem) {
      // Show subcategories and prompts in this category
      const subcategories = this.promptManager.getSubcategories(element.category.id);
      const prompts = this.promptManager.getPromptsByCategory(element.category.id);

      const items: TreeItem[] = [];

      // Add subcategories first
      items.push(...subcategories.map(cat => new CategoryTreeItem(cat, vscode.TreeItemCollapsibleState.Collapsed, this.promptManager)));

      // Then add prompts
      items.push(...prompts.map(prompt => new PromptTreeItem(prompt, element.category, this.promptManager)));

      if (items.length === 0) {
        return Promise.resolve([new EmptyTreeItem('No subcategories or prompts')]);
      }

      return Promise.resolve(items);
    }

    return Promise.resolve([]);
  }

  /**
   * Handle drag operation
   */
  async handleDrag(source: readonly TreeItem[], dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): Promise<void> {
    // Store the dragged items
    const items = source.filter(item => item instanceof CategoryTreeItem || item instanceof PromptTreeItem);
    dataTransfer.set('application/vnd.code.tree.superFastPromptsView', new vscode.DataTransferItem(items));
  }

  /**
   * Handle drop operation
   */
  async handleDrop(target: TreeItem | undefined, dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): Promise<void> {
    const transferItem = dataTransfer.get('application/vnd.code.tree.superFastPromptsView');
    if (!transferItem) {
      return;
    }

    const draggedItems = transferItem.value as TreeItem[];
    if (!draggedItems || draggedItems.length === 0) {
      return;
    }

    const draggedItem = draggedItems[0]; // Handle single item drag for now

    // Handle category reordering
    if (draggedItem instanceof CategoryTreeItem) {
      await this.handleCategoryDrop(draggedItem, target);
    }
    // Handle prompt reordering or moving
    else if (draggedItem instanceof PromptTreeItem) {
      await this.handlePromptDrop(draggedItem, target);
    }

    this.refresh();
  }

  /**
   * Handle dropping a category
   */
  private async handleCategoryDrop(draggedCategory: CategoryTreeItem, target: TreeItem | undefined): Promise<void> {
    if (!target) {
      // Dropped at root - move to root level
      const rootCategories = this.promptManager.getRootCategories();
      const filteredCategories = rootCategories.filter(c => c.id !== draggedCategory.category.id);
      const newOrder = [...filteredCategories.map(c => c.id), draggedCategory.category.id];

      // Move to root if not already there
      if (draggedCategory.category.parentCategoryId) {
        await this.promptManager.moveCategoryToParent(draggedCategory.category.id, undefined);
      } else {
        await this.promptManager.reorderCategories(newOrder, undefined);
      }
    } else if (target instanceof CategoryTreeItem) {
      // Check if dropping ON the category (to make it a subcategory) or BEFORE it (to reorder)
      // For now, we'll treat it as moving INTO the target category (making it a subcategory)
      try {
        await this.promptManager.moveCategoryToParent(draggedCategory.category.id, target.category.id);
      } catch (error) {
        // If error (e.g., circular reference), try reordering at same level instead
        const parentId = draggedCategory.category.parentCategoryId;
        const siblings = parentId
          ? this.promptManager.getSubcategories(parentId)
          : this.promptManager.getRootCategories();

        const filteredSiblings = siblings.filter(c => c.id !== draggedCategory.category.id);
        const targetIndex = filteredSiblings.findIndex(c => c.id === target.category.id);

        let newOrder: string[];
        if (targetIndex === -1) {
          newOrder = [...filteredSiblings.map(c => c.id), draggedCategory.category.id];
        } else {
          newOrder = [
            ...filteredSiblings.slice(0, targetIndex).map(c => c.id),
            draggedCategory.category.id,
            ...filteredSiblings.slice(targetIndex).map(c => c.id)
          ];
        }

        await this.promptManager.reorderCategories(newOrder, parentId);
      }
    }
  }

  /**
   * Handle dropping a prompt
   */
  private async handlePromptDrop(draggedPrompt: PromptTreeItem, target: TreeItem | undefined): Promise<void> {
    // Dropped on a category - move to that category
    if (target instanceof CategoryTreeItem) {
      const targetCategoryId = target.category.id;
      const targetPrompts = this.promptManager.getPromptsByCategory(targetCategoryId);
      const newOrder = targetPrompts.length;

      await this.promptManager.movePromptToCategory(draggedPrompt.prompt.id, targetCategoryId, newOrder);
    }
    // Dropped on another prompt - reorder within category or move to different category
    else if (target instanceof PromptTreeItem) {
      const sourceCategoryId = draggedPrompt.prompt.categoryId;
      const targetCategoryId = target.prompt.categoryId;

      if (sourceCategoryId === targetCategoryId) {
        // Reorder within the same category
        const categoryPrompts = this.promptManager.getPromptsByCategory(sourceCategoryId);
        const filteredPrompts = categoryPrompts.filter(p => p.id !== draggedPrompt.prompt.id);
        const targetIndex = filteredPrompts.findIndex(p => p.id === target.prompt.id);

        let newOrder: string[];
        if (targetIndex === -1) {
          newOrder = [...filteredPrompts.map(p => p.id), draggedPrompt.prompt.id];
        } else {
          newOrder = [
            ...filteredPrompts.slice(0, targetIndex).map(p => p.id),
            draggedPrompt.prompt.id,
            ...filteredPrompts.slice(targetIndex).map(p => p.id)
          ];
        }

        await this.promptManager.reorderPromptsInCategory(sourceCategoryId, newOrder);
      } else {
        // Move to different category and place before target
        const targetPrompts = this.promptManager.getPromptsByCategory(targetCategoryId);
        const targetIndex = targetPrompts.findIndex(p => p.id === target.prompt.id);
        const newOrder = targetIndex === -1 ? targetPrompts.length : targetIndex;

        await this.promptManager.movePromptToCategory(draggedPrompt.prompt.id, targetCategoryId, newOrder);
      }
    }
    // Dropped at root - do nothing (prompts must be in a category)
  }
}

export type TreeItem = CategoryTreeItem | PromptTreeItem | EmptyTreeItem;

export class CategoryTreeItem extends vscode.TreeItem {
  constructor(
    public readonly category: Category,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    private promptManager: PromptManager
  ) {
    super(category.name, collapsibleState);

    this.tooltip = `Category: ${category.name}`;
    this.contextValue = 'category';

    // Handle icon configuration
    if (category.icon) {
      if (category.icon.type === 'emoji') {
        // Emoji icons: Display in label (VS Code doesn't support emoji in iconPath)
        // Use the emoji as a visual prefix, with default folder icon
        this.label = `${category.icon.value} ${category.name}`;
        this.iconPath = new vscode.ThemeIcon('folder');
      } else if (category.icon.type === 'themeIcon') {
        // Theme icons: Use as the actual icon
        this.label = category.name;
        this.iconPath = new vscode.ThemeIcon(category.icon.value);
      } else if (category.icon.type === 'file') {
        // Custom image: Use as the actual icon
        this.label = category.name;
        this.iconPath = vscode.Uri.file(promptManager.resolveIconPath(category.icon.value));
      }
    } else {
      // No custom icon: Use default folder icon
      this.label = category.name;
      this.iconPath = new vscode.ThemeIcon('folder');
    }
  }
}

export class PromptTreeItem extends vscode.TreeItem {
  constructor(
    public readonly prompt: Prompt,
    public readonly category: Category,
    private promptManager: PromptManager
  ) {
    super(prompt.name, vscode.TreeItemCollapsibleState.None);

    this.tooltip = prompt.content.substring(0, 100) + (prompt.content.length > 100 ? '...' : '');
    this.contextValue = 'prompt';

    // Handle icon configuration
    if (prompt.icon) {
      if (prompt.icon.type === 'emoji') {
        // Emoji icons: Display in label (VS Code doesn't support emoji in iconPath)
        // Use the emoji as a visual prefix, with default file icon
        this.label = `${prompt.icon.value} ${prompt.name}`;
        this.iconPath = new vscode.ThemeIcon('file-text');
      } else if (prompt.icon.type === 'themeIcon') {
        // Theme icons: Use as the actual icon
        this.label = prompt.name;
        this.iconPath = new vscode.ThemeIcon(prompt.icon.value);
      } else if (prompt.icon.type === 'file') {
        // Custom image: Use as the actual icon
        this.label = prompt.name;
        this.iconPath = vscode.Uri.file(promptManager.resolveIconPath(prompt.icon.value));
      }

    } else {
      // No custom icon: Use default file icon
      this.label = prompt.name;
      this.iconPath = new vscode.ThemeIcon('file-text');
    }

    // Single-click to copy to clipboard
    this.command = {
      command: 'super-fast-prompts.copyPromptFromTree',
      title: 'Copy to Clipboard',
      arguments: [this.prompt.id]
    };
  }
}

export class EmptyTreeItem extends vscode.TreeItem {
  constructor(message: string) {
    super(message, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'empty';
    this.iconPath = new vscode.ThemeIcon('info');
  }
}

