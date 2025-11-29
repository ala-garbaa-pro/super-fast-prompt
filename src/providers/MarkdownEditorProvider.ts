import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Result of the Markdown editor operation
 */
export interface MarkdownEditorResult {
  /** Whether the user saved the content (true) or cancelled (false) */
  saved: boolean;
  /** The edited content (only valid if saved is true) */
  content?: string;
}

/**
 * Opens a Markdown editor for editing prompt content
 * 
 * @param promptName - The name of the prompt being edited (for display purposes)
 * @param initialContent - The initial content to display in the editor
 * @returns Promise that resolves with the result (saved/cancelled and content)
 */
export async function openMarkdownEditor(
  promptName: string,
  initialContent: string
): Promise<MarkdownEditorResult> {
  // Create a unique URI for the untitled document
  const uri = vscode.Uri.parse(`untitled:${promptName}.md`);

  try {
    // Create a new text document with Markdown language
    const document = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: initialContent
    });

    // Show the document in an editor
    const editor = await vscode.window.showTextDocument(document, {
      preview: false,
      viewColumn: vscode.ViewColumn.Active
    });

    // Show information message with instructions
    const saveButton = 'Save & Close';
    const cancelButton = 'Cancel';
    
    const choice = await vscode.window.showInformationMessage(
      `Editing prompt: "${promptName}". Make your changes, then click "Save & Close" or close the editor to cancel.`,
      { modal: false },
      saveButton,
      cancelButton
    );

    // If user clicked Save & Close immediately
    if (choice === saveButton) {
      const content = document.getText();
      // Close the editor
      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
      return { saved: true, content };
    }

    // If user clicked Cancel immediately
    if (choice === cancelButton) {
      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
      return { saved: false };
    }

    // Wait for the user to close the editor or save
    return await waitForEditorClose(document, editor);

  } catch (error) {
    vscode.window.showErrorMessage(`Failed to open Markdown editor: ${error}`);
    return { saved: false };
  }
}

/**
 * Wait for the editor to be closed and determine if content should be saved
 */
async function waitForEditorClose(
  document: vscode.TextDocument,
  editor: vscode.TextEditor
): Promise<MarkdownEditorResult> {
  return new Promise((resolve) => {
    let isResolved = false;

    // Track if document is dirty (modified)
    let isDirty = false;

    // Listen for text document changes
    const changeDisposable = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document === document) {
        isDirty = true;
      }
    });

    // Listen for document close
    const closeDisposable = vscode.workspace.onDidCloseTextDocument((closedDoc) => {
      if (closedDoc === document && !isResolved) {
        isResolved = true;
        changeDisposable.dispose();
        closeDisposable.dispose();

        // If the document was modified, ask if user wants to save
        if (isDirty) {
          vscode.window.showQuickPick(
            ['Save Changes', 'Discard Changes'],
            {
              placeHolder: 'The prompt content was modified. Do you want to save the changes?',
              ignoreFocusOut: true
            }
          ).then((choice) => {
            if (choice === 'Save Changes') {
              resolve({ saved: true, content: document.getText() });
            } else {
              resolve({ saved: false });
            }
          });
        } else {
          // No changes made, treat as cancel
          resolve({ saved: false });
        }
      }
    });

    // Also listen for visible text editors change (in case editor is closed)
    const visibleEditorsDisposable = vscode.window.onDidChangeVisibleTextEditors((editors) => {
      // Check if our editor is still visible
      const isStillVisible = editors.some(e => e.document === document);
      
      if (!isStillVisible && !isResolved) {
        // Editor was closed
        isResolved = true;
        changeDisposable.dispose();
        closeDisposable.dispose();
        visibleEditorsDisposable.dispose();

        // If the document was modified, ask if user wants to save
        if (isDirty) {
          vscode.window.showQuickPick(
            ['Save Changes', 'Discard Changes'],
            {
              placeHolder: 'The prompt content was modified. Do you want to save the changes?',
              ignoreFocusOut: true
            }
          ).then((choice) => {
            if (choice === 'Save Changes') {
              resolve({ saved: true, content: document.getText() });
            } else {
              resolve({ saved: false });
            }
          });
        } else {
          // No changes made, treat as cancel
          resolve({ saved: false });
        }
      }
    });
  });
}

/**
 * Opens a Markdown editor with auto-save on close
 * This version automatically saves when the editor is closed
 *
 * @param promptName - The name of the prompt being edited
 * @param initialContent - The initial content to display in the editor
 * @returns Promise that resolves with the result (saved/cancelled and content)
 */
export async function openMarkdownEditorSimple(
  promptName: string,
  initialContent: string
): Promise<MarkdownEditorResult> {
  try {
    // Create a new text document with Markdown language
    const document = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: initialContent
    });

    // Show the document in an editor
    await vscode.window.showTextDocument(document, {
      preview: false,
      viewColumn: vscode.ViewColumn.Active
    });

    // Show a non-modal notification
    vscode.window.showInformationMessage(
      `Editing: "${promptName}". Close the editor when done - changes will be saved automatically.`
    );

    // Wait for the editor to be closed
    return await waitForEditorCloseAutoSave(document);

  } catch (error) {
    vscode.window.showErrorMessage(`Failed to open Markdown editor: ${error}`);
    return { saved: false };
  }
}

/**
 * Wait for the editor to be closed and auto-save the content
 */
async function waitForEditorCloseAutoSave(
  document: vscode.TextDocument
): Promise<MarkdownEditorResult> {
  return new Promise((resolve) => {
    let isResolved = false;
    let hasChanges = false;

    // Listen for text document changes
    const changeDisposable = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document === document) {
        hasChanges = true;
      }
    });

    // Listen for document close
    const closeDisposable = vscode.workspace.onDidCloseTextDocument((closedDoc) => {
      if (closedDoc === document && !isResolved) {
        isResolved = true;
        changeDisposable.dispose();
        closeDisposable.dispose();

        // Auto-save the content
        const content = document.getText();
        resolve({ saved: true, content });
      }
    });
  });
}

/**
 * Create a real .md file and open it in VS Code's Markdown editor
 * The file is created immediately and user edits the actual file
 *
 * @param filePath - Full path where the .md file should be created
 * @param initialContent - Initial content for the file (default: empty)
 * @returns Promise that resolves when the editor is closed
 */
export async function createAndEditMarkdownFile(
  filePath: string,
  initialContent: string = ''
): Promise<MarkdownEditorResult> {
  try {
    console.log(`[createAndEditMarkdownFile] Creating file: ${filePath}`);

    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      console.log(`[createAndEditMarkdownFile] Creating directory: ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
    }

    // Create the file with initial content
    fs.writeFileSync(filePath, initialContent, 'utf-8');
    console.log(`[createAndEditMarkdownFile] File created successfully`);

    // Open the file in VS Code
    const document = await vscode.workspace.openTextDocument(filePath);
    console.log(`[createAndEditMarkdownFile] Document opened`);

    await vscode.window.showTextDocument(document, {
      preview: false,
      viewColumn: vscode.ViewColumn.Active
    });
    console.log(`[createAndEditMarkdownFile] Document shown in editor`);

    // Show notification
    const fileName = path.basename(filePath);
    vscode.window.showInformationMessage(
      `Editing: "${fileName}". Save (Ctrl+S) to complete. You can close the tab or keep editing.`
    );

    // Wait for the editor to be closed
    console.log(`[createAndEditMarkdownFile] Waiting for editor to close...`);
    const result = await waitForFileEditorClose(document, filePath);
    console.log(`[createAndEditMarkdownFile] Editor closed, result:`, result);
    return result;

  } catch (error) {
    console.error(`[createAndEditMarkdownFile] Error:`, error);
    vscode.window.showErrorMessage(`Failed to create Markdown file: ${error}`);
    return { saved: false };
  }
}

/**
 * Wait for a file editor to be closed and return the final content
 */
async function waitForFileEditorClose(
  document: vscode.TextDocument,
  filePath: string
): Promise<MarkdownEditorResult> {
  return new Promise((resolve) => {
    let isResolved = false;
    let hasSaved = false;

    // Listen for document close
    const closeDisposable = vscode.workspace.onDidCloseTextDocument((closedDoc) => {
      if (closedDoc === document && !isResolved) {
        isResolved = true;
        closeDisposable.dispose();
        saveDisposable.dispose();

        // Read the final content from the file
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          console.log(`[waitForFileEditorClose] Document closed, content length: ${content.length}, saved: ${hasSaved}`);
          resolve({ saved: hasSaved, content: hasSaved ? content : undefined });
        } catch (error) {
          console.error('Error reading file:', error);
          resolve({ saved: false });
        }
      }
    });

    // Listen for save events - auto-complete after first save
    const saveDisposable = vscode.workspace.onDidSaveTextDocument((savedDoc) => {
      if (savedDoc === document && !isResolved) {
        hasSaved = true;
        console.log(`[waitForFileEditorClose] Document saved: ${filePath}`);

        // Auto-complete after save (don't wait for close)
        isResolved = true;
        closeDisposable.dispose();
        saveDisposable.dispose();

        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          console.log(`[waitForFileEditorClose] Auto-completing after save, content length: ${content.length}`);
          resolve({ saved: true, content });
        } catch (error) {
          console.error('Error reading file after save:', error);
          resolve({ saved: false });
        }
      }
    });

    // Add a timeout as a safety measure (5 minutes)
    setTimeout(() => {
      if (!isResolved) {
        console.log(`[waitForFileEditorClose] Timeout reached, hasSaved: ${hasSaved}`);
        isResolved = true;
        closeDisposable.dispose();
        saveDisposable.dispose();

        if (hasSaved) {
          try {
            const content = fs.readFileSync(filePath, 'utf-8');
            resolve({ saved: true, content });
          } catch (error) {
            console.error('Error reading file on timeout:', error);
            resolve({ saved: false });
          }
        } else {
          resolve({ saved: false });
        }
      }
    }, 5 * 60 * 1000); // 5 minutes
  });
}

