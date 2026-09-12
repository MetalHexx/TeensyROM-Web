const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const sourceRoot = path.resolve(__dirname, '../../..');
const apiProject = path.join(sourceRoot, 'apps/api/src/TeensyRom.Api/TeensyRom.Api.csproj');
const frontendOutput = path.join(sourceRoot, 'dist/apps/teensyrom-ui/browser');
const wwwroot = path.join(sourceRoot, 'apps/api/src/TeensyRom.Api/wwwroot');
const backendOutput = path.join(sourceRoot, 'apps/teensyrom-desktop/resources/backend');

function command(name) {
  return process.platform === 'win32' ? `${name}.cmd` : name;
}

function run(name, args, options = {}) {
  const result = spawnSync(command(name), args, {
    cwd: sourceRoot,
    stdio: 'inherit',
    ...options,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function runtimeIdentifier() {
  const architecture = process.arch === 'arm64' ? 'arm64' : 'x64';
  switch (process.platform) {
    case 'darwin':
      return `osx-${architecture}`;
    case 'win32':
      return `win-${architecture}`;
    case 'linux':
      return `linux-${architecture}`;
    default:
      throw new Error(`Unsupported desktop platform: ${process.platform}`);
  }
}

function copyFrontend() {
  if (!fs.existsSync(frontendOutput)) {
    throw new Error(`Expected frontend build output at ${frontendOutput}.`);
  }

  fs.rmSync(wwwroot, { recursive: true, force: true });
  fs.mkdirSync(wwwroot, { recursive: true });
  fs.cpSync(frontendOutput, wwwroot, { recursive: true });
}

function findZipFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return findZipFiles(fullPath);
    return entry.isFile() && entry.name.toLowerCase().endsWith('.zip') ? [fullPath] : [];
  });
}

function unpackAsset(zipFile) {
  const destination = path.dirname(zipFile);
  const attempts = [
    ['unzip', ['-o', zipFile, '-d', destination]],
    ['7z', ['x', '-y', `-o${destination}`, zipFile]],
    ['tar', ['-xf', zipFile, '-C', destination]],
  ];

  for (const [tool, args] of attempts) {
    const result = spawnSync(command(tool), args, { stdio: 'ignore' });
    if (!result.error && result.status === 0) {
      fs.rmSync(zipFile);
      return;
    }
  }

  throw new Error(`Could not unpack required asset archive: ${zipFile}`);
}

run('pnpm', ['nx', 'build', 'teensyrom-ui', '--configuration=production']);
copyFrontend();

fs.rmSync(backendOutput, { recursive: true, force: true });
fs.mkdirSync(backendOutput, { recursive: true });
run('dotnet', [
  'publish',
  apiProject,
  '-c',
  'Release',
  '-r',
  runtimeIdentifier(),
  '--self-contained',
  'true',
  '-p:PublishSingleFile=false',
  '-p:SkipBuildFrontend=true',
  '-p:OpenApiGenerateDocuments=false',
  '-p:OpenApiGenerateDocumentsOnBuild=false',
  '-o',
  backendOutput,
]);

for (const zipFile of findZipFiles(backendOutput)) unpackAsset(zipFile);
