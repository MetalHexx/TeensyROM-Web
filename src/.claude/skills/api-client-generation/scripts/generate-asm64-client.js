import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { rmSync, readdirSync, readFileSync, writeFileSync, renameSync } from 'fs';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Paths relative to this script location in .claude/skills/api-client-generation/scripts/
const config = {
  specUrl: 'https://hackerswithstyle.se/leet/v3/api-docs',
  outputDir: join(__dirname, '../../../../libs/data-access/asm-64-client/src/lib'),
  generator: 'typescript-fetch',
  additionalProps: {
    withSeparateModelsAndApi: true,
  },
};

async function main() {
  let specTempPath;
  try {
    const additionalProps = {
      ...config.additionalProps,
      withSeparateModelsAndApi: config.additionalProps.withSeparateModelsAndApi.toString(),
    };
    const additionalPropsStr = buildAdditionalPropsString(additionalProps);

    specTempPath = await fetchSpecToTempFile(config.specUrl, 15000);

    cleanOutputDirectory(config.outputDir);
    // openapi-generator-cli resolves $refs via a Java URI parser, which chokes on
    // Windows backslashes (e.g. "Illegal character in opaque part") — forward slashes
    // work on both platforms for this CLI argument.
    const specPathForCli = specTempPath.replace(/\\/g, '/');
    generateOpenApiClient(specPathForCli, config.outputDir, config.generator, additionalPropsStr);
    renameApiServiceClasses(config.outputDir);
    patchApiBarrelFile(config.outputDir);

    console.log('Assembly64 OpenAPI client generation completed successfully!');
  } catch (error) {
    console.error('Error generating Assembly64 OpenAPI client:', error);
    process.exit(1);
  } finally {
    if (specTempPath) {
      try {
        rmSync(specTempPath, { force: true });
      } catch {
        // best effort cleanup
      }
    }
  }
}

async function fetchSpecToTempFile(specUrl, timeoutMs) {
  console.log(`Fetching Assembly64 OpenAPI spec from ${specUrl}...`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(specUrl, { signal: controller.signal });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(
        `Timed out after ${timeoutMs}ms fetching the Assembly64 OpenAPI spec from hackerswithstyle.se. The external server may be down or unreachable.`
      );
    }
    throw new Error(
      `Failed to reach hackerswithstyle.se to fetch the Assembly64 OpenAPI spec: ${error.message}`
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(
      `Assembly64 OpenAPI spec endpoint returned ${response.status} ${response.statusText}.`
    );
  }

  const text = await response.text();
  let spec;
  try {
    spec = JSON.parse(text);
  } catch {
    throw new Error(
      'Assembly64 OpenAPI spec endpoint did not return valid JSON. The endpoint may have changed shape.'
    );
  }

  console.log(`Fetched spec: ${spec.info?.title ?? 'unknown title'} v${spec.info?.version ?? 'unknown'}`);

  const tempPath = join(tmpdir(), `asm64-openapi-spec-${Date.now()}.json`);
  writeFileSync(tempPath, text, 'utf8');
  return tempPath;
}

function buildAdditionalPropsString(additionalProps) {
  return Object.entries(additionalProps)
    .map(([key, value]) => `${key}=${value}`)
    .join(',');
}

function cleanOutputDirectory(outputDir) {
  console.log('Cleaning output directory...');
  rmSync(outputDir, { recursive: true, force: true });
}

function generateOpenApiClient(specPath, outputDir, generator, additionalPropsStr) {
  console.log('Generating OpenAPI client...');
  const command = `openapi-generator-cli generate \
    -i ${specPath} \
    -g ${generator} \
    -o ${outputDir} \
    --skip-validate-spec \
    --additional-properties=${additionalPropsStr}`;
  execSync(command, { stdio: 'inherit' });
}

function renameApiServiceClasses(outputDir) {
  console.log('Renaming API classes from *Api to *ApiService...');
  const apisDir = join(outputDir, 'apis');
  const files = readdirSync(apisDir);

  for (const file of files) {
    if (!file.endsWith('Api.ts') || file === 'index.ts') continue;

    const fullPath = join(apisDir, file);
    const content = readFileSync(fullPath, 'utf8');
    const match = content.match(/export class (\w+Api)\b/);

    if (!match) continue;

    const originalClassName = match[1];
    const newClassName = originalClassName.replace(/Api$/, 'ApiService');
    const updatedContent = content.replace(
      new RegExp(`\\b${originalClassName}\\b`, 'g'),
      newClassName
    );

    writeFileSync(fullPath, updatedContent, 'utf8');

    const newFilename = file.replace('Api.ts', 'ApiService.ts');
    renameSync(fullPath, join(apisDir, newFilename));
  }

  console.log('Renaming complete!');
}

function patchApiBarrelFile(outputDir) {
  console.log('Patching apis/index.ts to use renamed *ApiService files and class names...');
  const apisDir = join(outputDir, 'apis');
  const indexTsPath = join(apisDir, 'index.ts');

  if (!indexTsPath || !indexTsPath.endsWith('index.ts')) {
    console.warn('apis/index.ts path not valid or missing.');
    return;
  }

  let content = readFileSync(indexTsPath, 'utf8');

  // Replace import/export paths: ./DevicesApi -> ./DevicesApiService
  content = content.replace(/\.\/(\w+)Api'/g, "./$1ApiService'");
  content = content.replace(/\.\/(\w+)Api"/g, './$1ApiService"');

  // Replace class references: DevicesApi -> DevicesApiService
  content = content.replace(/(\w+)Api(\s|$|,|;)/g, '$1ApiService$2');

  writeFileSync(indexTsPath, content, 'utf8');
  console.log('apis/index.ts updated successfully!');
}

main();
