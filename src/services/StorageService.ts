import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import {
  PromptData,
  Category,
  Prompt,
  CategoryMetadata,
  PromptMetadata,
} from "../types";
import { ConfigManager } from "./ConfigManager";

export class StorageService {
  private static readonly CATEGORY_METADATA_FILE = "metadata.json";
  private static readonly LAST_LOCATION_KEY = "lastSaveLocation";
  private configManager: ConfigManager;

  constructor(private context: vscode.ExtensionContext) {
    this.configManager = new ConfigManager(context);
  }

  /**
   * Get the configured save location for prompts
   */
  getSaveLocation(): string {
    const config = vscode.workspace.getConfiguration("superFastPrompts");
    const configuredPath = config.get<string>("saveLocation");

    if (configuredPath) {
      // Expand ~ to home directory
      return configuredPath.replace(/^~/, require("os").homedir());
    }

    // Default location
    return path.join(require("os").homedir(), "super-fast-prompts", "private");
  }

  /**
   * Ensure the save directory exists
   */
  private ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * Load all prompts and categories from disk by scanning folders
   */
  async load(): Promise<PromptData> {
    try {
      const saveLocation = this.getSaveLocation();

      if (!fs.existsSync(saveLocation)) {
        return { categories: [], prompts: [] };
      }

      const categories: Category[] = [];
      const prompts: Prompt[] = [];

      // Recursively scan directories
      this.scanDirectory(saveLocation, null, categories, prompts);

      return { categories, prompts };
    } catch (error) {
      console.error("Error loading prompts:", error);
      vscode.window.showErrorMessage("Failed to load prompts");
      return { categories: [], prompts: [] };
    }
  }

  /**
   * Recursively scan a directory for categories and prompts
   */
  private scanDirectory(
    dirPath: string,
    parentCategoryId: string | null,
    categories: Category[],
    prompts: Prompt[]
  ): void {
    const items = fs.readdirSync(dirPath);

    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stat = fs.statSync(itemPath);

      if (stat.isDirectory()) {
        // This is a category folder
        const metadataPath = path.join(
          itemPath,
          StorageService.CATEGORY_METADATA_FILE
        );

        if (fs.existsSync(metadataPath)) {
          const metadata = JSON.parse(
            fs.readFileSync(metadataPath, "utf-8")
          ) as CategoryMetadata;

          // Add category
          categories.push({
            id: metadata.id,
            name: metadata.name,
            order: metadata.order,
            parentCategoryId: parentCategoryId || undefined,
            icon: metadata.icon,
          });

          // Detect and process orphaned .md files (files without metadata)
          this.detectAndProcessOrphanedMdFiles(itemPath, metadata);

          // Load prompts from this category
          for (const promptMeta of metadata.prompts) {
            const mdFilePath = path.join(itemPath, promptMeta.fileName);

            if (fs.existsSync(mdFilePath)) {
              const content = fs.readFileSync(mdFilePath, "utf-8");

              prompts.push({
                id: promptMeta.id,
                name: promptMeta.name,
                content: content,
                categoryId: metadata.id,
                order: promptMeta.order,
                icon: promptMeta.icon,
              });
            }
          }

          // Recursively scan subcategories
          this.scanDirectory(itemPath, metadata.id, categories, prompts);
        }
      }
    }
  }

  /**
   * Detect and process orphaned .md files (files without corresponding .metadata.json)
   * Creates metadata files and updates category metadata for orphaned prompts
   */
  private detectAndProcessOrphanedMdFiles(
    categoryDir: string,
    categoryMetadata: CategoryMetadata
  ): void {
    try {
      const items = fs.readdirSync(categoryDir);

      // Find all .md files in the directory
      const mdFiles = items.filter(
        (item) =>
          item.endsWith(".md") &&
          fs.statSync(path.join(categoryDir, item)).isFile()
      );

      // Track if we need to update category metadata
      let metadataUpdated = false;

      for (const mdFile of mdFiles) {
        // Check if this .md file has a corresponding .metadata.json file
        const baseName = mdFile.replace(/\.md$/, "");
        const metadataFileName = `${baseName}.metadata.json`;
        const metadataFilePath = path.join(categoryDir, metadataFileName);

        // Check if the file is already registered in category metadata
        const isRegistered = categoryMetadata.prompts.some(
          (p) => p.fileName === mdFile
        );

        if (!fs.existsSync(metadataFilePath) || !isRegistered) {
          // This is an orphaned .md file - create metadata for it
          console.log(
            `Found orphaned .md file: ${mdFile} in category ${categoryMetadata.name}`
          );

          // Read the content to use as the prompt content
          const mdFilePath = path.join(categoryDir, mdFile);
          const content = fs.readFileSync(mdFilePath, "utf-8");

          // Generate a new UUID for this prompt
          const { randomUUID } = require("crypto");
          const promptId = randomUUID();

          // Determine the next available order number
          const maxOrder =
            categoryMetadata.prompts.length > 0
              ? Math.max(...categoryMetadata.prompts.map((p) => p.order))
              : -1;
          const order = maxOrder + 1;

          // Use the filename (without .md extension) as the prompt name
          const promptName = baseName.replace(/_/g, " ");

          // Create the prompt metadata
          const promptMetadata: PromptMetadata = {
            id: promptId,
            name: promptName,
            categoryId: categoryMetadata.id,
            order: order,
            fileName: mdFile,
          };

          // Save the .metadata.json file
          fs.writeFileSync(
            metadataFilePath,
            JSON.stringify(promptMetadata, null, 2),
            "utf-8"
          );

          // Add to category metadata if not already registered
          if (!isRegistered) {
            categoryMetadata.prompts.push(promptMetadata);
            metadataUpdated = true;
          }

          console.log(
            `Created metadata for orphaned file: ${mdFile} with ID: ${promptId}`
          );
        }
      }

      // Update the category's metadata.json file if we added new prompts
      if (metadataUpdated) {
        const categoryMetadataPath = path.join(
          categoryDir,
          StorageService.CATEGORY_METADATA_FILE
        );
        fs.writeFileSync(
          categoryMetadataPath,
          JSON.stringify(categoryMetadata, null, 2),
          "utf-8"
        );
        console.log(`Updated category metadata for: ${categoryMetadata.name}`);
      }
    } catch (error) {
      console.error("Error detecting orphaned .md files:", error);
      // Don't throw - this is not critical, just log the error
    }
  }

  /**
   * Save is no longer needed - we save directly to files
   */
  async save(data: PromptData): Promise<void> {
    // This method is deprecated - we now save directly to individual files
    // Kept for backward compatibility
  }

  /**
   * Get the category path (including parent categories)
   */
  private getCategoryPath(
    category: Category,
    getCategoryById: (id: string) => Category | undefined
  ): string {
    const parts: string[] = [];
    let current: Category | undefined = category;

    while (current) {
      parts.unshift(current.name);
      current = current.parentCategoryId
        ? getCategoryById(current.parentCategoryId)
        : undefined;
    }

    return path.join(...parts);
  }

  /**
   * Create a category folder with metadata.json file
   */
  async createCategoryFolder(
    category: Category,
    getCategoryById: (id: string) => Category | undefined
  ): Promise<void> {
    try {
      const saveLocation = this.getSaveLocation();
      const categoryPath = this.getCategoryPath(category, getCategoryById);
      const categoryDir = path.join(saveLocation, categoryPath);

      this.ensureDirectoryExists(categoryDir);

      // Create metadata.json file
      const metadata: CategoryMetadata = {
        id: category.id,
        name: category.name,
        order: category.order,
        parentCategoryId: category.parentCategoryId,
        icon: category.icon,
        prompts: [],
        subcategories: [],
      };

      const metadataPath = path.join(
        categoryDir,
        StorageService.CATEGORY_METADATA_FILE
      );
      fs.writeFileSync(
        metadataPath,
        JSON.stringify(metadata, null, 2),
        "utf-8"
      );

      // Create .gitkeep file
      const gitkeepPath = path.join(categoryDir, ".gitkeep");
      if (!fs.existsSync(gitkeepPath)) {
        fs.writeFileSync(gitkeepPath, "", "utf-8");
      }
    } catch (error) {
      console.error("Error creating category folder:", error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Save a prompt as a Markdown file with metadata in its category folder
   */
  async savePromptAsMarkdown(
    prompt: Prompt,
    category: Category,
    getCategoryById: (id: string) => Category | undefined
  ): Promise<void> {
    try {
      const saveLocation = this.getSaveLocation();
      const categoryPath = this.getCategoryPath(category, getCategoryById);
      const categoryDir = path.join(saveLocation, categoryPath);

      this.ensureDirectoryExists(categoryDir);

      // Sanitize filename
      const sanitizedName = prompt.name.replace(/[^a-z0-9_\-\s]/gi, "_");
      const fileName = `${sanitizedName}.md`;
      const metadataFileName = `${sanitizedName}.metadata.json`;

      const filePath = path.join(categoryDir, fileName);
      const metadataPath = path.join(categoryDir, metadataFileName);

      // Save content
      fs.writeFileSync(filePath, prompt.content, "utf-8");

      // Save metadata
      const promptMetadata: PromptMetadata = {
        id: prompt.id,
        name: prompt.name,
        categoryId: prompt.categoryId,
        order: prompt.order,
        icon: prompt.icon,
        fileName: fileName,
      };
      fs.writeFileSync(
        metadataPath,
        JSON.stringify(promptMetadata, null, 2),
        "utf-8"
      );

      // Update category metadata
      await this.updateCategoryMetadata(category, getCategoryById);
    } catch (error) {
      console.error("Error saving prompt as Markdown:", error);
      throw error;
    }
  }

  /**
   * Update category metadata file with current prompts list
   */
  async updateCategoryMetadata(
    category: Category,
    getCategoryById: (id: string) => Category | undefined
  ): Promise<void> {
    try {
      const saveLocation = this.getSaveLocation();
      const categoryPath = this.getCategoryPath(category, getCategoryById);
      const categoryDir = path.join(saveLocation, categoryPath);
      const metadataPath = path.join(
        categoryDir,
        StorageService.CATEGORY_METADATA_FILE
      );

      // Always create metadata from the current category object
      const metadata: CategoryMetadata = {
        id: category.id,
        name: category.name,
        order: category.order,
        parentCategoryId: category.parentCategoryId,
        icon: category.icon,
        prompts: [],
        subcategories: [],
      };

      // Scan for all .metadata.json files in this directory (exclude category's metadata.json)
      const items = fs.readdirSync(categoryDir);
      const promptMetadataFiles = items.filter(
        (item) =>
          item.endsWith(".metadata.json") &&
          item !== StorageService.CATEGORY_METADATA_FILE
      );

      for (const metaFile of promptMetadataFiles) {
        const metaPath = path.join(categoryDir, metaFile);
        const promptMeta = JSON.parse(
          fs.readFileSync(metaPath, "utf-8")
        ) as PromptMetadata;
        metadata.prompts.push(promptMeta);
      }

      // Scan for subdirectories (subcategories)
      metadata.subcategories = items.filter((item) => {
        const itemPath = path.join(categoryDir, item);
        return fs.statSync(itemPath).isDirectory();
      });

      // Save updated metadata
      fs.writeFileSync(
        metadataPath,
        JSON.stringify(metadata, null, 2),
        "utf-8"
      );
    } catch (error) {
      console.error("Error updating category metadata:", error);
    }
  }

  /**
   * Create a prompt file in the category folder and return the file path
   */
  async createPromptFile(
    fileName: string,
    category: Category,
    getCategoryById: (id: string) => Category | undefined
  ): Promise<string | null> {
    try {
      const saveLocation = this.getSaveLocation();
      const categoryPath = this.getCategoryPath(category, getCategoryById);
      const categoryDir = path.join(saveLocation, categoryPath);

      this.ensureDirectoryExists(categoryDir);

      // Sanitize filename and add .md extension
      const sanitizedName = fileName.replace(/[^a-z0-9_\-\s]/gi, "_");
      const mdFileName = sanitizedName.endsWith(".md")
        ? sanitizedName
        : `${sanitizedName}.md`;
      const filePath = path.join(categoryDir, mdFileName);

      return filePath;
    } catch (error) {
      console.error("Error creating prompt file path:", error);
      return null;
    }
  }

  /**
   * Get the file path for an existing prompt
   */
  async getPromptFilePath(
    prompt: Prompt,
    category: Category,
    getCategoryById: (id: string) => Category | undefined
  ): Promise<string | null> {
    try {
      const saveLocation = this.getSaveLocation();
      const categoryPath = this.getCategoryPath(category, getCategoryById);
      const categoryDir = path.join(saveLocation, categoryPath);

      // Sanitize filename
      const sanitizedName = prompt.name.replace(/[^a-z0-9_\-\s]/gi, "_");
      const fileName = `${sanitizedName}.md`;
      const filePath = path.join(categoryDir, fileName);

      // Check if file exists, if not create it with current content
      if (!fs.existsSync(filePath)) {
        this.ensureDirectoryExists(categoryDir);
        fs.writeFileSync(filePath, prompt.content, "utf-8");

        // Also create metadata file
        const metadataFileName = `${sanitizedName}.metadata.json`;
        const metadataPath = path.join(categoryDir, metadataFileName);
        const promptMetadata: PromptMetadata = {
          id: prompt.id,
          name: prompt.name,
          categoryId: prompt.categoryId,
          order: prompt.order,
          icon: prompt.icon,
          fileName: fileName,
        };
        fs.writeFileSync(
          metadataPath,
          JSON.stringify(promptMetadata, null, 2),
          "utf-8"
        );
      }

      return filePath;
    } catch (error) {
      console.error("Error getting prompt file path:", error);
      return null;
    }
  }

  /**
   * Delete a prompt's files (both .md and .metadata.json)
   */
  async deletePromptFiles(
    prompt: Prompt,
    category: Category,
    getCategoryById: (id: string) => Category | undefined
  ): Promise<void> {
    try {
      const saveLocation = this.getSaveLocation();
      const categoryPath = this.getCategoryPath(category, getCategoryById);
      const categoryDir = path.join(saveLocation, categoryPath);

      // Sanitize filename
      const sanitizedName = prompt.name.replace(/[^a-z0-9_\-\s]/gi, "_");
      const fileName = `${sanitizedName}.md`;
      const metadataFileName = `${sanitizedName}.metadata.json`;

      const filePath = path.join(categoryDir, fileName);
      const metadataPath = path.join(categoryDir, metadataFileName);

      // Delete files if they exist
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      if (fs.existsSync(metadataPath)) {
        fs.unlinkSync(metadataPath);
      }

      // Update category metadata
      await this.updateCategoryMetadata(category, getCategoryById);
    } catch (error) {
      console.error("Error deleting prompt files:", error);
    }
  }

  /**
   * Delete a category folder and all its contents recursively
   */
  async deleteCategoryFolder(
    category: Category,
    getCategoryById: (id: string) => Category | undefined
  ): Promise<void> {
    try {
      const saveLocation = this.getSaveLocation();
      const categoryPath = this.getCategoryPath(category, getCategoryById);
      const categoryDir = path.join(saveLocation, categoryPath);

      // Check if directory exists
      if (fs.existsSync(categoryDir)) {
        // Recursively delete the directory and all its contents
        fs.rmSync(categoryDir, { recursive: true, force: true });
        console.log(`Deleted category folder: ${categoryDir}`);
      }
    } catch (error) {
      console.error("Error deleting category folder:", error);
      throw error;
    }
  }

  /**
   * Check if save location has changed and handle migration
   */
  async checkAndHandleLocationChange(): Promise<void> {
    const currentLocation = this.getSaveLocation();
    const lastLocation = this.context.globalState.get<string>(
      StorageService.LAST_LOCATION_KEY
    );

    // First time or no change
    if (!lastLocation || lastLocation === currentLocation) {
      await this.context.globalState.update(
        StorageService.LAST_LOCATION_KEY,
        currentLocation
      );
      return;
    }

    // Location has changed - just update the location
    // (No migration needed since we use file-based storage now)
    await this.context.globalState.update(
      StorageService.LAST_LOCATION_KEY,
      currentLocation
    );

    // Check for config file in new location
    const detectedConfig = this.configManager.detectConfigFile(currentLocation);
    if (detectedConfig) {
      vscode.window.showWarningMessage(
        `Configuration file detected in this location: ${path.basename(
          detectedConfig
        )}. Please verify your settings.`
      );
    } else {
      vscode.window.showInformationMessage(
        `Save location changed to "${currentLocation}". Your prompts will be loaded from this location.`
      );
    }
  }

  /**
   * Create a system-specific configuration file in the current save location
   */
  async createSystemConfig(): Promise<void> {
    const saveLocation = this.getSaveLocation();
    const created = await this.configManager.createSystemConfigFile(
      saveLocation
    );

    if (created) {
      vscode.window.showInformationMessage(
        `Created system-specific config: ${path.basename(created)}`
      );
    } else {
      vscode.window.showErrorMessage(
        "Failed to create system-specific config file"
      );
    }
  }

  /**
   * Migrate prompts file from old location to new location (deprecated)
   */
  private async migratePromptsFile(
    oldPath: string,
    newPath: string,
    mode: "move" | "copy"
  ): Promise<void> {
    try {
      // Ensure new directory exists
      const newDir = path.dirname(newPath);
      this.ensureDirectoryExists(newDir);

      // Copy the file
      fs.copyFileSync(oldPath, newPath);

      // If move, delete the old file
      if (mode === "move") {
        fs.unlinkSync(oldPath);
        vscode.window.showInformationMessage(
          `Prompts moved successfully to ${newPath}`
        );
      } else {
        vscode.window.showInformationMessage(
          `Prompts copied successfully to ${newPath}`
        );
      }
    } catch (error) {
      console.error("Error migrating prompts file:", error);
      vscode.window.showErrorMessage(
        `Failed to ${mode} prompts file: ${error}`
      );
      throw error;
    }
  }
}
