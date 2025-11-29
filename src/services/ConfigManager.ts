import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export class ConfigManager {
  private static readonly CONFIG_FILENAME = "extension-config.json";

  constructor(private context: vscode.ExtensionContext) {}

  /**
   * Get the OS-specific config filename
   * e.g., extension-config.windows.json, extension-config.linux.json
   */
  private getSystemConfigFilename(): string {
    const platform = os.platform();
    let osSuffix = "unknown";

    if (platform === "win32") {
      osSuffix = "windows";
    } else if (platform === "darwin") {
      osSuffix = "macos";
    } else if (platform === "linux") {
      osSuffix = "linux";
    }

    return `extension-config.${osSuffix}.json`;
  }

  /**
   * Detect if any config file exists in the given directory
   */
  public detectConfigFile(dirPath: string): string | null {
    try {
      if (!fs.existsSync(dirPath)) {
        return null;
      }

      // Check for generic config
      const genericConfigPath = path.join(
        dirPath,
        ConfigManager.CONFIG_FILENAME
      );
      if (fs.existsSync(genericConfigPath)) {
        return genericConfigPath;
      }

      // Check for system-specific config
      const systemConfigName = this.getSystemConfigFilename();
      const systemConfigPath = path.join(dirPath, systemConfigName);
      if (fs.existsSync(systemConfigPath)) {
        return systemConfigPath;
      }

      // Check for any other system config (optional, but good for completeness)
      // For now, just checking current system or generic is enough as per requirements

      return null;
    } catch (error) {
      console.error("Error detecting config file:", error);
      return null;
    }
  }

  /**
   * Create a system-specific config file with current settings
   */
  public async createSystemConfigFile(dirPath: string): Promise<string | null> {
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      const configName = this.getSystemConfigFilename();
      const configPath = path.join(dirPath, configName);

      // Get current settings to save
      const config = vscode.workspace.getConfiguration("superFastPrompts");
      const syncConfig = vscode.workspace.getConfiguration(
        "superFastPrompts.sync"
      );

      const settingsToSave = {
        sync: {
          enabled: syncConfig.get("enabled"),
          repositoryUrl: syncConfig.get("repositoryUrl"),
          branch: syncConfig.get("branch"),
          autoSyncInterval: syncConfig.get("autoSyncInterval"),
          mode: syncConfig.get("mode"),
          conflictResolution: syncConfig.get("conflictResolution"),
        },
        saveLocation: config.get("saveLocation"),
      };

      fs.writeFileSync(
        configPath,
        JSON.stringify(settingsToSave, null, 2),
        "utf-8"
      );

      return configPath;
    } catch (error) {
      console.error("Error creating system config file:", error);
      return null;
    }
  }
}
