/**
 * Reference script for the assembly64-client skill — demonstrates downloading a whole
 * release as a zip (SearchAdvancedFacadeApiService.getFile — no fileId needed). Not
 * production code. See 01-presets.ts for the run command pattern, and
 * 04-download-single-file.ts for why this uses the *Raw + arrayBuffer pattern.
 *
 * Searches the C64.org "intros" subcategory (deliberately tiny cracktro-style intros)
 * and downloads the first hit.
 */
import * as fs from 'fs';
import * as path from 'path';
import { Configuration, SearchFacadeApiService, SearchAdvancedFacadeApiService } from '../../../../libs/data-access/asm-64-client/src/lib/index';

const configuration = new Configuration({
  headers: { 'client-id': process.env.ASM64_CLIENT_ID ?? 'swagger' },
});

async function main() {
  const searchApi = new SearchFacadeApiService(configuration);
  const advancedApi = new SearchAdvancedFacadeApiService(configuration);

  const intros = await searchApi.aqlQuery2({ offset: 0, limit: 5, query: 'category:intros' });
  const pick = intros[0];
  if (pick?.id == null || pick?.category == null) {
    throw new Error('No usable result to download');
  }
  console.log(`picked: "${pick.name}" (itemId=${pick.id}, categoryId=${pick.category})`);

  const response = await advancedApi.getFileRaw({ itemId: pick.id, categoryId: pick.category });
  console.log('status:', response.raw.status);
  console.log('content-type:', response.raw.headers.get('content-type'));

  const buffer = Buffer.from(await response.raw.arrayBuffer());
  console.log('bytes received:', buffer.length);
  console.log('magic (should be PK.. for a zip):', buffer.subarray(0, 4).toString('hex'));

  const safeName = String(pick.name).replace(/[^a-z0-9_-]+/gi, '_');
  const outPath = path.join(process.env.TEMP ?? '.', `${safeName}.zip`);
  fs.writeFileSync(outPath, buffer);
  console.log('wrote file to:', outPath);
}

main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
