/**
 * Icon configuration for categories and prompts
 */
export interface IconConfig {
  type: 'themeIcon' | 'emoji' | 'file';
  value: string; // ThemeIcon name, emoji character, or file path
}

export interface Category {
  id: string;
  name: string;
  order: number;
  parentCategoryId?: string; // Optional: if set, this is a subcategory
  icon?: IconConfig; // Optional: custom icon configuration (use colored circle emoji for color coding)
}

export interface Prompt {
  id: string;
  name: string;
  content: string;
  categoryId: string;
  order: number;
  icon?: IconConfig; // Optional: custom icon configuration (use colored circle emoji for color coding)
}

export interface PromptData {
  categories: Category[];
  prompts: Prompt[];
}

/**
 * Metadata stored in [filename].metadata.json for each prompt
 */
export interface PromptMetadata {
  id: string;
  name: string;
  categoryId: string;
  order: number;
  icon?: IconConfig;
  fileName: string; // The .md file name (without path)
}

/**
 * Metadata stored in metadata.json for each category folder
 */
export interface CategoryMetadata {
  id: string;
  name: string;
  order: number;
  parentCategoryId?: string;
  icon?: IconConfig;
  prompts: PromptMetadata[]; // List of prompts in this category
  subcategories: string[]; // List of subcategory folder names
}

/**
 * Settings for the extension
 */
export interface ExtensionSettings {
  version: string;
  lastSync?: string;
  syncEnabled?: boolean;
}
