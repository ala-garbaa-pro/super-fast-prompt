import * as vscode from "vscode";
import { StorageService } from "./services/StorageService";
import { PromptManager } from "./services/PromptManager";
import {
  PromptTreeViewProvider,
  PromptTreeItem,
  CategoryTreeItem,
} from "./providers/PromptTreeDataProvider";
import { showIconPicker } from "./utils/customization";
import { IconConfig } from "./types";
import { GitSyncManager } from "./sync/gitSyncManager";

let promptManager: PromptManager;
let treeViewProvider: PromptTreeViewProvider;
let syncManager: GitSyncManager | undefined;
let storageService: StorageService;

export async function activate(context: vscode.ExtensionContext) {
  console.log("Super Fast Prompts extension is now active!");

  try {
    // Initialize services
    storageService = new StorageService(context);

    // Initialize managers (synchronous instantiation)
    promptManager = new PromptManager(storageService);

    // Initialize sync manager
    syncManager = new GitSyncManager(context);

    // Initialize tree view with empty data initially
    treeViewProvider = new PromptTreeViewProvider(promptManager);
    const treeView = vscode.window.createTreeView("superFastPromptsView", {
      treeDataProvider: treeViewProvider,
      showCollapseAll: true,
      dragAndDropController: treeViewProvider,
    });

    // Register commands FIRST - before any async operations that might fail
    context.subscriptions.push(
      treeView,
      vscode.commands.registerCommand(
        "super-fast-prompts.openSettings",
        openSettings
      ),
      vscode.commands.registerCommand(
        "super-fast-prompts.createCategory",
        createCategory
      ),
      vscode.commands.registerCommand(
        "super-fast-prompts.createPrompt",
        createPrompt
      ),
      vscode.commands.registerCommand(
        "super-fast-prompts.viewPrompts",
        viewPrompts
      ),
      vscode.commands.registerCommand(
        "super-fast-prompts.copyPrompt",
        copyPrompt
      ),
      vscode.commands.registerCommand(
        "super-fast-prompts.editPrompt",
        editPrompt
      ),
      vscode.commands.registerCommand(
        "super-fast-prompts.deletePrompt",
        deletePrompt
      ),
      vscode.commands.registerCommand("super-fast-prompts.syncNow", syncNow),
      vscode.commands.registerCommand(
        "super-fast-prompts.setupSync",
        setupSync
      ),
      vscode.commands.registerCommand(
        "super-fast-prompts.pullFromRemote",
        pullFromRemote
      ),
      vscode.commands.registerCommand(
        "super-fast-prompts.pushToRemote",
        pushToRemote
      ),
      vscode.commands.registerCommand(
        "super-fast-prompts.viewSyncHistory",
        viewSyncHistory
      ),
      vscode.commands.registerCommand(
        "super-fast-prompts.refreshView",
        refreshView
      ),
      vscode.commands.registerCommand(
        "super-fast-prompts.copyPromptFromTree",
        copyPromptFromTree
      ),
      vscode.commands.registerCommand(
        "super-fast-prompts.editPromptFromTree",
        editPromptFromTree
      ),
      vscode.commands.registerCommand(
        "super-fast-prompts.deletePromptFromTree",
        deletePromptFromTree
      ),
      vscode.commands.registerCommand(
        "super-fast-prompts.createPromptInCategory",
        createPromptInCategory
      ),
      vscode.commands.registerCommand(
        "super-fast-prompts.createSubcategoryInCategory",
        createSubcategoryInCategory
      ),
      vscode.commands.registerCommand(
        "super-fast-prompts.editCategoryFromTree",
        editCategoryFromTree
      ),
      vscode.commands.registerCommand(
        "super-fast-prompts.deleteCategoryFromTree",
        deleteCategoryFromTree
      ),
      vscode.commands.registerCommand(
        "super-fast-prompts.moveCategoryUp",
        moveCategoryUp
      ),
      vscode.commands.registerCommand(
        "super-fast-prompts.moveCategoryDown",
        moveCategoryDown
      ),
      vscode.commands.registerCommand(
        "super-fast-prompts.movePromptUp",
        movePromptUp
      ),
      vscode.commands.registerCommand(
        "super-fast-prompts.movePromptDown",
        movePromptDown
      ),
      vscode.commands.registerCommand(
        "super-fast-prompts.createSystemConfig",
        createSystemConfig
      )
    );
    // Now perform async initialization in the background
    // If these fail, commands are still registered and the extension is still usable
    try {
      // Check for storage location changes and handle migration
      await storageService.checkAndHandleLocationChange();

      // Register configuration change listener
      context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(async (e) => {
          if (e.affectsConfiguration("superFastPrompts.saveLocation")) {
            await storageService.checkAndHandleLocationChange();
            // Also refresh the tree view as the location has changed
            await promptManager.initialize();
            treeViewProvider.refresh();
          }
        })
      );

      // Initialize prompt manager data
      await promptManager.initialize();

      // Initialize sync manager
      await syncManager.initialize();

      // Refresh tree view with loaded data
      treeViewProvider.refresh();

      // Show welcome message on first activation
      const hasShownWelcome = context.globalState.get("hasShownWelcome", false);
      if (!hasShownWelcome) {
        vscode.window.showInformationMessage(
          "💡 Super Fast Prompts: Click to copy, use icons to edit or preview!",
          { modal: false }
        );
        context.globalState.update("hasShownWelcome", true);
      }
    } catch (initError) {
      console.error("Error during async initialization:", initError);
      vscode.window.showErrorMessage(
        `Super Fast Prompts: Initialization error - ${
          initError instanceof Error ? initError.message : "Unknown error"
        }. Some features may not work correctly.`
      );
    }
  } catch (error) {
    console.error("Critical error during extension activation:", error);
    vscode.window.showErrorMessage(
      `Super Fast Prompts: Failed to activate - ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
    throw error;
  }
}

/**
 * Open extension settings
 */
async function openSettings() {
  await vscode.commands.executeCommand(
    "workbench.action.openSettings",
    "superFastPrompts"
  );
}

/**
 * Create a new category
 */
async function createCategory() {
  const name = await vscode.window.showInputBox({
    prompt: "Enter category name",
    placeHolder: "e.g., Work, Personal, Code Reviews",
  });

  if (!name) {
    return;
  }

  // Ask if user wants to customize icon
  const customize = await vscode.window.showQuickPick(
    ["Yes, add custom icon", "No, use default"],
    {
      title: "Customize Category Icon?",
      placeHolder:
        "Add custom icon to this category (use colored circles for color coding)",
    }
  );

  let icon: IconConfig | null | undefined;

  if (customize === "Yes, add custom icon") {
    // Show icon picker
    icon = await showIconPicker(
      undefined,
      true,
      storageService.getSaveLocation()
    );
  }

  try {
    const category = await promptManager.createCategory(name);

    // Update with icon if provided
    if (icon !== undefined) {
      await promptManager.updateCategory(category.id, name, icon);
    }

    vscode.window.showInformationMessage(
      `Category "${name}" created successfully`
    );
    treeViewProvider.refresh();
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to create category: ${error}`);
  }
}

/**
 * Create a new prompt
 */
async function createPrompt() {
  // First, select a category
  const categories = promptManager.getCategories();

  if (categories.length === 0) {
    const createCat = await vscode.window.showWarningMessage(
      "No categories found. Create one first?",
      "Create Category",
      "Cancel"
    );

    if (createCat === "Create Category") {
      await createCategory();
      return createPrompt(); // Retry after creating category
    }
    return;
  }

  const categoryItems = categories.map((cat) => ({
    label: cat.name,
    description: cat.id,
    category: cat,
  }));

  const selectedCategory = await vscode.window.showQuickPick(categoryItems, {
    placeHolder: "Select a category for this prompt",
  });

  if (!selectedCategory) {
    return;
  }

  // Get prompt name
  const promptName = await vscode.window.showInputBox({
    prompt: "Enter prompt name",
    placeHolder: "e.g., Code Review Template",
  });

  if (!promptName) {
    return;
  }

  try {
    // Create the file immediately and open it
    const filePath = await promptManager.createPromptFile(
      promptName,
      selectedCategory.category.id
    );

    if (!filePath) {
      vscode.window.showErrorMessage("Failed to create prompt file");
      return;
    }

    // Open the file in VS Code's Markdown editor
    const { createAndEditMarkdownFile } = await import(
      "./providers/MarkdownEditorProvider"
    );
    const editorResult = await createAndEditMarkdownFile(filePath, "");

    const content = editorResult.content || "";

    // Save to prompts.json
    await promptManager.savePromptFromFile(
      promptName,
      content,
      selectedCategory.category.id,
      filePath
    );
    vscode.window.showInformationMessage(
      `Prompt "${promptName}" created successfully`
    );
    treeViewProvider.refresh();
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to create prompt: ${error}`);
  }
}

/**
 * View and select prompts
 */
async function viewPrompts() {
  const categories = promptManager.getCategories();

  if (categories.length === 0) {
    vscode.window.showInformationMessage(
      "No categories found. Create one first."
    );
    return;
  }

  // Build quick pick items grouped by category
  const items: vscode.QuickPickItem[] = [];

  for (const category of categories) {
    items.push({
      label: category.name,
      kind: vscode.QuickPickItemKind.Separator,
    });

    const prompts = promptManager.getPromptsByCategory(category.id);

    if (prompts.length === 0) {
      items.push({
        label: "  (no prompts)",
        description: "",
        detail: "",
      });
    } else {
      for (const prompt of prompts) {
        items.push({
          label: `  ${prompt.name}`,
          description: prompt.id,
          detail:
            prompt.content.substring(0, 100) +
            (prompt.content.length > 100 ? "..." : ""),
        });
      }
    }
  }

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: "Select a prompt to copy to clipboard",
  });

  if (selected && selected.description) {
    await promptManager.copyPromptToClipboard(selected.description);
  }
}

/**
 * Copy a prompt to clipboard
 */
async function copyPrompt() {
  await viewPrompts();
}

/**
 * Edit an existing prompt
 */
async function editPrompt() {
  const prompts = promptManager.getPrompts();

  if (prompts.length === 0) {
    vscode.window.showInformationMessage("No prompts found.");
    return;
  }

  const items = prompts.map((prompt) => {
    const category = promptManager.getCategory(prompt.categoryId);
    return {
      label: prompt.name,
      description: category?.name || "Unknown",
      detail:
        prompt.content.substring(0, 100) +
        (prompt.content.length > 100 ? "..." : ""),
      prompt,
    };
  });

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: "Select a prompt to edit",
  });

  if (!selected) {
    return;
  }

  try {
    // Get the file path for this prompt
    const filePath = await promptManager.getPromptFilePath(selected.prompt);

    if (!filePath) {
      vscode.window.showErrorMessage("Could not find prompt file");
      return;
    }

    // Open the actual file in Markdown editor
    const { createAndEditMarkdownFile } = await import(
      "./providers/MarkdownEditorProvider"
    );
    const editorResult = await createAndEditMarkdownFile(
      filePath,
      selected.prompt.content
    );

    if (!editorResult.saved) {
      // User cancelled the edit
      return;
    }

    const newContent = editorResult.content || selected.prompt.content;

    // Update prompts.json
    await promptManager.updatePrompt(
      selected.prompt.id,
      selected.prompt.name,
      newContent,
      selected.prompt.categoryId
    );
    vscode.window.showInformationMessage(
      `Prompt "${selected.prompt.name}" updated successfully`
    );
    treeViewProvider.refresh();
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to update prompt: ${error}`);
  }
}

/**
 * Delete a prompt
 */
async function deletePrompt() {
  const prompts = promptManager.getPrompts();

  if (prompts.length === 0) {
    vscode.window.showInformationMessage("No prompts found.");
    return;
  }

  const items = prompts.map((prompt) => {
    const category = promptManager.getCategory(prompt.categoryId);
    return {
      label: prompt.name,
      description: category?.name || "Unknown",
      detail:
        prompt.content.substring(0, 100) +
        (prompt.content.length > 100 ? "..." : ""),
      prompt,
    };
  });

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: "Select a prompt to delete",
  });

  if (!selected) {
    return;
  }

  const confirm = await vscode.window.showWarningMessage(
    `Are you sure you want to delete "${selected.prompt.name}"?`,
    "Delete",
    "Cancel"
  );

  if (confirm !== "Delete") {
    return;
  }

  try {
    await promptManager.deletePrompt(selected.prompt.id);
    vscode.window.showInformationMessage(
      `Prompt "${selected.prompt.name}" deleted successfully`
    );
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to delete prompt: ${error}`);
  }
}

/**
 * Refresh the tree view
 */
function refreshView() {
  treeViewProvider.refresh();
}

/**
 * Copy a prompt from the tree view (single-click or copy icon)
 */
async function copyPromptFromTree(item: PromptTreeItem | string) {
  try {
    // Handle both PromptTreeItem object and string promptId
    const promptId = typeof item === "string" ? item : item.prompt.id;
    await promptManager.copyPromptToClipboard(promptId);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to copy prompt: ${error}`);
  }
}

/**
 * Edit a prompt from the tree view
 */
async function editPromptFromTree(item: PromptTreeItem) {
  const prompt = item.prompt;

  // Ask what to edit
  const editOption = await vscode.window.showQuickPick(
    ["Edit Name", "Edit Content", "Edit Icon", "Edit All"],
    {
      title: `Edit Prompt: ${prompt.name}`,
      placeHolder: "What would you like to edit?",
    }
  );

  if (!editOption) {
    return;
  }

  let newName = prompt.name;
  let newContent = prompt.content;
  let icon: IconConfig | null | undefined = undefined;
  let shouldUpdateIcon = false;

  if (editOption === "Edit Name" || editOption === "Edit All") {
    const nameInput = await vscode.window.showInputBox({
      prompt: "Enter new name (or keep current)",
      value: prompt.name,
    });

    if (!nameInput) {
      return;
    }

    newName = nameInput;
  }

  if (editOption === "Edit Content" || editOption === "Edit All") {
    // Get the file path and open the actual file
    const filePath = await promptManager.getPromptFilePath(prompt);

    if (!filePath) {
      vscode.window.showErrorMessage("Could not find prompt file");
      return;
    }

    const { createAndEditMarkdownFile } = await import(
      "./providers/MarkdownEditorProvider"
    );
    const editorResult = await createAndEditMarkdownFile(
      filePath,
      prompt.content
    );

    if (!editorResult.saved) {
      // User cancelled the edit
      return;
    }

    newContent = editorResult.content || prompt.content;
  }

  if (editOption === "Edit Icon" || editOption === "Edit All") {
    const pickedIcon = await showIconPicker(
      prompt.icon,
      false,
      storageService.getSaveLocation()
    );
    // undefined = user cancelled, don't update
    // null = user wants to remove icon
    // IconConfig = user selected an icon
    if (pickedIcon !== undefined) {
      icon = pickedIcon;
      shouldUpdateIcon = true;
    }
  }

  try {
    await promptManager.updatePrompt(
      prompt.id,
      newName,
      newContent,
      prompt.categoryId,
      shouldUpdateIcon ? icon : undefined
    );
    vscode.window.showInformationMessage(
      `Prompt "${newName}" updated successfully`
    );
    treeViewProvider.refresh();
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to update prompt: ${error}`);
  }
}

/**
 * Delete a prompt from the tree view
 */
async function deletePromptFromTree(item: PromptTreeItem) {
  const confirm = await vscode.window.showWarningMessage(
    `Are you sure you want to delete "${item.prompt.name}"?`,
    "Delete",
    "Cancel"
  );

  if (confirm !== "Delete") {
    return;
  }

  try {
    await promptManager.deletePrompt(item.prompt.id);
    vscode.window.showInformationMessage(
      `Prompt "${item.prompt.name}" deleted successfully`
    );
    treeViewProvider.refresh();
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to delete prompt: ${error}`);
  }
}

/**
 * Create a prompt in a specific category from the tree view
 */
async function createPromptInCategory(item: CategoryTreeItem) {
  const name = await vscode.window.showInputBox({
    prompt: "Enter prompt name",
    placeHolder: "e.g., Code Review Template",
  });

  if (!name) {
    console.log("[createPromptInCategory] No name provided, cancelling");
    return;
  }

  console.log(
    `[createPromptInCategory] Creating prompt "${name}" in category "${item.category.name}" (ID: ${item.category.id})`
  );

  try {
    // Create the file immediately and open it
    const filePath = await promptManager.createPromptFile(
      name,
      item.category.id
    );
    console.log(`[createPromptInCategory] File path created: ${filePath}`);

    if (!filePath) {
      vscode.window.showErrorMessage("Failed to create prompt file");
      return;
    }

    // Open the file in VS Code's Markdown editor
    const { createAndEditMarkdownFile } = await import(
      "./providers/MarkdownEditorProvider"
    );
    console.log("[createPromptInCategory] Opening markdown editor...");
    const editorResult = await createAndEditMarkdownFile(filePath, "");
    console.log(
      `[createPromptInCategory] Editor result - saved: ${
        editorResult.saved
      }, content length: ${editorResult.content?.length || 0}`
    );

    if (!editorResult.saved) {
      console.log("[createPromptInCategory] User cancelled, not saving prompt");
      vscode.window.showInformationMessage("Prompt creation cancelled");
      return;
    }

    const content = editorResult.content || "";

    // Ask if user wants to customize icon
    const customize = await vscode.window.showQuickPick(
      ["Yes, add custom icon", "No, use default"],
      {
        title: "Customize Prompt Icon?",
        placeHolder:
          "Add custom icon to this prompt (use colored circles for color coding)",
      }
    );

    let icon: IconConfig | null | undefined;

    if (customize === "Yes, add custom icon") {
      // Show icon picker
      icon = await showIconPicker(
        undefined,
        false,
        storageService.getSaveLocation()
      );
    }

    // Save to prompts.json
    console.log("[createPromptInCategory] Saving prompt to prompts.json...");
    const prompt = await promptManager.savePromptFromFile(
      name,
      content,
      item.category.id,
      filePath
    );
    console.log(`[createPromptInCategory] Prompt saved with ID: ${prompt.id}`);

    // Update with icon if provided
    if (icon !== undefined) {
      console.log("[createPromptInCategory] Updating prompt with icon...");
      await promptManager.updatePrompt(
        prompt.id,
        name,
        content,
        item.category.id,
        icon
      );
    }

    vscode.window.showInformationMessage(
      `Prompt "${name}" created in "${item.category.name}"`
    );
    console.log("[createPromptInCategory] Refreshing tree view...");
    treeViewProvider.refresh();
    console.log("[createPromptInCategory] Done!");
  } catch (error) {
    console.error("[createPromptInCategory] Error:", error);
    vscode.window.showErrorMessage(`Failed to create prompt: ${error}`);
  }
}

/**
 * Create a subcategory in a specific category from the tree view
 */
async function createSubcategoryInCategory(item: CategoryTreeItem) {
  const name = await vscode.window.showInputBox({
    prompt: "Enter subcategory name",
    placeHolder: "e.g., Frontend, Backend",
  });

  if (!name) {
    return;
  }

  try {
    await promptManager.createCategory(name, item.category.id);
    vscode.window.showInformationMessage(
      `Subcategory "${name}" created in "${item.category.name}"`
    );
    treeViewProvider.refresh();
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to create subcategory: ${error}`);
  }
}

/**
 * Edit a category from the tree view
 */
async function editCategoryFromTree(item: CategoryTreeItem) {
  // Ask what to edit
  const editOption = await vscode.window.showQuickPick(
    ["Edit Name", "Edit Icon", "Edit All"],
    {
      title: `Edit Category: ${item.category.name}`,
      placeHolder: "What would you like to edit?",
    }
  );

  if (!editOption) {
    return;
  }

  let newName = item.category.name;
  let icon: IconConfig | null | undefined = undefined;
  let shouldUpdateIcon = false;

  if (editOption === "Edit Name" || editOption === "Edit All") {
    const nameInput = await vscode.window.showInputBox({
      prompt: "Enter new category name",
      value: item.category.name,
    });

    if (!nameInput) {
      return;
    }

    newName = nameInput;
  }

  if (editOption === "Edit Icon" || editOption === "Edit All") {
    const pickedIcon = await showIconPicker(
      item.category.icon,
      true,
      storageService.getSaveLocation()
    );
    // undefined = user cancelled, don't update
    // null = user wants to remove icon
    // IconConfig = user selected an icon
    if (pickedIcon !== undefined) {
      icon = pickedIcon;
      shouldUpdateIcon = true;
    }
  }

  try {
    await promptManager.updateCategory(
      item.category.id,
      newName,
      shouldUpdateIcon ? icon : undefined
    );
    vscode.window.showInformationMessage(
      `Category "${newName}" updated successfully`
    );
    treeViewProvider.refresh();
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to update category: ${error}`);
  }
}

/**
 * Delete a category from the tree view
 */
async function deleteCategoryFromTree(item: CategoryTreeItem) {
  const prompts = promptManager.getPromptsByCategory(item.category.id);
  const subcategories = promptManager.getSubcategories(item.category.id);
  const promptCount = prompts.length;
  const subcategoryCount = subcategories.length;

  let message = `Are you sure you want to delete "${item.category.name}"?`;
  if (subcategoryCount > 0 && promptCount > 0) {
    message = `Are you sure you want to delete "${item.category.name}", its ${subcategoryCount} subcategory(ies), and ${promptCount} prompt(s)?`;
  } else if (subcategoryCount > 0) {
    message = `Are you sure you want to delete "${item.category.name}" and its ${subcategoryCount} subcategory(ies)?`;
  } else if (promptCount > 0) {
    message = `Are you sure you want to delete "${item.category.name}" and its ${promptCount} prompt(s)?`;
  }

  const confirm = await vscode.window.showWarningMessage(
    message,
    "Delete",
    "Cancel"
  );

  if (confirm !== "Delete") {
    return;
  }

  try {
    await promptManager.deleteCategory(item.category.id);
    vscode.window.showInformationMessage(
      `Category "${item.category.name}" deleted successfully`
    );
    treeViewProvider.refresh();
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to delete category: ${error}`);
  }
}

/**
 * Move a category up in the order
 */
async function moveCategoryUp(item: CategoryTreeItem) {
  try {
    const moved = await promptManager.moveCategoryUp(item.category.id);
    if (moved) {
      treeViewProvider.refresh();
    }
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to move category up: ${error}`);
  }
}

/**
 * Move a category down in the order
 */
async function moveCategoryDown(item: CategoryTreeItem) {
  try {
    const moved = await promptManager.moveCategoryDown(item.category.id);
    if (moved) {
      treeViewProvider.refresh();
    }
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to move category down: ${error}`);
  }
}

/**
 * Move a prompt up in the order
 */
async function movePromptUp(item: PromptTreeItem) {
  try {
    const moved = await promptManager.movePromptUp(item.prompt.id);
    if (moved) {
      treeViewProvider.refresh();
    }
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to move prompt up: ${error}`);
  }
}

/**
 * Move a prompt down in the order
 */
async function movePromptDown(item: PromptTreeItem) {
  try {
    const moved = await promptManager.movePromptDown(item.prompt.id);
    if (moved) {
      treeViewProvider.refresh();
    }
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to move prompt down: ${error}`);
  }
}

/**
 * Sync prompts with GitHub
 */
async function syncNow() {
  if (!syncManager) {
    vscode.window.showErrorMessage("Sync manager not initialized");
    return;
  }

  const result = await syncManager.sync();

  if (result.success) {
    vscode.window.showInformationMessage(result.message);
    treeViewProvider.refresh();
  } else {
    vscode.window.showErrorMessage(result.message);

    if (result.conflicts && result.conflicts.length > 0) {
      const resolve = await vscode.window.showWarningMessage(
        `Conflicts detected in: ${result.conflicts.join(", ")}`,
        "Resolve Now"
      );

      if (resolve === "Resolve Now") {
        await syncNow();
      }
    }
  }
}

/**
 * Setup GitHub sync wizard
 */
async function setupSync() {
  const fs = require("fs");
  const path = require("path");
  const os = require("os");

  // Step 1: Repository URL
  const repoUrl = await vscode.window.showInputBox({
    prompt: "Enter your GitHub repository URL",
    placeHolder: "https://github.com/username/super-fast-prompts-sync.git",
    validateInput: (value) => {
      if (!value || !value.trim()) {
        return "Repository URL is required";
      }
      if (!value.startsWith("https://github.com/")) {
        return "Please use HTTPS URL format";
      }
      if (!value.endsWith(".git")) {
        return "URL should end with .git";
      }
      return null;
    },
  });

  if (!repoUrl) {
    return;
  }

  // Step 2: Get current save location (this will be the Git repo location)
  const config = vscode.workspace.getConfiguration("superFastPrompts");
  const currentSaveLocation = config.get<string>("saveLocation");
  let expandedLocalPath = "";

  if (currentSaveLocation) {
    expandedLocalPath = currentSaveLocation.replace(/^~/, os.homedir());
  } else {
    expandedLocalPath = path.join(
      os.homedir(),
      "super-fast-prompts",
      "private"
    );
  }

  // Show info message
  vscode.window.showInformationMessage(
    `Git repository will be initialized in your prompts directory: ${expandedLocalPath}`
  );

  // Step 3: Check for existing prompts in current save location
  let currentPromptsPath = expandedLocalPath;

  // Ensure directory exists
  if (!fs.existsSync(expandedLocalPath)) {
    fs.mkdirSync(expandedLocalPath, { recursive: true });
  }

  // Step 3: Branch name
  const branch = await vscode.window.showQuickPick(
    ["main", "master", "develop", "Custom..."],
    {
      placeHolder: "Select branch to sync with",
    }
  );

  if (!branch) {
    return;
  }

  let finalBranch = branch;
  if (branch === "Custom...") {
    const customBranch = await vscode.window.showInputBox({
      prompt: "Enter custom branch name",
      placeHolder: "feature-branch",
    });

    if (!customBranch) {
      return;
    }
    finalBranch = customBranch;
  }

  // Step 4: Sync mode
  const mode = await vscode.window.showQuickPick(
    [
      { label: "Manual", description: "Sync only when you run the command" },
      {
        label: "On Save",
        description: "Sync automatically when file is saved",
      },
      { label: "Automatic", description: "Sync at regular intervals" },
    ],
    {
      placeHolder: "Select sync mode",
    }
  );

  if (!mode) {
    return;
  }

  // Save sync configuration
  const syncConfig = vscode.workspace.getConfiguration("superFastPrompts.sync");
  await syncConfig.update("enabled", true, vscode.ConfigurationTarget.Global);
  await syncConfig.update(
    "repositoryUrl",
    repoUrl,
    vscode.ConfigurationTarget.Global
  );
  await syncConfig.update(
    "branch",
    finalBranch,
    vscode.ConfigurationTarget.Global
  );
  await syncConfig.update(
    "mode",
    mode.label.toLowerCase().replace(" ", "-"),
    vscode.ConfigurationTarget.Global
  );

  vscode.window
    .showInformationMessage(
      "GitHub sync configured successfully! Reload window to apply changes.",
      "Reload"
    )
    .then((choice) => {
      if (choice === "Reload") {
        vscode.commands.executeCommand("workbench.action.reloadWindow");
      }
    });
}

/**
 * Pull from remote repository
 */
async function pullFromRemote() {
  if (!syncManager) {
    vscode.window.showErrorMessage("Sync manager not initialized");
    return;
  }

  const result = await syncManager.pullFromRemote();

  if (result.success) {
    vscode.window.showInformationMessage(result.message);
    treeViewProvider.refresh();
  } else {
    vscode.window.showErrorMessage(result.message);
  }
}

/**
 * Push to remote repository
 */
async function pushToRemote() {
  if (!syncManager) {
    vscode.window.showErrorMessage("Sync manager not initialized");
    return;
  }

  const result = await syncManager.pushToRemote();

  if (result.success) {
    vscode.window.showInformationMessage(result.message);
  } else {
    vscode.window.showErrorMessage(result.message);
  }
}

/**
 * View sync history
 */
async function viewSyncHistory() {
  if (!syncManager) {
    vscode.window.showErrorMessage("Sync manager not initialized");
    return;
  }

  const history = await syncManager.getSyncHistory(20);

  if (history.length === 0) {
    vscode.window.showInformationMessage("No sync history available");
    return;
  }

  const items = history.map((commit) => ({
    label: commit.message,
    description: commit.date,
    detail: `${commit.author_name} <${commit.author_email}>`,
  }));

  await vscode.window.showQuickPick(items, {
    placeHolder: "Sync History",
    matchOnDescription: true,
    matchOnDetail: true,
  });
}

export function deactivate() {
  if (syncManager) {
    syncManager.dispose();
  }
}

/**
 * Create a system-specific configuration file
 */
async function createSystemConfig() {
  try {
    await storageService.createSystemConfig();
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to create system config: ${error}`);
  }
}
