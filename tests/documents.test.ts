import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { createPdf } from '../src/documents.js';

test('createPdf produces a parseable, paginated PDF within artifact bounds', async () => {
  const bytes = await createPdf('Quarterly report\n\n' + ('A paragraph with useful evidence. '.repeat(900)));
  const parsed = await PDFDocument.load(bytes);
  assert.ok(parsed.getPageCount() > 1);
  assert.ok(bytes.byteLength <= 200_000);
});

test('createPdf rejects oversized, unsupported, and right-to-left input clearly', async () => {
  await assert.rejects(createPdf('x'.repeat(60_001)), /60,000-character limit/);
  await assert.rejects(createPdf('emoji 😀'), /Unsupported PDF character.*U\+1F600/);
  await assert.rejects(createPdf('مرحبا'), /Right-to-left text is unsupported/);
});
