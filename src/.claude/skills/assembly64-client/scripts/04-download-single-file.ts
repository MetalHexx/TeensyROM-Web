/**
 * Reference script for the assembly64-client skill — demonstrates downloading a single
 * binary file correctly. Not production code. See 01-presets.ts for the run command
 * pattern.
 *
 * IMPORTANT: getFile1() is typed Promise<string> and decodes non-JSON responses via
 * response.text(), which corrupts binary bytes. Use getFile1Raw() and read
 * response.raw.arrayBuffer() yourself instead — see WORKFLOWS.md "Binary downloads".
 */
import * as fs from 'fs';
import * as path from 'path';
import { Configuration, SearchFacadeApiService } from '../../../../libs/data-access/asm-64-client/src/lib/index';

const configuration = new Configuration({
  headers: { 'client-id': process.env.ASM64_CLIENT_ID ?? 'swagger' },
});

async function main() {
  const searchApi = new SearchFacadeApiService(configuration);

  // Nice_Tune_07.sid: itemId=4294718104, categoryId=20, fileId=0 (the entry's own `id`
  // from getContentEntry1 — see 03-content-entries.ts).
  const response = await searchApi.getFile1Raw({ itemId: '4294718104', categoryId: 20, fileId: '0' });

  console.log('status:', response.raw.status);
  console.log('content-type:', response.raw.headers.get('content-type'));

  const buffer = Buffer.from(await response.raw.arrayBuffer());
  console.log('bytes received:', buffer.length);
  console.log('magic (should be PSID for a SID tune):', buffer.subarray(0, 4).toString('ascii'));

  const outPath = path.join(process.env.TEMP ?? '.', 'Nice_Tune_07.sid');
  fs.writeFileSync(outPath, buffer);
  console.log('wrote file to:', outPath);
}

main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
