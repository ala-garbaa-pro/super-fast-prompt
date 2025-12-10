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

### Package Your Extension

```bash
# Build the extension
bun run package

# Create a .vsix package
vsce package

# This creates: super-fast-prompts-0.0.1.vsix
```
