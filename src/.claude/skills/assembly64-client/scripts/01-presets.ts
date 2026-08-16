/**
 * Reference script for the assembly64-client skill — demonstrates discovering the
 * AQL query vocabulary via SearchFacadeApiService.presets(). Not production code.
 *
 * Run (from the `src/` repo root — see WORKFLOWS.md "Running a script on Windows"):
 *   npx tsc .claude/skills/assembly64-client/scripts/01-presets.ts \
 *     --outDir /tmp/asm64-build --module commonjs --target es2020 \
 *     --moduleResolution node --esModuleInterop --skipLibCheck --rootDir .
 *   ASM64_CLIENT_ID=<your-registered-client-id> node /tmp/asm64-build/.claude/skills/assembly64-client/scripts/01-presets.js
 */
import { Configuration, SearchFacadeApiService } from '../../../../libs/data-access/asm-64-client/src/lib/index';

const configuration = new Configuration({
  headers: { 'client-id': process.env.ASM64_CLIENT_ID ?? 'swagger' },
});

async function main() {
  const searchApi = new SearchFacadeApiService(configuration);
  const presets = await searchApi.presets();
  console.log('--- presets (AQL vocabulary: repo/category/subcat/rating/type/date/latest/sort/order) ---');
  console.log(JSON.stringify(presets, null, 2));
}

main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
