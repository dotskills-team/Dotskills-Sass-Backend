import { Readable } from 'node:stream';

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | boolean | null | undefined;
}

function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Builds a UTF-8-BOM-prefixed CSV stream from a paginated row source, so
 * Excel correctly auto-detects the encoding for Bangla product/customer
 * names (the same UTF-8 requirement Section ৮.৮ already established for
 * Bulk Import, reused here) and the server never buffers the full result
 * set in memory regardless of how wide a date range someone exports.
 */
export function createCsvStream<T>(
  columns: CsvColumn<T>[],
  fetchPage: (skip: number, take: number) => Promise<T[]>,
  batchSize = 500,
): Readable {
  let skip = 0;
  let headerWritten = false;
  let done = false;

  return new Readable({
    async read() {
      if (done) return;
      try {
        if (!headerWritten) {
          headerWritten = true;
          this.push(
            '﻿' +
              columns.map((c) => escapeCsvField(c.header)).join(',') +
              '\r\n',
          );
          return;
        }
        const batch = await fetchPage(skip, batchSize);
        if (batch.length === 0) {
          done = true;
          this.push(null);
          return;
        }
        skip += batch.length;
        const lines = batch
          .map((row) =>
            columns.map((c) => escapeCsvField(c.value(row))).join(','),
          )
          .join('\r\n');
        this.push(lines + '\r\n');
        if (batch.length < batchSize) {
          done = true;
          this.push(null);
        }
      } catch (err) {
        this.destroy(err as Error);
      }
    },
  });
}
