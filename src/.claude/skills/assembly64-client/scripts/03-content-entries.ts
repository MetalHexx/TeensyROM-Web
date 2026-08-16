/**
 * Reference script for the assembly64-client skill — demonstrates the single-file vs
 * multi-disk check: getContentEntry1(itemId, categoryId).contentEntry.length === 1.
 * Not production code. See 01-presets.ts for the run command pattern.
 *
 * Contrasts two known items:
 *  - Nice_Tune_07 (HVSC tune, itemId=4294718104, categoryId=20) -> 1 entry
 *  - Uncensored (CSDB demo, itemId=133934, categoryId=1) -> 4 entries (multi-disk/flip release)
 */
import { Configuration, SearchFacadeApiService } from '../../../../libs/data-access/asm-64-client/src/lib/index';

const configuration = new Configuration({
  headers: { 'client-id': process.env.ASM64_CLIENT_ID ?? 'swagger' },
});

async function main() {
  const searchApi = new SearchFacadeApiService(configuration);

  console.log('--- getContentEntry1(itemId=4294718104, categoryId=20) [Nice_Tune_07, single-file] ---');
  const single = await searchApi.getContentEntry1({ itemId: '4294718104', categoryId: 20 });
  console.log(JSON.stringify(single, null, 2));
  console.log(`entry count: ${single.contentEntry?.length}`);

  console.log('--- getContentEntry1(itemId=133934, categoryId=1) [Uncensored, multi-disk] ---');
  const multi = await searchApi.getContentEntry1({ itemId: '133934', categoryId: 1 });
  console.log(JSON.stringify(multi, null, 2));
  console.log(`entry count: ${multi.contentEntry?.length}`);
}

main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
