import * as vscode from 'vscode';
import { IconConfig } from '../types';

/**
 * Common theme icons for categories
 */
export const CATEGORY_THEME_ICONS = [
  'folder',
  'folder-opened',
  'file-directory',
  'archive',
  'briefcase',
  'package',
  'project',
  'repo',
  'organization',
  'layers',
  'symbol-namespace',
  'symbol-class',
  'symbol-module',
  'symbol-folder',
  'home',
  'gear',
  'tools',
  'rocket',
  'star',
  'heart',
  'bookmark',
  'tag',
  'shield',
  'lock',
  'key'
];

/**
 * Common theme icons for prompts
 */
export const PROMPT_THEME_ICONS = [
  'file-text',
  'file',
  'file-code',
  'note',
  'notebook',
  'book',
  'symbol-file',
  'symbol-text',
  'symbol-string',
  'comment',
  'quote',
  'code',
  'terminal',
  'console',
  'lightbulb',
  'info',
  'question',
  'checklist',
  'tasklist',
  'list-unordered',
  'list-ordered',
  'edit',
  'pencil',
  'wand',
  'sparkle'
];

/**
 * Colored circle emoji for visual categorization
 */
export const COLORED_CIRCLES = [
  { emoji: '🔴', name: 'Red', description: 'Red category' },
  { emoji: '🟢', name: 'Green', description: 'Green category' },
  { emoji: '🔵', name: 'Blue', description: 'Blue category' },
  { emoji: '🟡', name: 'Yellow', description: 'Yellow category' },
  { emoji: '🟣', name: 'Purple', description: 'Purple category' },
  { emoji: '🟠', name: 'Orange', description: 'Orange category' },
  { emoji: '🟤', name: 'Brown', description: 'Brown category' },
  { emoji: '⚫', name: 'Black', description: 'Black category' },
  { emoji: '⚪', name: 'White', description: 'White category' }
];

/**
 * Common emoji icons for categories
 */
export const CATEGORY_EMOJIS = [
  '📁', '📂', '🗂️', '📋', '📊', '📈',
  '💼', '🎯', '🚀', '⭐', '❤️', '💡',
  '🔧', '⚙️', '🛠️', '🔑', '🔒', '🛡️',
  '🏠', '🏢', '🏭', '🎨', '🎭', '🎪',
  '📦', '📮', '📬', '🗃️', '🗄️', '📚'
];

/**
 * Common emoji icons for prompts
 */
export const PROMPT_EMOJIS = [
  '📄', '📝', '📃', '📋', '📑', '📜',
  '💡', '💭', '💬', '🗨️', '🗯️', '💫',
  '✨', '⚡', '🔥', '🌟', '⭐', '🎯',
  '✅', '✔️', '☑️', '📌', '📍', '🔖',
  '🎨', '🖊️', '✏️', '🖍️', '🖌️', '📐'
];

/**
 * Show icon picker dialog
 * Returns:
 * - IconConfig if user selected an icon
 * - null if user wants to remove the icon
 * - undefined if user cancelled
 */
export async function showIconPicker(
  currentIcon: IconConfig | undefined,
  isCategory: boolean,
  repoRoot?: string
): Promise<IconConfig | null | undefined> {
  const quickPick = vscode.window.createQuickPick();
  quickPick.title = isCategory ? 'Select Category Icon' : 'Select Prompt Icon';
  quickPick.placeholder = 'Choose an icon type';
  quickPick.canSelectMany = false;

  const items = [
    {
      label: '$(trash) Remove Icon',
      description: 'Use default icon',
      detail: 'Remove custom icon',
      type: 'remove'
    },
    {
      label: '$(symbol-color) Theme Icons',
      description: 'VS Code built-in icons',
      detail: 'Choose from VS Code theme icons',
      type: 'themeIcon'
    },
    {
      label: '$(smiley) Emoji',
      description: 'Use emoji as icon',
      detail: 'Choose from emoji collection',
      type: 'emoji'
    },
    {
      label: '$(file-media) Custom Image',
      description: 'Use your own image file',
      detail: 'Select a .png or .jpg file',
      type: 'file'
    }
  ];

  quickPick.items = items;

  return new Promise((resolve) => {
    let isResolved = false;

    quickPick.onDidAccept(async () => {
      const selected = quickPick.selectedItems[0];
      if (!selected || isResolved) {
        return;
      }

      const type = (selected as any).type;

      // Don't dispose yet - we need to keep the event handlers active
      // until the async operations complete
      isResolved = true;
      quickPick.hide();

      if (type === 'remove') {
        quickPick.dispose();
        resolve(null); // null means "remove icon"
        return;
      }

      try {
        if (type === 'themeIcon') {
          const icon = await showThemeIconPicker(isCategory);
          const result: IconConfig | undefined = icon ? { type: 'themeIcon' as const, value: icon } : undefined;
          quickPick.dispose();
          resolve(result);
        } else if (type === 'emoji') {
          const emoji = await showEmojiPicker(isCategory);
          const result: IconConfig | undefined = emoji ? { type: 'emoji' as const, value: emoji } : undefined;
          quickPick.dispose();
          resolve(result);
        } else if (type === 'file') {
          const filePath = await showImageFilePicker(repoRoot);
          const result: IconConfig | undefined = filePath ? { type: 'file' as const, value: filePath } : undefined;
          quickPick.dispose();
          resolve(result);
        } else {
          quickPick.dispose();
          resolve(undefined);
        }
      } catch (error) {
        console.error('Error in icon picker:', error);
        quickPick.dispose();
        resolve(undefined);
      }
    });

    quickPick.onDidHide(() => {
      if (!isResolved) {
        quickPick.dispose();
        isResolved = true;
        resolve(undefined);
      }
    });

    quickPick.show();
  });
}

/**
 * Show theme icon picker
 */
async function showThemeIconPicker(isCategory: boolean): Promise<string | undefined> {
  const icons = isCategory ? CATEGORY_THEME_ICONS : PROMPT_THEME_ICONS;

  const items = icons.map(icon => ({
    label: `$(${icon}) ${icon}`,
    description: icon,
    iconName: icon
  }));

  const selected = await vscode.window.showQuickPick(items, {
    title: 'Select Theme Icon',
    placeHolder: 'Choose a VS Code theme icon',
    ignoreFocusOut: true
  });

  return selected ? (selected as any).iconName : undefined;
}

/**
 * Show emoji picker
 */
async function showEmojiPicker(isCategory: boolean): Promise<string | undefined> {
  const items: any[] = [];

  // Add colored circles section (always show for both categories and prompts)
  items.push({
    label: '$(symbol-color) Colored Circles',
    description: 'Visual color coding',
    kind: vscode.QuickPickItemKind.Separator
  });

  COLORED_CIRCLES.forEach(circle => {
    items.push({
      label: `${circle.emoji}  ${circle.name}`,
      description: circle.description,
      emoji: circle.emoji
    });
  });

  // Add separator
  items.push({
    label: isCategory ? '$(folder) Category Icons' : '$(file-text) Prompt Icons',
    description: 'Common icons',
    kind: vscode.QuickPickItemKind.Separator
  });

  // Add category or prompt specific emojis
  const emojis = isCategory ? CATEGORY_EMOJIS : PROMPT_EMOJIS;
  emojis.forEach(emoji => {
    items.push({
      label: `${emoji}  ${emoji}`,
      description: 'Emoji icon',
      emoji: emoji
    });
  });

  // Add separator
  items.push({
    label: '$(edit) Custom',
    description: '',
    kind: vscode.QuickPickItemKind.Separator
  });

  // Add custom emoji option
  items.push({
    label: '$(edit) Custom Emoji',
    description: 'Enter any emoji',
    emoji: 'CUSTOM'
  });

  const selected = await vscode.window.showQuickPick(items, {
    title: 'Select Emoji Icon',
    placeHolder: 'Choose an emoji icon',
    ignoreFocusOut: true
  });

  if (!selected) {
    return undefined;
  }

  // Skip if separator was somehow selected
  if ((selected as any).kind === vscode.QuickPickItemKind.Separator) {
    return undefined;
  }

  if ((selected as any).emoji === 'CUSTOM') {
    return await vscode.window.showInputBox({
      prompt: 'Enter an emoji (e.g., 🚀)',
      placeHolder: '🚀',
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value) {
          return 'Emoji cannot be empty';
        }
        // Basic emoji validation (check if it contains emoji-like characters)
        const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
        if (!emojiRegex.test(value)) {
          return 'Please enter a valid emoji';
        }
        return null;
      }
    });
  }

  return (selected as any).emoji;
}

/**
 * Show image file picker
 */
async function showImageFilePicker(repoRoot?: string): Promise<string | undefined> {
  const result = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false,
    filters: {
      'Images': ['png', 'jpg', 'jpeg']
    },
    title: 'Select Icon Image'
  });

  if (result && result.length > 0) {
    const selectedFile = result[0].fsPath;

    // If repoRoot is provided, copy the file to the repo
    if (repoRoot) {
      try {
        const path = require('path');
        const fs = require('fs');

        // Create icons directory if it doesn't exist
        const iconsDir = path.join(repoRoot, 'icons');
        if (!fs.existsSync(iconsDir)) {
          fs.mkdirSync(iconsDir, { recursive: true });
        }

        // Generate a unique filename to avoid collisions
        const ext = path.extname(selectedFile);
        const fileName = `${Date.now()}_${path.basename(selectedFile)}`;
        const destPath = path.join(iconsDir, fileName);

        // Copy the file
        fs.copyFileSync(selectedFile, destPath);

        // Return relative path
        return `icons/${fileName}`;
      } catch (error) {
        console.error('Error copying icon file:', error);
        vscode.window.showErrorMessage(`Failed to copy icon file: ${error}`);
        // Fallback to absolute path if copy fails
        return selectedFile;
      }
    }

    return selectedFile;
  }

  return undefined;
}

