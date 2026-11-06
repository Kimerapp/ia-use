const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function getPlatformExecutable(platform) {
  switch (platform) {
    case 'darwin':
    case 'mas':
      return 'Electron.app/Contents/MacOS/Electron';
    case 'win32':
      return 'electron.exe';
    default:
      return 'electron';
  }
}

async function ensureElectron() {
  const electronDir = path.join(__dirname, '..', 'node_modules', 'electron');
  if (!fs.existsSync(electronDir)) return;

  const pathTxt = path.join(electronDir, 'path.txt');
  const relExe = getPlatformExecutable(process.platform);
  const binPath = path.join(electronDir, 'dist', relExe);

  if (fs.existsSync(pathTxt) && fs.existsSync(binPath)) {
    return;
  }

  console.log('[IA-Use] Configurazione binario Electron per ' + process.platform + '...');
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

  if (process.platform === 'win32') {
    execFileSync('powershell', [
      '-NoProfile',
      '-Command',
      `Expand-Archive -Force -Path "${zipPath}" -DestinationPath "${distDir}"`
    ]);
  } else {
    execFileSync('unzip', ['-q', '-o', zipPath, '-d', distDir]);
  }

  fs.writeFileSync(pathTxt, relExe, 'utf-8');
  console.log('[IA-Use] Binario Electron pronto.');
}

ensureElectron().catch((err) => {
  console.error('[IA-Use] Errore configurazione Electron:', err);
  process.exit(1);
});
