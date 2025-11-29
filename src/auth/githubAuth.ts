import * as vscode from 'vscode';

/**
 * GitHub Authentication Provider
 * Handles authentication with GitHub using VS Code's built-in authentication API
 */
export class GitHubAuthProvider {
    private static readonly SCOPES = ['repo']; // For private repositories
    
    /**
     * Authenticate with GitHub using VS Code's built-in authentication
     */
    async authenticate(): Promise<string | undefined> {
        try {
            const session = await vscode.authentication.getSession(
                'github',
                GitHubAuthProvider.SCOPES,
                { createIfNone: true }
            );
            
            return session.accessToken;
        } catch (error) {
            vscode.window.showErrorMessage(
                `GitHub authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
            return undefined;
        }
    }
    
    /**
     * Get existing session without prompting
     */
    async getExistingSession(): Promise<string | undefined> {
        try {
            const session = await vscode.authentication.getSession(
                'github',
                GitHubAuthProvider.SCOPES,
                { createIfNone: false, silent: true }
            );
            
            return session?.accessToken;
        } catch (error) {
            return undefined;
        }
    }
    
    /**
     * Sign out from GitHub
     * Note: VS Code handles session management automatically
     */
    async signOut(): Promise<void> {
        // VS Code manages authentication sessions automatically
        // Users can sign out through VS Code's account menu
        vscode.window.showInformationMessage(
            'To sign out of GitHub, use the Accounts menu in VS Code'
        );
    }
}

/**
 * Token Manager for Personal Access Tokens
 * Alternative authentication method using SecretStorage
 */
export class TokenManager {
    private static readonly TOKEN_KEY = 'github-pat';
    
    constructor(private secrets: vscode.SecretStorage) {}
    
    async storeToken(token: string): Promise<void> {
        await this.secrets.store(TokenManager.TOKEN_KEY, token);
    }
    
    async getToken(): Promise<string | undefined> {
        return await this.secrets.get(TokenManager.TOKEN_KEY);
    }
    
    async deleteToken(): Promise<void> {
        await this.secrets.delete(TokenManager.TOKEN_KEY);
    }
    
    /**
     * Prompt user to enter PAT and store it securely
     */
    async promptAndStoreToken(): Promise<string | undefined> {
        const token = await vscode.window.showInputBox({
            prompt: 'Enter your GitHub Personal Access Token',
            password: true,
            ignoreFocusOut: true,
            placeHolder: 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Token cannot be empty';
                }
                if (!value.startsWith('ghp_') && !value.startsWith('github_pat_')) {
                    return 'Invalid token format. Should start with ghp_ or github_pat_';
                }
                return null;
            }
        });
        
        if (token) {
            await this.storeToken(token);
            vscode.window.showInformationMessage('GitHub token saved securely');
            return token;
        }
        
        return undefined;
    }
}

