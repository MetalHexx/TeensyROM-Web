/**
 * Reference script for the assembly64-client skill — demonstrates an AQL search via
 * SearchFacadeApiService.aqlQuery2 (paginated: offset + limit). Not production code.
 * See 01-presets.ts for the run command pattern.
 */
import { Configuration, SearchFacadeApiService } from '../../../../libs/data-access/asm-64-client/src/lib/index';

const configuration = new Configuration({
  headers: { 'client-id': process.env.ASM64_CLIENT_ID ?? 'swagger' },
});

async function main() {
  const searchApi = new SearchFacadeApiService(configuration);
  const results = await searchApi.aqlQuery2({ offset: 0, limit: 5, query: 'repo:hvsc category:music' });
  console.log('--- aqlQuery2(repo:hvsc category:music) ---');
  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
