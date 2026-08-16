/**
 * Reference script for the assembly64-client skill — surveys a few more AQL facets in
 * one pass (type:crt, type:prg), an item's Metadata, and the static compo-types table.
 * Not production code. See 01-presets.ts for the run command pattern.
 *
 * Sequential awaits with a short pause between calls — deliberately not run
 * concurrently, to stay polite to the live third-party API.
 */
import {
  Configuration,
  SearchFacadeApiService,
  SearchAdvancedFacadeApiService,
  MetadataFacadeApiService,
} from '../../../../libs/data-access/asm-64-client/src/lib/index';

const configuration = new Configuration({
  headers: { 'client-id': process.env.ASM64_CLIENT_ID ?? 'swagger' },
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const searchApi = new SearchFacadeApiService(configuration);
  const advancedApi = new SearchAdvancedFacadeApiService(configuration);
  const metadataApi = new MetadataFacadeApiService(configuration);

  console.log('=== aqlQuery2(type:crt category:games) ===');
  const crtResults = await searchApi.aqlQuery2({ offset: 0, limit: 5, query: 'type:crt category:games' });
  console.log(JSON.stringify(crtResults, null, 2));
  await sleep(400);

  if (crtResults[0]?.id != null && crtResults[0]?.category != null) {
    console.log('=== getContentEntry1 for first CRT result ===');
    const crtEntry = await searchApi.getContentEntry1({ itemId: crtResults[0].id, categoryId: crtResults[0].category });
    console.log(JSON.stringify(crtEntry, null, 2));
    await sleep(400);
  }

  console.log('=== aqlQuery2(type:prg category:games) ===');
  const prgResults = await searchApi.aqlQuery2({ offset: 0, limit: 5, query: 'type:prg category:games' });
  console.log(JSON.stringify(prgResults, null, 2));
  await sleep(400);

  if (prgResults[0]?.id != null && prgResults[0]?.category != null) {
    console.log('=== getContentEntry1 for first PRG result ===');
    const prgEntry = await searchApi.getContentEntry1({ itemId: prgResults[0].id, categoryId: prgResults[0].category });
    console.log(JSON.stringify(prgEntry, null, 2));
    await sleep(400);
  }

  console.log('=== getMetadata(id=4294718104, category=20) [Nice_Tune_07 — casual upload, sparse fields] ===');
  const metadata = await metadataApi.getMetadata({ id: '4294718104', category: 20 });
  console.log(JSON.stringify(metadata, null, 2));
  await sleep(400);

  console.log('=== getCompoTypes() [static demoscene compo-category reference table] ===');
  const compoTypes = await advancedApi.getCompoTypes();
  console.log(JSON.stringify(compoTypes, null, 2));
}

main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
