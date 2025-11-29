import * as fs from 'fs/promises';
import * as path from 'path';
import { Category, Prompt, PromptData } from '../types';

/**
 * Service for converting prompts between JSON and Markdown formats
 * Handles syncing prompts as individual Markdown files organized by category
 */
export class MarkdownSyncService {
    /**
     * Convert prompts data to Markdown files in the repository
     * Creates a folder structure: prompts/{category}/{prompt-name}.md
     */
    async convertToMarkdown(data: PromptData, repoPath: string): Promise<void> {
        const promptsDir = path.join(repoPath, 'prompts');

        // Clean up existing prompts directory
        try {
            await fs.rm(promptsDir, { recursive: true, force: true });
        } catch (error) {
            // Directory might not exist, that's okay
        }

        // Create prompts directory
        await fs.mkdir(promptsDir, { recursive: true });

        // Create a map of categories for easy lookup
        const categoryMap = new Map<string, Category>();
        data.categories.forEach(cat => categoryMap.set(cat.id, cat));

        // Group prompts by category
        const promptsByCategory = new Map<string, Prompt[]>();
        data.prompts.forEach(prompt => {
            if (!promptsByCategory.has(prompt.categoryId)) {
                promptsByCategory.set(prompt.categoryId, []);
            }
            promptsByCategory.get(prompt.categoryId)!.push(prompt);
        });

        // Create Markdown files for each prompt
        for (const [categoryId, prompts] of promptsByCategory) {
            const category = categoryMap.get(categoryId);
            if (!category) {
                continue;
            }

            // Build category path (handle nested categories)
            const categoryPath = this.buildCategoryPath(category, categoryMap, promptsDir);
            await fs.mkdir(categoryPath, { recursive: true });

            // Create a markdown file for each prompt
            for (const prompt of prompts) {
                const fileName = this.sanitizeFileName(prompt.name) + '.md';
                const filePath = path.join(categoryPath, fileName);
                const content = this.createMarkdownContent(prompt, category);

                await fs.writeFile(filePath, content, 'utf-8');
            }
        }

        // Create an index file with category structure
        await this.createIndexFile(data, promptsDir);
    }

    /**
     * Convert Markdown files back to JSON format
     * Reads all .md files from prompts directory and reconstructs the data structure
     */
    async convertFromMarkdown(repoPath: string): Promise<PromptData> {
        const promptsDir = path.join(repoPath, 'prompts');

        // Check if prompts directory exists
        try {
            await fs.access(promptsDir);
        } catch (error) {
            // No prompts directory, return empty data
            return { categories: [], prompts: [] };
        }

        const categories: Category[] = [];
        const prompts: Prompt[] = [];
        const categoryMap = new Map<string, Category>();

        // Read the index file to get category structure
        const indexPath = path.join(promptsDir, 'INDEX.md');
        try {
            const indexContent = await fs.readFile(indexPath, 'utf-8');
            const parsedCategories = this.parseCategoriesFromIndex(indexContent);
            categories.push(...parsedCategories);
            parsedCategories.forEach(cat => categoryMap.set(cat.id, cat));
        } catch (error) {
            console.warn('Could not read INDEX.md, will scan directories');
        }

        // Recursively read all markdown files
        await this.readMarkdownFiles(promptsDir, prompts, categories, categoryMap);

        return { categories, prompts };
    }

    /**
     * Build the full path for a category, handling nested categories
     */
    private buildCategoryPath(
        category: Category,
        categoryMap: Map<string, Category>,
        baseDir: string
    ): string {
        const pathParts: string[] = [];
        let currentCategory: Category | undefined = category;

        // Build path from leaf to root
        while (currentCategory) {
            pathParts.unshift(this.sanitizeFileName(currentCategory.name));
            currentCategory = currentCategory.parentCategoryId
                ? categoryMap.get(currentCategory.parentCategoryId)
                : undefined;
        }

        return path.join(baseDir, ...pathParts);
    }

    /**
     * Create markdown content for a prompt
     */
    private createMarkdownContent(prompt: Prompt, category: Category): string {
        const lines: string[] = [];

        // Add frontmatter with metadata
        lines.push('---');
        lines.push(`id: ${prompt.id}`);
        lines.push(`name: ${prompt.name}`);
        lines.push(`category: ${category.name}`);
        lines.push(`categoryId: ${prompt.categoryId}`);
        lines.push(`order: ${prompt.order}`);

        if (prompt.icon) {
            lines.push(`icon:`);
            lines.push(`  type: ${prompt.icon.type}`);
            lines.push(`  value: ${prompt.icon.value}`);
        }

        lines.push('---');
        lines.push('');

        // Add the prompt content
        lines.push(`# ${prompt.name}`);
        lines.push('');
        lines.push(prompt.content);

        return lines.join('\n');
    }

    /**
     * Create an index file with the category structure
     */
    private async createIndexFile(data: PromptData, promptsDir: string): Promise<void> {
        const lines: string[] = [];

        lines.push('# Prompts Index');
        lines.push('');
        lines.push('This file contains the category structure and metadata for your prompts.');
        lines.push('');
        lines.push('## Categories');
        lines.push('');

        // Add category metadata in YAML format
        lines.push('```yaml');
        lines.push('categories:');

        for (const category of data.categories) {
            lines.push(`  - id: ${category.id}`);
            lines.push(`    name: ${category.name}`);
            lines.push(`    order: ${category.order}`);

            if (category.parentCategoryId) {
                lines.push(`    parentCategoryId: ${category.parentCategoryId}`);
            }

            if (category.icon) {
                lines.push(`    icon:`);
                lines.push(`      type: ${category.icon.type}`);
                lines.push(`      value: ${category.icon.value}`);
            }
        }

        lines.push('```');
        lines.push('');
        lines.push('## Directory Structure');
        lines.push('');

        // Create a visual tree of the directory structure
        const tree = this.buildCategoryTree(data);
        lines.push(tree);

        await fs.writeFile(path.join(promptsDir, 'INDEX.md'), lines.join('\n'), 'utf-8');
    }

    /**
     * Build a visual tree of categories and prompts
     */
    private buildCategoryTree(data: PromptData): string {
        const lines: string[] = [];
        const categoryMap = new Map<string, Category>();
        data.categories.forEach(cat => categoryMap.set(cat.id, cat));

        const rootCategories = data.categories.filter(c => !c.parentCategoryId);

        for (const category of rootCategories) {
            this.addCategoryToTree(category, data, categoryMap, lines, 0);
        }

        return lines.join('\n');
    }

    /**
     * Recursively add category and its children to the tree
     */
    private addCategoryToTree(
        category: Category,
        data: PromptData,
        categoryMap: Map<string, Category>,
        lines: string[],
        depth: number
    ): void {
        const indent = '  '.repeat(depth);
        const icon = category.icon?.type === 'emoji' ? category.icon.value : '📁';
        lines.push(`${indent}- ${icon} **${category.name}**`);

        // Add prompts in this category
        const prompts = data.prompts.filter(p => p.categoryId === category.id);
        for (const prompt of prompts) {
            const promptIcon = prompt.icon?.type === 'emoji' ? prompt.icon.value : '📄';
            lines.push(`${indent}  - ${promptIcon} ${prompt.name}`);
        }

        // Add subcategories
        const subcategories = data.categories.filter(c => c.parentCategoryId === category.id);
        for (const subcat of subcategories) {
            this.addCategoryToTree(subcat, data, categoryMap, lines, depth + 1);
        }
    }

    /**
     * Parse categories from INDEX.md file
     */
    private parseCategoriesFromIndex(content: string): Category[] {
        const categories: Category[] = [];

        // Extract YAML block
        const yamlMatch = content.match(/```yaml\n([\s\S]*?)\n```/);
        if (!yamlMatch) {
            return categories;
        }

        const yamlContent = yamlMatch[1];
        const lines = yamlContent.split('\n');

        let currentCategory: Partial<Category> | null = null;

        for (const line of lines) {
            const trimmed = line.trim();

            if (trimmed.startsWith('- id:')) {
                if (currentCategory && currentCategory.id) {
                    categories.push(currentCategory as Category);
                }
                currentCategory = { id: trimmed.substring(5).trim() };
            } else if (currentCategory) {
                if (trimmed.startsWith('name:')) {
                    currentCategory.name = trimmed.substring(5).trim();
                } else if (trimmed.startsWith('order:')) {
                    currentCategory.order = parseInt(trimmed.substring(6).trim());
                } else if (trimmed.startsWith('parentCategoryId:')) {
                    currentCategory.parentCategoryId = trimmed.substring(17).trim();
                } else if (trimmed.startsWith('type:') && line.includes('icon:')) {
                    // Icon type
                    if (!currentCategory.icon) {
                        currentCategory.icon = { type: 'emoji', value: '' };
                    }
                    currentCategory.icon.type = trimmed.substring(5).trim() as any;
                } else if (trimmed.startsWith('value:') && currentCategory.icon) {
                    currentCategory.icon.value = trimmed.substring(6).trim();
                }
            }
        }

        if (currentCategory && currentCategory.id) {
            categories.push(currentCategory as Category);
        }

        return categories;
    }

    /**
     * Recursively read markdown files from directory
     */
    private async readMarkdownFiles(
        dir: string,
        prompts: Prompt[],
        categories: Category[],
        categoryMap: Map<string, Category>,
        parentCategoryId?: string
    ): Promise<void> {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
                // This is a category directory
                let category = Array.from(categoryMap.values()).find(
                    c => this.sanitizeFileName(c.name) === entry.name && c.parentCategoryId === parentCategoryId
                );

                if (!category) {
                    // Create category if not found in index
                    category = {
                        id: `cat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        name: entry.name,
                        order: categories.length,
                        parentCategoryId
                    };
                    categories.push(category);
                    categoryMap.set(category.id, category);
                }

                // Recursively read subdirectory
                await this.readMarkdownFiles(fullPath, prompts, categories, categoryMap, category.id);
            } else if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'INDEX.md') {
                // This is a prompt file
                const content = await fs.readFile(fullPath, 'utf-8');
                const prompt = this.parseMarkdownPrompt(content, parentCategoryId || '');

                if (prompt) {
                    prompts.push(prompt);
                }
            }
        }
    }

    /**
     * Parse a markdown file to extract prompt data
     */
    private parseMarkdownPrompt(content: string, defaultCategoryId: string): Prompt | null {
        // Extract frontmatter
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (!frontmatterMatch) {
            return null;
        }

        const frontmatter = frontmatterMatch[1];
        const bodyContent = content.substring(frontmatterMatch[0].length).trim();

        // Remove the heading from body content
        const contentWithoutHeading = bodyContent.replace(/^#\s+.*\n\n/, '');

        // Parse frontmatter
        const metadata: any = {};
        const lines = frontmatter.split('\n');
        let currentKey = '';

        for (const line of lines) {
            const trimmed = line.trim();

            if (trimmed.includes(':') && !line.startsWith(' ')) {
                const [key, ...valueParts] = trimmed.split(':');
                currentKey = key.trim();
                const value = valueParts.join(':').trim();

                if (value) {
                    metadata[currentKey] = value;
                } else if (currentKey === 'icon') {
                    metadata[currentKey] = {};
                }
            } else if (currentKey === 'icon' && trimmed.includes(':')) {
                const [key, ...valueParts] = trimmed.split(':');
                metadata.icon[key.trim()] = valueParts.join(':').trim();
            }
        }

        return {
            id: metadata.id || `prompt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: metadata.name || 'Untitled',
            content: contentWithoutHeading,
            categoryId: metadata.categoryId || defaultCategoryId,
            order: parseInt(metadata.order) || 0,
            icon: metadata.icon
        };
    }

    /**
     * Sanitize a file/folder name to be filesystem-safe
     */
    private sanitizeFileName(name: string): string {
        return name
            .replace(/[<>:"/\\|?*]/g, '-')  // Replace invalid characters
            .replace(/\s+/g, '-')            // Replace spaces with hyphens
            .replace(/-+/g, '-')             // Replace multiple hyphens with single
            .replace(/^-|-$/g, '')           // Remove leading/trailing hyphens
            .toLowerCase();
    }
}

