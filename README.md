<div align="center">
  <img src="logo.png" alt="Super Fast Prompts Logo" width="128" height="128">

# Super Fast Prompts

[![Version](https://img.shields.io/visual-studio-marketplace/v/AlaGARBAA.super-fast-prompts?style=flat-square&label=Version)](https://marketplace.visualstudio.com/items?itemName=AlaGARBAA.super-fast-prompts)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/AlaGARBAA.super-fast-prompts?style=flat-square&label=Installs)](https://marketplace.visualstudio.com/items?itemName=AlaGARBAA.super-fast-prompts)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/AlaGARBAA.super-fast-prompts?style=flat-square&label=Rating)](https://marketplace.visualstudio.com/items?itemName=AlaGARBAA.super-fast-prompts)
[![License](https://img.shields.io/github/license/ala-garbaa-pro/super-fast-prompt?style=flat-square&label=License)](LICENSE)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.104.0+-blue?style=flat-square)](https://code.visualstudio.com/)

**A powerful VS Code extension for managing categorized prompts with GitHub sync, Markdown editing, and quick clipboard access.**

</div>

---

## Table of Contents

- [Features](#features)
- [Screenshots](#screenshots)
- [Getting Started](#getting-started)
- [Commands](#commands)
- [Extension Settings](#extension-settings)
- [GitHub Sync](#github-sync)
- [Markdown Editor](#markdown-editor)
- [Development](#development)
- [Publishing to Marketplace](#publishing-to-marketplace)
- [Release Notes](#release-notes)
- [License](#license)

## Features

- **Sidebar View**: Browse prompts and categories in a dedicated sidebar panel with a rocket icon
- **Markdown Editor**: Create and edit prompts using VS Code's full-featured Markdown editor with syntax highlighting, preview, and IntelliSense
- **Nested Categories**: Create subcategories inside categories for hierarchical organization
- **Drag and Drop**: Reorder categories and prompts, or drag categories into other categories
- **Arrow Buttons**: Use ⬆️⬇️ buttons to reorder items precisely (keyboard-accessible alternative to drag-and-drop)
- **Customization**: Personalize categories and prompts with custom colors and icons (theme icons, emoji, or custom images)
- **Category Management**: Organize prompts into categories (e.g., Work, Personal, Code Reviews)
- **Prompt Management**: Create, edit, delete, and organize prompts
- **Quick Copy**: Click any prompt in the sidebar to copy it to clipboard instantly
- **Context Menus**: Right-click on prompts and categories for quick actions
- **Export**: Export prompts to files organized by category
- **Configurable Storage**: Set your preferred save location (default: `~/super-fast-prompts/private`)
- **GitHub Sync**: Sync prompts to GitHub as individual Markdown files for easy viewing and editing
- **Markdown Format**: Prompts are synced as readable Markdown files organized by category folders

## Screenshots

> **Note**: Add screenshots of your extension in action here. Recommended screenshots:
>
> - Main sidebar view showing categories and prompts
> - Markdown editor with a prompt being edited
> - Context menu showing available actions
> - GitHub sync in action

<!--
Example:
![Sidebar View](screenshots/sidebar.png)
![Markdown Editor](screenshots/editor.png)
![GitHub Sync](screenshots/sync.png)
-->

## Getting Started

### Installation

1. Install the extension from the VS Code marketplace
2. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac) to open the command palette
3. Type "Super Fast Prompts" to see available commands

### First Steps

1. **Open the Sidebar**:

   - Look for the 🚀 rocket icon in the Activity Bar (left side of VS Code)
   - Click it to open the Super Fast Prompts sidebar

2. **Configure Save Location** (Optional):

   - Click the ⚙️ (settings) icon in the sidebar toolbar
   - Or run command: `Super Fast Prompts: Open Settings`
   - Set `superFastPrompts.saveLocation` to your preferred path
   - Default is `~/super-fast-prompts/private`

3. **Create a Category**:

   - Click the "+" icon in the sidebar toolbar
   - Or run command: `Super Fast Prompts: Create Category`
   - Enter a category name (e.g., "Work", "Personal", "Code Reviews")

4. **Create a Prompt**:

   - Click the "+" icon in the sidebar toolbar
   - Or run command: `Super Fast Prompts: Create Prompt`
   - Select a category
   - Enter prompt name (e.g., "Code Review Template")
   - **File is created immediately** as `Code_Review_Template.md` in the category folder
   - VS Code's Markdown editor opens with the actual file
   - Edit your prompt with full Markdown support
   - Save (Ctrl+S) and close when done!

5. **Use Your Prompts**:
   - **Sidebar**: Click any prompt to copy it to clipboard instantly
   - **Command Palette**: Run `Super Fast Prompts: View Prompts`
   - **Right-click**: Right-click prompts for edit, delete, export options
   - **Drag and Drop**: Drag prompts and categories to reorder or move them
   - **Arrow Buttons**: Hover over items and use ⬆️⬇️ buttons for precise reordering
   - Paste anywhere you need it!

## Commands

All commands are available via the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`):

- `Super Fast Prompts: Open Settings` - Configure extension settings
- `Super Fast Prompts: Create Category` - Create a new category
- `Super Fast Prompts: Create Prompt` - Create a new prompt
- `Super Fast Prompts: View Prompts` - View and copy prompts to clipboard
- `Super Fast Prompts: Copy Prompt to Clipboard` - Quick copy a prompt
- `Super Fast Prompts: Edit Prompt` - Edit an existing prompt
- `Super Fast Prompts: Delete Prompt` - Delete a prompt
- `Super Fast Prompts: Export Prompt to File` - Export a prompt to a file

## Extension Settings

This extension contributes the following settings:

- `superFastPrompts.saveLocation`: Default location to save prompts. Use `~` for home directory. (Default: `~/super-fast-prompts/private`)

## Data Storage

Prompts are stored in a JSON file (`prompts.json`) in your configured save location. The structure is:

```json
{
  "categories": [
    {
      "id": "uuid",
      "name": "Category Name"
    }
  ],
  "prompts": [
    {
      "id": "uuid",
      "name": "Prompt Name",
      "content": "Prompt content...",
      "categoryId": "category-uuid"
    }
  ]
}
```

## GitHub Sync

Super Fast Prompts includes built-in GitHub sync that stores your prompts as **individual Markdown files** for easy viewing and editing on GitHub.

### Quick Setup

1. Run command: `Super Fast Prompts: Setup GitHub Sync`
2. Enter your GitHub repository URL (e.g., `https://github.com/username/my-prompts.git`)
3. Choose a local path for the repository
4. Select sync mode (manual, automatic, or on-save)
5. Authenticate with GitHub when prompted

### Sync Modes

- **Manual**: Sync when you run `Super Fast Prompts: Sync Now`
- **Automatic**: Sync at regular intervals (configurable)
- **On-Save**: Sync whenever prompts are modified

### Markdown Format

Your prompts are synced as Markdown files organized by category:

```
your-repo/
├── README.md
├── settings.json
└── prompts/
    ├── INDEX.md
    ├── work/
    │   ├── bug-report.md
    │   └── code-reviews/
    │       └── template.md
    └── personal/
        └── shopping-list.md
```

Each prompt file contains:

- **Frontmatter** (YAML metadata): ID, name, category, icon, etc.
- **Content**: The actual prompt text in Markdown format

### Benefits

- ✅ View and edit prompts directly on GitHub
- ✅ Track changes with Git history
- ✅ Share prompts with team members
- ✅ Human-readable Markdown format
- ✅ Organized folder structure

For detailed information, see [MARKDOWN_SYNC_GUIDE.md](MARKDOWN_SYNC_GUIDE.md)

## Markdown Editor

When creating or editing prompts, the extension opens VS Code's full-featured Markdown editor instead of a simple input box.

### Features

- **Syntax Highlighting** - Color-coded Markdown syntax
- **Live Preview** - Press `Ctrl+K V` for side-by-side preview
- **IntelliSense** - Auto-completion for Markdown syntax
- **Multi-line Editing** - Edit long prompts comfortably
- **Search & Replace** - Find and replace within your prompt
- **Full Undo/Redo** - Complete editing history

### Usage

1. When creating a prompt, you enter a filename first
2. A real `.md` file is created in the category folder
3. VS Code's Markdown editor opens with the actual file
4. Write your prompt using Markdown syntax (headers, lists, code blocks, etc.)
5. **Save (Ctrl+S)** to save changes
6. **Close the editor** when done
7. Prompts are saved both in `prompts.json` and as individual `.md` files in category folders

### Example Prompt

```markdown
# Code Review Checklist

## Functionality

- [ ] Code works as expected
- [ ] Edge cases are handled

## Code Quality

- [ ] Follows coding standards
- [ ] No code duplication

## Testing

- [ ] Unit tests included
- [ ] All tests pass
```

For detailed information and examples, see [MARKDOWN_EDITOR_GUIDE.md](MARKDOWN_EDITOR_GUIDE.md)

## Development

To run the extension in development mode:

```bash
# Install dependencies
bun install

# Compile the extension
bun run compile

# Watch for changes
bun run watch

# Press F5 in VS Code to launch the extension in debug mode
```

## Publishing to Marketplace

See the [Publishing Guide](#how-to-publish-to-vs-code-marketplace) section at the end of this README for complete instructions on publishing this extension to the VS Code marketplace.

## Release Notes

### 0.0.1

Initial release of Super Fast Prompts:

- Category management
- Prompt creation, editing, and deletion
- Copy to clipboard functionality
- Export to file
- Configurable save location

## License

MIT

---

## How to Publish to VS Code Marketplace

Follow these steps to publish your extension to the VS Code Marketplace:

### Prerequisites

1. **Create a Microsoft/Azure Account**

   - Go to [Azure DevOps](https://dev.azure.com)
   - Sign in or create a Microsoft account

2. **Create a Publisher**

   - Go to [Visual Studio Marketplace Publisher Management](https://marketplace.visualstudio.com/manage)
   - Click "Create Publisher"
   - Choose a unique Publisher ID (this will be in your extension URL)
   - Fill in your display name and description

3. **Create a Personal Access Token (PAT)**
   - Go to [Azure DevOps](https://dev.azure.com)
   - Click on User Settings (top right) → Personal Access Tokens
   - Click "New Token"
   - Give it a name (e.g., "VS Code Extensions")
   - Set Organization to "All accessible organizations"
   - Set Expiration (recommend 90 days or custom)
   - Under Scopes, select **"Marketplace" → "Manage"**
   - Click "Create" and **COPY THE TOKEN** (you won't see it again!)

### Update Your Extension Files

1. **Update `package.json`**

   - Replace `AlaGARBAA` with your actual Publisher ID (from step 2)
   - Replace `ala-garbaa-pro` with your GitHub username
   - Replace `YOUR_NAME` with your name

2. **Update `README.md`**

   - Replace `AlaGARBAA` with your actual Publisher ID
   - Replace `ala-garbaa-pro` with your GitHub username
   - Add screenshots to the Screenshots section (optional but recommended)

3. **Create a LICENSE file** (if not already created)
   ```bash
   # Create MIT license file
   echo "MIT License..." > LICENSE
   ```

### Install vsce (Visual Studio Code Extensions)

```bash
# Using npm
npm install -g @vscode/vsce

# Or using bun
bun add -g @vscode/vsce

# Or using bun
bun add -g @vscode/vsce
```

### Package Your Extension

```bash
# Build the extension
bun run package

# Create a .vsix package
vsce package

# This creates: super-fast-prompts-0.0.1.vsix
```

### Login to the Marketplace

```bash
# Login using your PAT
vsce login AlaGARBAA

# When prompted, paste your Personal Access Token
```

### Publish Your Extension

```bash
# Publish to marketplace
vsce publish

# Or publish a specific version
vsce publish minor  # 0.0.1 -> 0.1.0
vsce publish major  # 0.0.1 -> 1.0.0
vsce publish patch  # 0.0.1 -> 0.0.2

# Or publish with a specific version
vsce publish 1.0.0
```

### Update Your Extension

When you make changes:

```bash
# Update version in package.json, then:
bun run package
vsce publish
```

### Useful Commands

```bash
# Test package locally before publishing
vsce package

# Install the .vsix file locally to test
code --install-extension super-fast-prompts-0.0.1.vsix

# Unpublish an extension (use with caution!)
vsce unpublish AlaGARBAA.super-fast-prompts

# Show extension info
vsce show AlaGARBAA.super-fast-prompts

# List all published extensions
vsce ls AlaGARBAA
```

### Best Practices

1. **Test Locally First**

   - Always test your extension locally before publishing
   - Use `vsce package` to create a .vsix and install it
   - Press F5 in VS Code to test in Extension Development Host

2. **Version Management**

   - Follow [Semantic Versioning](https://semver.org/)
   - MAJOR.MINOR.PATCH (e.g., 1.2.3)
   - Update CHANGELOG.md with each release

3. **Quality Checklist**

   - Add screenshots and GIFs to README
   - Write clear documentation
   - Include a CHANGELOG.md file
   - Add a good extension icon (128x128 PNG or SVG)
   - Test on Windows, macOS, and Linux if possible
   - Add keywords for better discoverability

4. **GitHub Integration**
   - Set up GitHub repository URL in package.json
   - Add badges to README (version, installs, rating)
   - Enable GitHub Issues for bug reports

### Troubleshooting

**Error: "Permission denied"**

- Make sure your PAT has "Marketplace (Manage)" scope
- Try logging in again: `vsce login AlaGARBAA`

**Error: "Publisher not found"**

- Verify your Publisher ID is correct
- Make sure you created a publisher at marketplace.visualstudio.com/manage

**Error: "Icon must be a PNG or SVG"**

- Convert your logo to PNG (128x128) or use SVG
- Update the `icon` field in package.json

**Extension not appearing in marketplace**

- It can take a few minutes to appear after publishing
- Check your publisher dashboard: marketplace.visualstudio.com/manage

### Marketplace Dashboard

After publishing, manage your extension at:

- [Publisher Management](https://marketplace.visualstudio.com/manage)
- View installs, ratings, and reviews
- Update extension details
- Unpublish or update extensions

---

**Enjoy organizing your prompts!**
