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

