/**
 * Throwaway exploration script — NOT production code.
 *
 * `npx ts-node` doesn't work here: this repo's package.json sets "type": "module", so
 * ts-node runs it under Node's strict ESM resolver, which requires explicit file
 * extensions on every relative import — but the openapi-generator output (runtime.ts,
 * apis/*, models/*) uses extensionless imports (bundler-style), so ESM resolution fails
 * deep inside the generated code, not just in this file.
 *
 * Instead, compile this script's dependency graph to CommonJS (Node's CJS `require`
 * resolves extensionless specifiers natively) and run the plain JS output:
 *
 *   npx tsc libs/data-access/asm-64-client/explore/explore.ts \
 *     --outDir /tmp/asm64-explore-build --module commonjs --target es2020 \
 *     --moduleResolution node --esModuleInterop --skipLibCheck --rootDir .
 *   ASM64_CLIENT_ID=<your-registered-client-id> node /tmp/asm64-explore-build/libs/data-access/asm-64-client/explore/explore.js
 *
 * Requires ASM64_CLIENT_ID to be set in the shell environment (never committed).
 */
import { Configuration, SearchFacadeApiService, MetadataFacadeApiService } from '../src/lib/index';

const configuration = new Configuration({
  headers: { 'client-id': process.env.ASM64_CLIENT_ID ?? 'swagger' },
});

async function main() {
  const searchApi = new SearchFacadeApiService(configuration);
  const metadataApi = new MetadataFacadeApiService(configuration);

  const categories = await searchApi.getCategories();
  console.log('--- getCategories ---');
  console.log(JSON.stringify(categories, null, 2));

  const flipEntries = await metadataApi.getAllFlipEntries();
  console.log('--- getAllFlipEntries ---');
  console.log(JSON.stringify(flipEntries.slice(0, 5), null, 2));
}

main().catch((error) => {
  console.error('Exploration script failed:', error);
  process.exit(1);
});
