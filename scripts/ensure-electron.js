const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

async function ensureElectron() {
  const electronDir = path.join(__dirname, '..', 'node_modules', 'electron');
  const pathTxt = path.join(electronDir, 'path.txt');
  const binPath = path.join(electronDir, 'dist', 'Electron.app', 'Contents', 'MacOS', 'Electron');

  if (fs.existsSync(pathTxt) && fs.existsSync(binPath)) {
    return;
  }

  console.log('[IA-Use] Configurazione binario Electron per macOS...');
  const { downloadArtifact } = require('@electron/get');
  const { version } = require(path.join(electronDir, 'package.json'));

  const zipPath = await downloadArtifact({
    version,
    artifactName: 'electron',
    platform: process.platform,
    arch: process.arch
  });

  const distDir = path.join(electronDir, 'dist');
  fs.mkdirSync(distDir, { recursive: true });
  execFileSync('unzip', ['-q', '-o', zipPath, '-d', distDir]);
  fs.writeFileSync(pathTxt, 'Electron.app/Contents/MacOS/Electron', 'utf-8');
  console.log('[IA-Use] Binario Electron pronto.');
}

ensureElectron().catch((err) => {
  console.error('[IA-Use] Errore configurazione Electron:', err);
  process.exit(1);
});
