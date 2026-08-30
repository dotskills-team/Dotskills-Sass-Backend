import { createCsvStream } from './csv-stream.util';

async function drain(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

describe('createCsvStream', () => {
  it('prefixes the output with a UTF-8 BOM so Excel auto-detects Bangla text correctly', async () => {
    const stream = createCsvStream<{ name: string }>(
      [{ header: 'Name', value: (r) => r.name }],
      async (skip) => (skip === 0 ? [{ name: 'চাল' }] : []),
    );

    const output = await drain(stream);

    expect(output.charCodeAt(0)).toBe(0xfeff);
    expect(output).toContain('চাল');
  });

  it('escapes fields containing commas, quotes, or newlines per CSV rules', async () => {
    const stream = createCsvStream<{ note: string }>(
      [{ header: 'Note', value: (r) => r.note }],
      async (skip) => (skip === 0 ? [{ note: 'a, "quoted", value' }] : []),
    );

    const output = await drain(stream);
    const dataLine = output.split('\r\n')[1];

    expect(dataLine).toBe('"a, ""quoted"", value"');
  });

  it('renders null/undefined values as empty fields, not the literal "null"/"undefined"', async () => {
    const stream = createCsvStream<{ v: string | null }>(
      [{ header: 'V', value: (r) => r.v }],
      async (skip) => (skip === 0 ? [{ v: null }] : []),
    );

    const output = await drain(stream);
    expect(output.split('\r\n')[1]).toBe('');
  });

  it('pulls multiple batches via fetchPage(skip, take) until an empty batch ends the stream', async () => {
    const allRows = Array.from({ length: 5 }, (_, i) => ({ id: i }));
    const fetchPage = jest.fn(async (skip: number, take: number) => allRows.slice(skip, skip + take));

    const stream = createCsvStream<{ id: number }>([{ header: 'Id', value: (r) => r.id }], fetchPage, 2);
    const output = await drain(stream);

    const lines = output.replace(/^﻿/, '').split('\r\n').filter(Boolean);
    expect(lines).toEqual(['Id', '0', '1', '2', '3', '4']);
    expect(fetchPage).toHaveBeenCalledWith(0, 2);
    expect(fetchPage).toHaveBeenCalledWith(2, 2);
    expect(fetchPage).toHaveBeenCalledWith(4, 2);
  });

  it('produces just the header row (plus BOM) for an empty result set', async () => {
    const stream = createCsvStream<{ id: number }>([{ header: 'Id', value: (r) => r.id }], async () => []);
    const output = await drain(stream);

    expect(output).toBe('﻿Id\r\n');
  });
});
