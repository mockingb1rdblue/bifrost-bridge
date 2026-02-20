import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import https from 'https';
import chalk from 'chalk';

const execAsync = promisify(exec);

interface ToolMetadata {
  name: string;
  version: string;
  url: string;
  destFile: string;
  extractPath: string;
  binPath: string;
  skipPlatform?: string[];
}

/**
 * RelicRepository handles the setup and maintenance of the portable toolkit
 * (the "Relic Repository") for deployment in restricted corporate environments.
 */
export class RelicRepository {
  private versions = {
    node: '20.11.1',
    pwsh: '7.4.1',
    tsx: '4.7.1',
  };
  private toolsDir: string;
  private platform: string;
  private arch: string;

  /**
   *
   */
  constructor(projectRoot: string) {
    this.toolsDir = path.join(projectRoot, '.tools');
    this.platform = process.platform;
    this.arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  }

  private async downloadWithRetry(url: string, dest: string, retries = 3): Promise<void> {
    for (let i = 0; i < retries; i++) {
      try {
        await this.downloadFile(url, dest);
        return;
      } catch (err) {
        if (i === retries - 1) throw err;
        console.log(chalk.yellow(`[!] Download failed, retrying (${i + 1}/${retries})...`));
        await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
      }
    }
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

  private async extractArtifact(file: string, dest: string) {
    if (this.platform === 'win32') {
      await execAsync(
        `powershell -Command "Expand-Archive -Path '${file}' -DestinationPath '${dest}' -Force"`,
      );
    } else {
      await execAsync(`tar -xzf "${file}" -C "${dest}"`);
    }
  }

  private getToolRegistry(): ToolMetadata[] {
    const isWin = this.platform === 'win32';
    const nodePlat = isWin ? 'win-x64' : `darwin-${this.arch}`;
    const nodeExt = isWin ? 'zip' : 'tar.gz';

    // gh CLI (GitHub)
    const ghVersion = '2.67.0';
    const ghPlat = isWin ? 'windows_amd64' : `macOS_${this.arch}`;

    // flyctl (Fly.io)
    const flyVersion = '0.3.74';
    const flyPlat = isWin ? 'windows_x86_64' : `mac_${this.arch}`;
    const flyExt = isWin ? 'zip' : 'tar.gz';

    return [
      {
        name: 'Node.js',
        version: this.versions.node,
        url: `https://nodejs.org/dist/v${this.versions.node}/node-v${this.versions.node}-${nodePlat}.${nodeExt}`,
        destFile: path.join(this.toolsDir, `node.${nodeExt}`),
        extractPath: path.join(this.toolsDir, 'nodejs'),
        binPath: isWin
          ? path.join(this.toolsDir, 'nodejs', 'node.exe')
          : path.join(this.toolsDir, 'nodejs', 'bin', 'node'),
      },
      {
        name: 'PowerShell Core',
        version: this.versions.pwsh,
        url: `https://github.com/PowerShell/PowerShell/releases/download/v${this.versions.pwsh}/PowerShell-${this.versions.pwsh}-win-x64.zip`,
        destFile: path.join(this.toolsDir, 'pwsh.zip'),
        extractPath: path.join(this.toolsDir, 'pwsh'),
        binPath: path.join(this.toolsDir, 'pwsh', 'pwsh.exe'),
        skipPlatform: ['darwin', 'linux'],
      },
      {
        name: 'GitHub CLI',
        version: ghVersion,
        url: `https://github.com/cli/cli/releases/download/v${ghVersion}/gh_${ghVersion}_${ghPlat}.zip`,
        destFile: path.join(this.toolsDir, 'gh.zip'),
        extractPath: path.join(this.toolsDir, 'gh'),
        binPath: isWin
          ? path.join(this.toolsDir, 'gh', 'bin', 'gh.exe')
          : path.join(this.toolsDir, 'gh', 'bin', 'gh'),
      },
      {
        name: 'Flyctl',
        version: flyVersion,
        url: `https://github.com/superfly/flyctl/releases/download/v${flyVersion}/flyctl_${flyVersion}_${flyPlat}.${flyExt}`,
        destFile: path.join(this.toolsDir, `flyctl.${flyExt}`),
        extractPath: path.join(this.toolsDir, 'flyctl'),
        binPath: isWin
          ? path.join(this.toolsDir, 'flyctl', 'flyctl.exe')
          : path.join(this.toolsDir, 'flyctl', 'flyctl'),
      },
    ];
  }

  /**
   *
   */
  async setupTool(tool: ToolMetadata) {
    if (tool.skipPlatform?.includes(this.platform)) {
      console.log(chalk.dim(`[*] Skipping ${tool.name} on ${this.platform}.`));
      return;
    }

    if (fs.existsSync(tool.binPath)) {
      try {
        const flag = tool.name === 'Node.js' ? '-v' : '-Version';
        const { stdout } = await execAsync(`"${tool.binPath}" ${flag}`);
        if (stdout.includes(tool.version)) {
          console.log(chalk.cyan(`[*] ${tool.name} v${tool.version} already installed.`));
          return;
        }
      } catch (e) {
        console.log(
          chalk.yellow(`[!] ${tool.name} binary corrupted or version mismatch, reinstalling...`),
        );
      }
    }

    console.log(chalk.blue(`[*] Setting up portable ${tool.name} v${tool.version}...`));
    if (!fs.existsSync(this.toolsDir)) fs.mkdirSync(this.toolsDir, { recursive: true });

    await this.downloadWithRetry(tool.url, tool.destFile);

    const tempExtract = path.join(this.toolsDir, `_temp_${tool.name.replace(/\s+/g, '_')}`);
    if (fs.existsSync(tempExtract)) fs.rmSync(tempExtract, { recursive: true, force: true });
    fs.mkdirSync(tempExtract, { recursive: true });

    await this.extractArtifact(tool.destFile, tempExtract);

    // Node.js extracts into a subfolder, pwsh doesn't always
    let extractedDir = tempExtract;
    const children = fs.readdirSync(tempExtract);
    if (children.length === 1 && fs.statSync(path.join(tempExtract, children[0])).isDirectory()) {
      extractedDir = path.join(tempExtract, children[0]);
    }

    if (fs.existsSync(tool.extractPath))
      fs.rmSync(tool.extractPath, { recursive: true, force: true });
    fs.renameSync(extractedDir, tool.extractPath);

    fs.rmSync(tempExtract, { recursive: true, force: true });
    fs.unlinkSync(tool.destFile);
    console.log(chalk.green(`[+] ${tool.name} setup complete.`));
  }

  /**
   *
   */
  async setupTsx() {
    const isWin = this.platform === 'win32';
    const nodeDir = path.join(this.toolsDir, 'nodejs');
    const binDir = isWin ? nodeDir : path.join(nodeDir, 'bin');
    const tsxExe = isWin ? path.join(nodeDir, 'tsx.cmd') : path.join(binDir, 'tsx');

    if (fs.existsSync(tsxExe)) {
      console.log(chalk.cyan('[*] tsx already installed.'));
      return;
    }

    console.log(chalk.blue(`[*] Installing tsx v${this.versions.tsx}...`));
    const npmPath = isWin ? path.join(nodeDir, 'npm.cmd') : path.join(binDir, 'npm');

    try {
      await execAsync(`"${npmPath}" install -g tsx@${this.versions.tsx}`, {
        env: { ...process.env, PATH: `${binDir}${isWin ? ';' : ':'}${process.env.PATH}` },
      });
      console.log(chalk.green('[+] tsx setup complete.'));
    } catch (e) {
      console.log(chalk.red(`[!] Failed to install tsx: ${(e as Error).message}`));
    }
  }

  private async createProfile() {
    const projectRoot = path.dirname(this.toolsDir);
    const certBundle = path.join(projectRoot, 'corporate_bundle.pem');
    const isWin = this.platform === 'win32';
    const binDir = isWin
      ? path.join(this.toolsDir, 'nodejs')
      : path.join(this.toolsDir, 'nodejs', 'bin');
    const ghBin = isWin
      ? path.join(this.toolsDir, 'gh', 'bin')
      : path.join(this.toolsDir, 'gh', 'bin');
    const flyBin = isWin ? path.join(this.toolsDir, 'flyctl') : path.join(this.toolsDir, 'flyctl');

    if (isWin) {
      const profilePath = path.join(this.toolsDir, 'pwsh', 'profile.ps1');
      const profileContent = `# Bifrost Portable PowerShell Profile
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
$env:PATH = "${binDir};${ghBin};${flyBin};${path.join(this.toolsDir, 'pwsh')};$env:PATH"
${fs.existsSync(certBundle) ? `$env:NODE_EXTRA_CA_CERTS = "${certBundle}"` : ''}
function prompt {
    Write-Host "[Bifrost] " -NoNewline -ForegroundColor Cyan
    Write-Host (Get-Location) -ForegroundColor Yellow
    return "> "
}
Write-Host "Bifrost Portable Shell Environment Ready" -ForegroundColor Green
`;
      if (fs.existsSync(path.dirname(profilePath)))
        fs.writeFileSync(profilePath, profileContent, 'utf8');
    } else {
      const profilePath = path.join(this.toolsDir, '.unholy_zshrc');
      const profileContent = `# Bifrost Unholy ZSH Profile
export PATH="${binDir}:${ghBin}:${flyBin}:$PATH"
${fs.existsSync(certBundle) ? `export NODE_EXTRA_CA_CERTS="${certBundle}"` : ''}
unholy_prompt() { echo -n "%F{cyan}[Bifrost-Unholy] %F{yellow}%d%f %F{green}> %f" }
PROMPT='$(unholy_prompt)'
echo -e "\\033[1;35m[✔] Unholy Environment Ready\\033[0m"
`;
      fs.writeFileSync(profilePath, profileContent, 'utf8');
    }
  }

  private async createLauncher() {
    const launchersDir = path.join(path.dirname(this.toolsDir), 'scripts', 'launchers');
    if (!fs.existsSync(launchersDir)) fs.mkdirSync(launchersDir, { recursive: true });
    const isWin = this.platform === 'win32';

    if (isWin) {
      const launcherPath = path.join(launchersDir, 'pwsh.bat');
      const launcherContent = `@echo off
setlocal
set "PWSH_EXE=%~dp0..\\..\\.tools\\pwsh\\pwsh.exe"
set "PROFILE=%~dp0..\\..\\.tools\\pwsh\\profile.ps1"
"%PWSH_EXE%" -NoExit -ExecutionPolicy Bypass -NoProfile -Command ". '%PROFILE%'"
`;
      fs.writeFileSync(launcherPath, launcherContent, 'utf8');
    } else {
      const launcherPath = path.join(launchersDir, 'bifrost-shell.sh');
      const profile = path.join(this.toolsDir, '.unholy_zshrc');
      const launcherContent = `#!/bin/zsh
ZDOTDIR=$HOME zsh --rcs "${profile}"
`;
      fs.writeFileSync(launcherPath, launcherContent, 'utf8');
      fs.chmodSync(launcherPath, 0o755);
    }
  }

  /**
   *
   */
  async heal() {
    console.log(chalk.blue('🔍 Running self-healing diagnostics...'));
    const registry = this.getToolRegistry();
    const broken = registry.filter(
      (t) => !t.skipPlatform?.includes(this.platform) && !fs.existsSync(t.binPath),
    );
    if (broken.length === 0) {
      console.log(chalk.green('[✔] Environment is healthy.'));
    } else {
      console.log(chalk.yellow(`[!] ${broken.length} tools missing or broken. Rebuilding...`));
      await this.setupAll();
    }
  }

  /**
   *
   */
  async setupAll() {
    console.log(
      chalk.bold.magenta(`\n🚀 Building Unholy Environment (${this.platform}-${this.arch})...`),
    );
    const registry = this.getToolRegistry();

    // Parallelize core tool setup (Node, Pwsh)
    await Promise.all(registry.map((t) => this.setupTool(t)));

    // Serial setup for dependent tools (tsx needs node)
    await this.setupTsx();
    await this.createProfile();
    await this.createLauncher();

    console.log(chalk.bold.magenta(`\n[✔] Unholy Environment is ready in .tools/\n`));
  }
}
