import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';

const execAsync = promisify(exec);

/**
 *
 */
export class WindowsUtility {
  /**
   * Updates HKCU:\Environment Path to prioritize local .tools.
   * Use this to 'dominate' the environment without admin rights.
   */
  async recordGlobalPaths(toolsDir: string) {
    if (process.platform !== 'win32') {
      console.log(chalk.yellow('[!] Dependency dominance is only applicable on Windows.'));
      return;
    }

    try {
      // Get current user PATH
      const { stdout: currentPath } = await execAsync('reg query "HKCU\\Environment" /v Path');
      const pathMatch = currentPath.match(/REG_(?:EXPAND_)?SZ\s+(.*)/);
      if (!pathMatch) throw new Error('Could not read current PATH from Registry');

      const existingPath = pathMatch[1].trim();
      const toolsPath = `${toolsDir}\\nodejs;${toolsDir}\\pwsh`;

      if (existingPath.includes(toolsPath)) {
        console.log(chalk.cyan('[*] Local tools are already prioritized in Registry.'));
        return;
      }

      // Prepend local tools to PATH
      const newPath = `${toolsPath};${existingPath}`;
      await execAsync(`reg add "HKCU\\Environment" /v Path /t REG_EXPAND_SZ /d "${newPath}" /f`);

      console.log(chalk.green('[+] Global User PATH updated successfully.'));
      console.log(
        chalk.magenta(
          '[!] You may need to restart your terminal for changes to take effect globally.',
        ),
      );

      // Broadcast change to system
      await this.refreshEnvironment();
    } catch (error: any) {
      console.error(chalk.red(`[!] Failed to update Registry: ${error.message}`));
    }
  }

  /**
   * Broadcasts a notification to all windows that environment variables have changed.
   * Equivalent to Refresh-Environment in PowerShell.
   */
  async refreshEnvironment() {
    if (process.platform !== 'win32') return;

    console.log(chalk.blue('[*] Refreshing system environment...'));
    const psCommand = `
            $code = @'
            [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
            public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint Msg, UIntPtr wParam, string lParam, uint fuFlags, uint uTimeout, out UIntPtr lpdwResult);
'@
            $type = Add-Type -MemberDefinition $code -Name "Win32" -Namespace "Env" -PassThru
            $SMTO_ABORTIFHUNG = 0x0002
            $result = [UIntPtr]::Zero
            $type::SendMessageTimeout(0xffff, 0x001a, [UIntPtr]::Zero, "Environment", $SMTO_ABORTIFHUNG, 5000, [ref]$result)
        `;

    try {
      await execAsync(`powershell -Command "${psCommand.replace(/\n/g, '')}"`);
      console.log(chalk.green('[+] Environment refresh broadcasted.'));
    } catch (error) {
      // Non-critical, ignore broadcast errors
    }
  }
}
