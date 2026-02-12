import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import https from 'https';
import chalk from 'chalk';

const execAsync = promisify(exec);

export class SetupUtility {
  private nodeVersion = '20.11.1';
  private pwshVersion = '7.4.1';
  private toolsDir: string;

  constructor(projectRoot: string) {
    this.toolsDir = path.join(projectRoot, '.tools');
  }

  private async downloadFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(dest);
      https
        .get(url, (response) => {
          if (response.statusCode !== 200) {
            reject(new Error(`Failed to download: ${response.statusCode}`));
            return;
          }
          response.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve();
          });
        })
        .on('error', (err) => {
          fs.unlink(dest, () => reject(err));
        });
    });
  }

  async setupNode() {
    const nodeUrl = `https://nodejs.org/dist/v${this.nodeVersion}/node-v${this.nodeVersion}-win-x64.zip`;
    const nodeDir = path.join(this.toolsDir, 'nodejs');
    const nodeZip = path.join(this.toolsDir, 'node.zip');

    if (fs.existsSync(path.join(nodeDir, 'node.exe'))) {
      console.log(chalk.cyan('[*] Portable Node.js already installed.'));
      return;
    }

    console.log(chalk.blue(`[*] Setting up portable Node.js v${this.nodeVersion}...`));
    if (!fs.existsSync(this.toolsDir)) fs.mkdirSync(this.toolsDir, { recursive: true });

    await this.downloadFile(nodeUrl, nodeZip);

    // Extract using PowerShell (standard on Windows)
    const extractCmd = `Expand-Archive -Path "${nodeZip}" -DestinationPath "${this.toolsDir}" -Force`;
    await execAsync(`powershell -Command "${extractCmd}"`);

    // Rename root folder
    const extractedFolder = path.join(this.toolsDir, `node-v${this.nodeVersion}-win-x64`);
    if (fs.existsSync(nodeDir)) fs.rmdirSync(nodeDir, { recursive: true });
    fs.renameSync(extractedFolder, nodeDir);

    fs.unlinkSync(nodeZip);
    console.log(chalk.green('[+] Node.js setup complete.'));
  }

  async setupPwsh() {
    const pwshUrl = `https://github.com/PowerShell/PowerShell/releases/download/v${this.pwshVersion}/PowerShell-${this.pwshVersion}-win-x64.zip`;
    const pwshDir = path.join(this.toolsDir, 'pwsh');
    const pwshZip = path.join(this.toolsDir, 'pwsh.zip');

    if (fs.existsSync(path.join(pwshDir, 'pwsh.exe'))) {
      console.log(chalk.cyan('[*] Portable PowerShell Core already installed.'));
      return;
    }

    console.log(chalk.blue(`[*] Setting up portable PowerShell Core v${this.pwshVersion}...`));
    if (!fs.existsSync(this.toolsDir)) fs.mkdirSync(this.toolsDir, { recursive: true });

    await this.downloadFile(pwshUrl, pwshZip);

    if (!fs.existsSync(pwshDir)) fs.mkdirSync(pwshDir, { recursive: true });
    const extractCmd = `Expand-Archive -Path "${pwshZip}" -DestinationPath "${pwshDir}" -Force`;
    await execAsync(`powershell -Command "${extractCmd}"`);

    fs.unlinkSync(pwshZip);
    await this.createProfile(pwshDir);
    console.log(chalk.green('[+] PowerShell Core setup complete.'));
  }

  private async createProfile(pwshDir: string) {
    const profilePath = path.join(pwshDir, 'profile.ps1');
    const projectRoot = path.dirname(this.toolsDir);
    const certBundle = path.join(projectRoot, 'corporate_bundle.pem');

    const profileContent = `# Bifrost Portable PowerShell Profile
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
$ProjectRoot = "${projectRoot}"
$NodePath = Join-Path $ProjectRoot ".tools\\nodejs"
if (Test-Path $NodePath) { $env:PATH = "$NodePath;$env:PATH" }
$env:PATH = "$PSScriptRoot;$env:PATH"

${fs.existsSync(certBundle) ? `$env:NODE_EXTRA_CA_CERTS = "${certBundle}"` : ''}

function prompt {
    Write-Host "[Bifrost] " -NoNewline -ForegroundColor Cyan
    Write-Host (Get-Location) -ForegroundColor Yellow
    return "> "
}
Write-Host "Bifrost Portable Shell Environment Ready" -ForegroundColor Green
`;

    fs.writeFileSync(profilePath, profileContent, 'utf8');
  }

  private async createLauncher(pwshDir: string) {
    const launcherPath = path.join(path.dirname(this.toolsDir), 'scripts', 'pwsh.bat');
    const pwshExe = path.join(pwshDir, 'pwsh.exe');
    const profile = path.join(pwshDir, 'profile.ps1');

    const launcherContent = `@echo off
setlocal
set "PWSH_EXE=${pwshExe}"
set "PROFILE=${profile}"
if not exist "%PWSH_EXE%" (
    echo PowerShell Core not found. Run 'npm run setup'
    pause
    exit /b 1
)
"%PWSH_EXE%" -NoExit -ExecutionPolicy Bypass -NoProfile -Command ". '%PROFILE%'"
`;
    if (!fs.existsSync(path.dirname(launcherPath)))
      fs.mkdirSync(path.dirname(launcherPath), { recursive: true });
    fs.writeFileSync(launcherPath, launcherContent, 'utf8');
  }

  async setupAll() {
    if (process.platform !== 'win32') {
      console.log(chalk.yellow('[!] Portable tools setup is currently only supported on Windows.'));
      return;
    }
    await this.setupNode();
    const pwshDir = path.join(this.toolsDir, 'pwsh');
    await this.setupPwsh();
    await this.createLauncher(pwshDir);
    console.log(chalk.bold.magenta('\n[✔] All tools ready in .tools/'));
  }
}
