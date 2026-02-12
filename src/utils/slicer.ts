import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

export class Slicer {
  async slice(sourcePath: string, outputDir: string) {
    if (!fs.existsSync(sourcePath)) {
      console.error(chalk.red(`Error: Source file not found: ${sourcePath}`));
      return;
    }

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log(chalk.blue(`[*] Processing ${sourcePath}...`));
    const content = fs.readFileSync(sourcePath, 'utf8');

    // Split by level 2 headers: ## Title
    const sections = content.split(/^##\s+/m);

    // Find current max index in output dir
    const existingFiles = fs.readdirSync(outputDir);
    let maxIndex = 0;
    existingFiles.forEach((f) => {
      const match = f.match(/^(\d+)_/);
      if (match) {
        const idx = parseInt(match[1]);
        if (idx > maxIndex) maxIndex = idx;
      }
    });

    let currentIndex = maxIndex + 1;

    // The first section is preamble
    const preamble = sections[0].trim();
    if (preamble) {
      const baseName = path.basename(sourcePath).replace('.md', '');
      const filename = `${currentIndex.toString().padStart(3, '0')}_${baseName}_Preamble.md`;
      fs.writeFileSync(path.join(outputDir, filename), preamble);
      console.log(chalk.green(`  + Created ${filename}`));
      currentIndex++;
    }

    // Subsequent sections
    for (let i = 1; i < sections.length; i++) {
      const section = sections[i].trim();
      if (!section) continue;

      const lines = section.split('\n');
      const titleRaw = lines[0].trim();
      const body = lines.slice(1).join('\n').trim();

      const safeTitle = titleRaw
        .replace(/[^a-z0-9]/gi, '_')
        .replace(/_+/g, '_')
        .toLowerCase();
      const filename = `${currentIndex.toString().padStart(3, '0')}_${safeTitle}.md`;

      const fileContent = `## ${titleRaw}\n\n${body}`;
      fs.writeFileSync(path.join(outputDir, filename), fileContent);
      console.log(chalk.green(`  + Created ${filename}`));
      currentIndex++;
    }

    console.log(chalk.bold.green('\nDone! Backlog items generated.'));
  }
}
