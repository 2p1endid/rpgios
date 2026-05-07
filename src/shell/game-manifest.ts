export interface GameManifestResult {
  valid: boolean;
  missingFiles: string[];
  warnings: string[];
  title?: string;
  version?: string;
}

interface RpgMakerFileEntry {
  path: string;
  content?: ArrayBuffer;
}

export class GameManifest {
  private readonly REQUIRED_FILES = [
    'index.html',
    'js/rpg_core.js',
    'js/rpg_managers.js',
    'js/main.js',
  ];

  private readonly REQUIRED_DIRS = [
    'data/',
    'img/',
    'audio/',
  ];

  private readonly RECOMMENDED_FILES = [
    'js/rpg_scenes.js',
    'js/rpg_sprites.js',
    'js/rpg_windows.js',
    'js/rpg_objects.js',
    'js/plugins.js',
  ];

  validate(files: RpgMakerFileEntry[]): GameManifestResult {
    const filePaths = new Set(files.map((f) => f.path));
    const warnings: string[] = [];
    const missingFiles: string[] = [];

    // Check required files
    for (const required of this.REQUIRED_FILES) {
      if (!filePaths.has(required)) {
        missingFiles.push(required);
      }
    }

    // Check required directories (at least one file inside)
    for (const dir of this.REQUIRED_DIRS) {
      const hasFiles = files.some((f) => f.path.startsWith(dir) && f.path !== dir);
      if (!hasFiles) {
        warnings.push(`目录 ${dir} 为空或不存在`);
      }
    }

    // Check recommended files
    for (const rec of this.RECOMMENDED_FILES) {
      if (!filePaths.has(rec)) {
        warnings.push(`建议文件缺失: ${rec}`);
      }
    }

    // Check data/*.json files
    const dataFiles = files.filter((f) => f.path.startsWith('data/') && f.path.endsWith('.json'));
    if (dataFiles.length === 0) {
      warnings.push('data/ 目录中没有 JSON 数据文件');
    }

    // Check for index.html contains expected script references
    const indexFile = files.find((f) => f.path === 'index.html');
    let title: string | undefined;
    if (indexFile && indexFile.content) {
      const html = new TextDecoder().decode(indexFile.content);
      if (!html.includes('rpg_core.js')) {
        warnings.push('index.html 未引用 rpg_core.js，可能不是 RPG Maker MV 游戏');
      }
      // Try to extract title
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch) {
        title = titleMatch[1].trim();
      }
    }

    // Try to read game title from System.json
    const systemFile = files.find((f) => f.path === 'data/System.json');
    if (systemFile && systemFile.content) {
      try {
        const json = JSON.parse(new TextDecoder().decode(systemFile.content));
        if (json.gameTitle) {
          title = json.gameTitle;
        }
      } catch {
        // JSON parse error, ignore
      }
    }

    return {
      valid: missingFiles.length === 0,
      missingFiles,
      warnings,
      title,
    };
  }
}
