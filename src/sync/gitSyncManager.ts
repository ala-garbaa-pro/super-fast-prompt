import * as vscode from 'vscode';
import type { SimpleGit } from 'simple-git';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { GitHubAuthProvider } from '../auth/githubAuth';
import { PromptData, ExtensionSettings } from '../types';

export interface SyncOptions {
    force?: boolean;
    conflictResolution?: 'ask' | 'prefer-local' | 'prefer-remote' | 'manual';
}

export interface SyncResult {
    success: boolean;
    message: string;
    conflicts?: string[];
    filesChanged?: string[];
}

export class GitSyncManager {
    private git: SimpleGit | null = null;
    private authProvider: GitHubAuthProvider;
    private statusBarItem: vscode.StatusBarItem;
    private autoSyncTimer?: NodeJS.Timeout;
    private fileWatcher?: vscode.FileSystemWatcher;

    constructor(
        private context: vscode.ExtensionContext
    ) {
        this.authProvider = new GitHubAuthProvider();
        this.statusBarItem = this.createStatusBar();
    }

    /**
     * Initialize the sync manager
     */
    async initialize(): Promise<boolean> {
        const config = vscode.workspace.getConfiguration('superFastPrompts.sync');
        const enabled = config.get<boolean>('enabled', false);

        if (!enabled) {
            return false;
        }

        try {
            const repoUrl = config.get<string>('repositoryUrl', '');
            if (!repoUrl) {
                vscode.window.showWarningMessage(
                    'GitHub sync is enabled but no repository URL is configured'
                );
                return false;
            }

            const localPath = await this.getLocalRepoPath();

            // Check if repository exists locally
            const exists = await this.repositoryExists(localPath);

            if (!exists) {
                // Try to clone, but if it fails (empty repo), initialize locally
                try {
                    await this.cloneRepository(repoUrl, localPath);
                } catch (cloneError) {
                    const errorMsg = cloneError instanceof Error ? cloneError.message : String(cloneError);

                    // If clone failed because repo is empty, initialize locally
                    if (errorMsg.includes('remote ref') || errorMsg.includes('does not exist') || errorMsg.includes('not found')) {
                        vscode.window.showInformationMessage(
                            'Remote repository is empty. Initializing local repository...'
                        );
                        await this.initializeLocalRepository(repoUrl, localPath);
                    } else {
                        throw cloneError;
                    }
                }
            }

            // Initialize simple-git instance
            const { default: simpleGit } = await import('simple-git');
            this.git = simpleGit(localPath);

            // Configure Git
            await this.configureGit();

            // Setup file watcher
            this.setupFileWatcher();

            // Setup auto-sync if enabled
            this.setupAutoSync();

            this.updateStatusBar('idle');
            return true;

        } catch (error) {
            vscode.window.showErrorMessage(
                `Failed to initialize Git sync: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
            return false;
        }
    }

    /**
     * Check if repository exists at given path
     */
    private async repositoryExists(repoPath: string): Promise<boolean> {
        try {
            await fs.access(path.join(repoPath, '.git'));
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Clone repository from GitHub
     */
    private async cloneRepository(repoUrl: string, localPath: string): Promise<void> {
        this.updateStatusBar('cloning');

        try {
            // Get authentication token
            const token = await this.authProvider.authenticate();
            if (!token) {
                throw new Error('Authentication failed');
            }

            // Create authenticated URL
            const authenticatedUrl = this.createAuthenticatedUrl(repoUrl, token);

            // Ensure parent directory exists
            const parentDir = path.dirname(localPath);
            await fs.mkdir(parentDir, { recursive: true });

            // Clone the repository
            const { default: simpleGit } = await import('simple-git');
            await simpleGit().clone(authenticatedUrl, localPath, {
                '--depth': 1, // Shallow clone for faster initial sync
                '--single-branch': null
            });

            vscode.window.showInformationMessage(
                `Repository cloned successfully to ${localPath}`
            );

        } catch (error) {
            this.updateStatusBar('error', 'Clone failed');
            throw new Error(
                `Failed to clone repository: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    /**
     * Initialize local repository for empty remote
     */
    private async initializeLocalRepository(repoUrl: string, localPath: string): Promise<void> {
        this.updateStatusBar('cloning');

        try {
            // Get authentication token
            const token = await this.authProvider.authenticate();
            if (!token) {
                throw new Error('Authentication failed');
            }

            // Create authenticated URL
            const authenticatedUrl = this.createAuthenticatedUrl(repoUrl, token);

            // Ensure directory exists
            await fs.mkdir(localPath, { recursive: true });

            // Initialize Git repository
            const { default: simpleGit } = await import('simple-git');
            const git = simpleGit(localPath);
            await git.init();

            // Add remote
            await git.addRemote('origin', authenticatedUrl);

            // Configure Git
            await git.addConfig('user.email', 'vscode-extension@super-fast-prompts.local');
            await git.addConfig('user.name', 'Super Fast Prompts Extension');

            // Get branch name from config
            const config = vscode.workspace.getConfiguration('superFastPrompts.sync');
            const branch = config.get<string>('branch', 'main');

            // Convert to Markdown files - NO LONGER NEEDED as we use file-based storage
            // But we might need to ensure the directory structure is correct if we were migrating
            // For initialization of a new repo, we just need to ensure the directory exists
            // and maybe create a sample file if it's completely empty?
            // For now, let's assume the user has some prompts in the save location
            // or we just initialize an empty repo.

            // Create settings.json
            const settings: ExtensionSettings = {
                version: '1.0.0',
                lastSync: new Date().toISOString(),
                syncEnabled: true
            };
            const settingsPath = path.join(localPath, 'settings.json');
            await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');

            // Create README
            const readmePath = path.join(localPath, 'README.md');
            const readmeContent = `# Super Fast Prompts

This repository contains your prompts synced from VS Code.

## Structure

- \`prompts/\` - Your prompts organized by category as Markdown files
- \`settings.json\` - Extension settings and metadata
- \`prompts/INDEX.md\` - Category structure and overview

## Editing Prompts

You can edit the Markdown files directly on GitHub. Each prompt file contains:

- **Frontmatter** (YAML metadata) - Contains prompt ID, name, category, and other metadata
- **Content** - The actual prompt text

When you sync from VS Code, your changes will be pulled automatically.

## Category Structure

Categories are represented as folders. Nested categories create nested folders.
See \`prompts/INDEX.md\` for the complete category structure.
`;
            await fs.writeFile(readmePath, readmeContent, 'utf-8');

            // Create .gitignore
            const gitignorePath = path.join(localPath, '.gitignore');
            const gitignoreContent = `# OS files
.DS_Store
Thumbs.db

# Editor files
.vscode/
.idea/

# Temporary files
*.tmp
*.bak
`;
            await fs.writeFile(gitignorePath, gitignoreContent, 'utf-8');

            // Add and commit
            await git.add('.');
            await git.commit('Initial commit: Setup prompts repository with Markdown files');

            // Create and checkout branch
            await git.checkout(['-b', branch]);

            // Push to remote
            await git.push(['-u', 'origin', branch]);

            vscode.window.showInformationMessage(
                `Repository initialized and pushed to ${repoUrl}`
            );

        } catch (error) {
            this.updateStatusBar('error', 'Initialization failed');
            throw new Error(
                `Failed to initialize repository: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    /**
     * Create authenticated GitHub URL with token
     */
    private createAuthenticatedUrl(repoUrl: string, token: string): string {
        // Remove existing credentials if any
        let cleanUrl = repoUrl.replace(/^https:\/\/([^@]+@)?/, 'https://');

        // Add token authentication
        return cleanUrl.replace('https://', `https://x-access-token:${token}@`);
    }

    /**
     * Configure Git user information
     */
    private async configureGit(): Promise<void> {
        if (!this.git) {
            return;
        }

        try {
            // Try to get existing config
            const email = await this.git.getConfig('user.email').catch(() => null);
            const name = await this.git.getConfig('user.name').catch(() => null);

            // Set defaults if not configured
            if (!email || !email.value) {
                await this.git.addConfig('user.email', 'vscode-extension@super-fast-prompts.local');
            }

            if (!name || !name.value) {
                await this.git.addConfig('user.name', 'Super Fast Prompts Extension');
            }

            // Configure credential helper to cache credentials
            await this.git.addConfig('credential.helper', 'cache --timeout=3600');

        } catch (error) {
            console.error('Failed to configure Git:', error);
        }
    }

    /**
     * Sync prompts with remote repository
     */
    async sync(options: SyncOptions = {}): Promise<SyncResult> {
        if (!this.git) {
            return {
                success: false,
                message: 'Git sync not initialized'
            };
        }

        this.updateStatusBar('syncing');

        try {
            // Save current configuration to repository before syncing
            await this.saveConfigurationToRepo();

            // Get authentication token
            const token = await this.authProvider.getExistingSession();
            if (!token) {
                const newToken = await this.authProvider.authenticate();
                if (!newToken) {
                    throw new Error('Authentication required');
                }
            }

            // Check if remote branch exists
            const remoteBranchExists = await this.checkRemoteBranchExists();

            if (!remoteBranchExists) {
                // Remote branch doesn't exist - do initial push
                vscode.window.showInformationMessage('Remote branch does not exist. Creating initial push...');
                return await this.doInitialPush();
            }

            // Check for local changes
            const status = await this.git.status();
            const hasLocalChanges = status.files.length > 0;

            // Fetch latest from remote
            await this.fetchFromRemote();

            // Check if remote has changes
            const behind = await this.isBehindRemote();

            if (hasLocalChanges && behind) {
                // Both local and remote have changes - potential conflict
                return await this.handleConflictSync(options);
            } else if (hasLocalChanges) {
                // Only local changes - push to remote
                return await this.pushToRemote();
            } else if (behind) {
                // Only remote changes - pull from remote
                return await this.pullFromRemote();
            } else {
                // No changes
                this.updateStatusBar('synced');
                return {
                    success: true,
                    message: 'Already up to date'
                };
            }

        } catch (error) {
            this.updateStatusBar('error', 'Sync failed');
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Check if remote branch exists
     */
    private async checkRemoteBranchExists(): Promise<boolean> {
        if (!this.git) {
            return false;
        }

        const config = vscode.workspace.getConfiguration('superFastPrompts.sync');
        const branch = config.get<string>('branch', 'main');

        try {
            // Try to list remote branches
            const remotes = await this.git.listRemote(['--heads', 'origin', branch]);
            return remotes.trim().length > 0;
        } catch (error) {
            console.log('Error checking remote branch:', error);
            return false;
        }
    }

    /**
     * Do initial push to create remote branch
     */
    private async doInitialPush(): Promise<SyncResult> {
        if (!this.git) {
            return { success: false, message: 'Git not initialized' };
        }

        this.updateStatusBar('pushing');

        try {
            const config = vscode.workspace.getConfiguration('superFastPrompts.sync');
            const branch = config.get<string>('branch', 'main');

            // Copy prompts file to repository - NO LONGER NEEDED
            // The save location IS the repository now
            // await this.copyPromptsToRepo();

            // Check if we're on the right branch
            const branches = await this.git.branch();
            if (branches.current !== branch) {
                // Create and checkout the branch
                try {
                    await this.git.checkout(['-b', branch]);
                } catch (error) {
                    // Branch might already exist, just checkout
                    await this.git.checkout(branch);
                }
            }

            // Check if there are any files to commit
            const status = await this.git.status();

            // If no files, create initial files
            if (status.files.length === 0) {
                const repoPath = await this.getLocalRepoPath();
                const readmePath = path.join(repoPath, 'README.md');

                // Check if README exists
                const readmeExists = await fs.access(readmePath).then(() => true).catch(() => false);
                if (!readmeExists) {
                    await fs.writeFile(readmePath, '# Super Fast Prompts\n\nThis repository contains your prompts synced from VS Code.\n');
                }
            }

            // Stage all changes
            await this.git.add('.');

            // Check again if there are changes after adding
            const statusAfterAdd = await this.git.status();
            if (statusAfterAdd.files.length === 0) {
                this.updateStatusBar('synced');
                return {
                    success: true,
                    message: 'No changes to push'
                };
            }

            // Commit with message
            const commitMessage = 'Initial commit: Setup Super Fast Prompts sync';
            await this.git.commit(commitMessage);

            // Push to remote with upstream
            await this.git.push(['-u', 'origin', branch]);

            this.updateStatusBar('synced');

            vscode.window.showInformationMessage(
                `Successfully created remote branch '${branch}' and pushed initial commit`
            );

            return {
                success: true,
                message: 'Successfully created remote branch and pushed initial commit',
                filesChanged: statusAfterAdd.files.map(f => f.path)
            };

        } catch (error) {
            this.updateStatusBar('error', 'Initial push failed');

            return {
                success: false,
                message: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Fetch latest changes from remote
     */
    private async fetchFromRemote(): Promise<void> {
        if (!this.git) {
            return;
        }

        const config = vscode.workspace.getConfiguration('superFastPrompts.sync');
        const branch = config.get<string>('branch', 'main');

        try {
            await this.git.fetch('origin', branch);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);

            // If remote branch doesn't exist, that's okay - we'll create it on first push
            if (errorMsg.includes('remote ref') || errorMsg.includes('not found')) {
                console.log('Remote branch does not exist yet, will be created on first push');
                return;
            }

            throw error;
        }
    }

    /**
     * Check if local branch is behind remote
     */
    private async isBehindRemote(): Promise<boolean> {
        if (!this.git) {
            return false;
        }

        try {
            const status = await this.git.status();
            return status.behind > 0;
        } catch (error) {
            // If we can't get status (e.g., no remote branch yet), we're not behind
            return false;
        }
    }

    /**
     * Get local repository path (same as save location)
     */
    private async getLocalRepoPath(): Promise<string> {
        const config = vscode.workspace.getConfiguration('superFastPrompts');
        let localPath = config.get<string>('saveLocation', '');

        if (!localPath) {
            localPath = path.join(os.homedir(), 'Documents', 'github', 'my-prompts');
        }

        // Expand ${userHome} to home directory (VS Code variable)
        localPath = localPath.replace(/\$\{userHome\}/g, os.homedir());
        // Expand ~ to home directory (Unix convention)
        return localPath.replace(/^~/, os.homedir());
    }

    /**
     * Create status bar item
     */
    private createStatusBar(): vscode.StatusBarItem {
        const item = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        item.command = 'super-fast-prompts.syncNow';
        this.context.subscriptions.push(item);
        return item;
    }

    /**
     * Update status bar display
     */
    private updateStatusBar(
        state: 'idle' | 'syncing' | 'pushing' | 'pulling' | 'cloning' | 'synced' | 'error',
        message?: string
    ): void {
        switch (state) {
            case 'idle':
                this.statusBarItem.text = '$(cloud) Prompts';
                this.statusBarItem.tooltip = 'Click to sync prompts';
                this.statusBarItem.backgroundColor = undefined;
                break;

            case 'syncing':
                this.statusBarItem.text = '$(sync~spin) Syncing...';
                this.statusBarItem.tooltip = 'Syncing prompts with GitHub';
                break;

            case 'pushing':
                this.statusBarItem.text = '$(cloud-upload) Pushing...';
                this.statusBarItem.tooltip = 'Pushing changes to GitHub';
                break;

            case 'pulling':
                this.statusBarItem.text = '$(cloud-download) Pulling...';
                this.statusBarItem.tooltip = 'Pulling changes from GitHub';
                break;

            case 'cloning':
                this.statusBarItem.text = '$(repo-clone) Cloning...';
                this.statusBarItem.tooltip = 'Cloning repository from GitHub';
                break;

            case 'synced':
                this.statusBarItem.text = '$(check) Synced';
                this.statusBarItem.tooltip = 'Last synced: ' + new Date().toLocaleString();
                setTimeout(() => this.updateStatusBar('idle'), 3000);
                break;

            case 'error':
                this.statusBarItem.text = '$(error) Sync Failed';
                this.statusBarItem.tooltip = message || 'Sync failed';
                this.statusBarItem.backgroundColor = new vscode.ThemeColor(
                    'statusBarItem.errorBackground'
                );
                setTimeout(() => this.updateStatusBar('idle'), 5000);
                break;
        }

        this.statusBarItem.show();
    }

    /**
     * Pull changes from remote
     */
    async pullFromRemote(): Promise<SyncResult> {
        if (!this.git) {
            return { success: false, message: 'Git not initialized' };
        }

        this.updateStatusBar('pulling');

        try {
            const config = vscode.workspace.getConfiguration('superFastPrompts.sync');
            const branch = config.get<string>('branch', 'main');

            // Pull with rebase to maintain clean history
            await this.git.pull('origin', branch, {
                '--rebase': 'true'
            });

            // Copy synced file to prompts location - NO LONGER NEEDED
            // The save location IS the repository
            // await this.copySyncedFileToPrompts();

            this.updateStatusBar('synced');

            return {
                success: true,
                message: 'Successfully pulled changes from remote'
            };

        } catch (error) {
            this.updateStatusBar('error', 'Pull failed');

            if (this.isConflictError(error)) {
                return {
                    success: false,
                    message: 'Merge conflict detected',
                    conflicts: await this.getConflictedFiles()
                };
            }

            return {
                success: false,
                message: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Push changes to remote
     */
    async pushToRemote(): Promise<SyncResult> {
        if (!this.git) {
            return { success: false, message: 'Git not initialized' };
        }

        this.updateStatusBar('pushing');

        try {
            const config = vscode.workspace.getConfiguration('superFastPrompts.sync');
            const branch = config.get<string>('branch', 'main');

            // Copy prompts file to repository - NO LONGER NEEDED
            // The save location IS the repository
            // await this.copyPromptsToRepo();

            // Check if there are changes to commit
            const status = await this.git.status();
            if (status.files.length === 0) {
                this.updateStatusBar('synced');
                return {
                    success: true,
                    message: 'No changes to push'
                };
            }

            // Stage all changes
            await this.git.add('.');

            // Commit with message
            const commitMessage = this.generateCommitMessage();
            await this.git.commit(commitMessage);

            // Check if we need to set upstream (first push)
            const branches = await this.git.branch();
            const currentBranch = branches.current;

            // Push to remote with upstream if needed
            try {
                await this.git.push('origin', branch);
            } catch (pushError) {
                const errorMsg = pushError instanceof Error ? pushError.message : String(pushError);

                // If upstream not set, set it and push
                if (errorMsg.includes('no upstream') || errorMsg.includes('set-upstream')) {
                    await this.git.push(['-u', 'origin', branch]);
                } else {
                    throw pushError;
                }
            }

            this.updateStatusBar('synced');

            return {
                success: true,
                message: 'Successfully pushed changes to remote',
                filesChanged: status.files.map(f => f.path)
            };

        } catch (error) {
            this.updateStatusBar('error', 'Push failed');

            // Check if push was rejected
            if (error instanceof Error && error.message.includes('rejected')) {
                return {
                    success: false,
                    message: 'Push rejected. Remote has changes. Please sync first.'
                };
            }

            return {
                success: false,
                message: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Handle sync when both local and remote have changes
     */
    private async handleConflictSync(options: SyncOptions): Promise<SyncResult> {
        const config = vscode.workspace.getConfiguration('superFastPrompts.sync');
        const strategy = options.conflictResolution ||
            config.get<string>('conflictResolution', 'ask');

        switch (strategy) {
            case 'prefer-local':
                return await this.resolveConflictLocal();

            case 'prefer-remote':
                return await this.resolveConflictRemote();

            case 'manual':
                return await this.openMergeEditor();

            case 'ask':
            default:
                return await this.promptConflictResolution();
        }
    }

    /**
     * Prompt user for conflict resolution
     */
    private async promptConflictResolution(): Promise<SyncResult> {
        const choice = await vscode.window.showWarningMessage(
            'Both local and remote have changes. How would you like to resolve?',
            { modal: true },
            'Keep Local Changes',
            'Use Remote Changes',
            'Merge Manually',
            'Cancel'
        );

        switch (choice) {
            case 'Keep Local Changes':
                return await this.resolveConflictLocal();

            case 'Use Remote Changes':
                return await this.resolveConflictRemote();

            case 'Merge Manually':
                return await this.openMergeEditor();

            default:
                return {
                    success: false,
                    message: 'Sync cancelled by user'
                };
        }
    }

    /**
     * Resolve conflict by keeping local changes
     */
    private async resolveConflictLocal(): Promise<SyncResult> {
        if (!this.git) {
            return { success: false, message: 'Git not initialized' };
        }

        try {
            // Stash remote changes
            await this.git.stash(['push', '-m', 'Remote changes']);

            // Push local changes
            const result = await this.pushToRemote();

            // Drop stash
            await this.git.stash(['drop']);

            return result;

        } catch (error) {
            return {
                success: false,
                message: `Failed to resolve conflict: ${error instanceof Error ? error.message : 'Unknown'}`
            };
        }
    }

    /**
     * Resolve conflict by using remote changes
     */
    private async resolveConflictRemote(): Promise<SyncResult> {
        if (!this.git) {
            return { success: false, message: 'Git not initialized' };
        }

        try {
            // Stash local changes
            await this.git.stash(['push', '-m', 'Local changes']);

            // Pull remote changes
            const result = await this.pullFromRemote();

            // Drop stash
            await this.git.stash(['drop']);

            return result;

        } catch (error) {
            return {
                success: false,
                message: `Failed to resolve conflict: ${error instanceof Error ? error.message : 'Unknown'}`
            };
        }
    }

    /**
     * Open VS Code's merge editor for manual conflict resolution
     */
    private async openMergeEditor(): Promise<SyncResult> {
        vscode.window.showInformationMessage(
            'Please resolve conflicts manually in the editor, then run sync again.'
        );

        // Open the conflicted file in diff view
        const repoPath = await this.getLocalRepoPath();
        // Open the repository folder instead of a specific file
        const uri = vscode.Uri.file(repoPath);
        await vscode.commands.executeCommand('vscode.open', uri);

        return {
            success: false,
            message: 'Awaiting manual conflict resolution'
        };
    }

    /**
     * Check if error is a conflict error
     */
    private isConflictError(error: any): boolean {
        const message = error instanceof Error ? error.message : String(error);
        return message.includes('CONFLICT') ||
            message.includes('conflict') ||
            message.includes('Merge conflict');
    }

    /**
     * Get list of conflicted files
     */
    private async getConflictedFiles(): Promise<string[]> {
        if (!this.git) {
            return [];
        }

        try {
            const status = await this.git.status();
            return status.conflicted;
        } catch {
            return [];
        }
    }


    /**
     * Generate commit message
     */
    private generateCommitMessage(): string {
        const config = vscode.workspace.getConfiguration('superFastPrompts.sync');
        const template = config.get<string>('commitMessage', 'Update prompts: ${timestamp}');

        return template.replace('${timestamp}', new Date().toISOString());
    }

    /**
     * Setup file watcher for automatic sync
     */
    private setupFileWatcher(): void {
        const config = vscode.workspace.getConfiguration('superFastPrompts.sync');
        const mode = config.get<string>('mode', 'manual');

        if (mode === 'on-save') {
            // Watch the save location for changes
            this.getLocalRepoPath().then(repoPath => {
                // Create a relative pattern to watch for .md and .json files in the repo path
                // We need to handle the case where repoPath is outside the workspace
                // But createFileSystemWatcher works with glob patterns or absolute paths
                
                // Watch for changes in the repository directory
                // Pattern: repoPath/**/*.{md,json}
                const pattern = new vscode.RelativePattern(repoPath, '**/*.{md,json}');
                
                this.fileWatcher = vscode.workspace.createFileSystemWatcher(
                    pattern
                );

                // Debounced sync on file change
                let debounceTimer: NodeJS.Timeout;
                const triggerSync = () => {
                    clearTimeout(debounceTimer);
                    debounceTimer = setTimeout(() => {
                        console.log('Auto-sync triggered by file change');
                        this.sync().catch(console.error);
                    }, 3000); // 3 second debounce
                };

                this.fileWatcher.onDidChange(triggerSync);
                this.fileWatcher.onDidCreate(triggerSync);
                this.fileWatcher.onDidDelete(triggerSync);

                this.context.subscriptions.push(this.fileWatcher);
            });
        }
    }

    /**
     * Setup automatic sync at interval
     */
    private setupAutoSync(): void {
        const config = vscode.workspace.getConfiguration('superFastPrompts.sync');
        const mode = config.get<string>('mode', 'manual');

        if (mode === 'automatic') {
            const value = config.get<number>('autoSyncIntervalValue', 5);
            const unit = config.get<string>('autoSyncIntervalUnit', 'minutes');
            
            // Calculate interval in milliseconds
            let intervalMs: number;
            switch (unit) {
                case 'hours':
                    intervalMs = value * 60 * 60 * 1000;
                    break;
                case 'days':
                    intervalMs = value * 24 * 60 * 60 * 1000;
                    break;
                case 'minutes':
                default:
                    intervalMs = value * 60 * 1000;
                    break;
            }

            this.autoSyncTimer = setInterval(async () => {
                try {
                    await this.sync();
                } catch (error) {
                    console.error('Auto-sync failed:', error);
                }
            }, intervalMs);
        }
    }

    /**
     * Get sync history
     */
    async getSyncHistory(limit: number = 10): Promise<any[]> {
        if (!this.git) {
            return [];
        }

        try {
            const log = await this.git.log({ maxCount: limit });
            return [...log.all]; // Convert readonly array to mutable array
        } catch (error) {
            console.error('Failed to get sync history:', error);
            return [];
        }
    }

    /**
     * Save extension configuration to repository
     */
    private async saveConfigurationToRepo(): Promise<void> {
        try {
            const repoPath = await this.getLocalRepoPath();
            const configPath = path.join(repoPath, 'extension-config.json');
            
            // Get all configuration
            const config = vscode.workspace.getConfiguration('superFastPrompts');
            
            // Create a clean object with only relevant settings
            // We avoid saving everything to prevent clutter and potential sensitive data leaks
            // although tokens are stored in secret storage, not settings.
            const settingsToSave = {
                sync: {
                    enabled: config.get('sync.enabled'),
                    repositoryUrl: config.get('sync.repositoryUrl'),
                    branch: config.get('sync.branch'),
                    autoSyncIntervalValue: config.get('sync.autoSyncIntervalValue'),
                    autoSyncIntervalUnit: config.get('sync.autoSyncIntervalUnit'),
                    mode: config.get('sync.mode'),
                    conflictResolution: config.get('sync.conflictResolution')
                },
                // Add other settings sections here as needed
                saveLocation: config.get('saveLocation')
            };

            await fs.writeFile(configPath, JSON.stringify(settingsToSave, null, 2), 'utf-8');
            
        } catch (error) {
            console.error('Failed to save configuration to repo:', error);
            // We don't throw here to avoid blocking the sync process if config save fails
        }
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        this.statusBarItem.dispose();

        if (this.autoSyncTimer) {
            clearInterval(this.autoSyncTimer);
        }

        if (this.fileWatcher) {
            this.fileWatcher.dispose();
        }
    }
}

