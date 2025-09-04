import 'dotenv/config';
import { createWriteStream } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';
import { MetadataField } from './types/MetaDataField.js';



type QueryV2Response = {
  data: any[]; // can be array-of-arrays OR array-of-objects
  done: boolean;
  nextBatchId?: string;
  queryId?: string;
  startTime?: string;
  endTime?: string;
  rowCount?: number;
  metadata: Record<string, MetadataField>;
};

const INSTANCE_URL = mustGet('SF_INSTANCE_URL');
const API_VERSION = process.env.SF_API_VERSION || 'v64.0';
const DATASPACE = mustGet('SF_DATASPACE');
const ACCESS_TOKEN = mustGet('SF_ACCESS_TOKEN');
const SQL = mustGet('QUERY_SQL');
const OUTPUT_CSV = process.env.OUTPUT_CSV || `./export_${Date.now()}.csv`;

function mustGet(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`[config] Missing required env: ${name}`);
    process.exit(1);
  }
  return v;
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  // quote if contains comma, quote, newline
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function getHeaderOrder(metadata: Record<string, MetadataField>): string[] {
  // sort by placeInOrder ascending (0..N)
  return Object.entries(metadata)
    .sort((a, b) => a[1].placeInOrder - b[1].placeInOrder)
    .map(([name]) => name);
}

function rowToOrderedArray(row: any, headers: string[]): unknown[] {
  if (Array.isArray(row)) return row;
  // if object-style row, map by header names
  return headers.map(h => row[h]);
}

async function run(): Promise<void> {
  const outPath = resolve(process.cwd(), OUTPUT_CSV);
  const outDir = dirname(outPath);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const ws = createWriteStream(outPath, { encoding: 'utf8' });

  // 1) First page
  const first = await postQuery(SQL);
  const headers = getHeaderOrder(first.metadata);

  // write header row
  ws.write(headers.map(csvEscape).join(',') + '\n');

  // write first page
  writeRows(ws, first.data, headers);

  // 2) Page while done === false
  let next = first.nextBatchId;
  while (first.done === false && next) {
    const page = await getNextBatch(next);
    writeRows(ws, page.data, headers);
    if (page.done) break;
    next = page.nextBatchId;
  }

  ws.end();
  console.log(`✅ Wrote CSV to ${outPath}`);
}

function writeRows(ws: NodeJS.WritableStream, rows: any[], headers: string[]) {
  for (const r of rows) {
    const ordered = rowToOrderedArray(r, headers);
    const line = ordered.map(csvEscape).join(',');
    ws.write(line + '\n');
  }
}

async function postQuery(sql: string): Promise<QueryV2Response> {
  const url = `${INSTANCE_URL}/services/data/${API_VERSION}/ssot/queryv2?dataspace=${encodeURIComponent(DATASPACE)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({ sql })
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Query POST failed ${res.status}: ${text}`);
  }
  return (await res.json()) as QueryV2Response;
}

async function getNextBatch(nextBatchId: string): Promise<QueryV2Response> {
  const url = `${INSTANCE_URL}/services/data/${API_VERSION}/ssot/queryv2/${encodeURIComponent(nextBatchId)}?dataspace=${encodeURIComponent(DATASPACE)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Accept': 'application/json'
    }
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Query NEXT failed ${res.status}: ${text}`);
  }
  return (await res.json()) as QueryV2Response;
}

// Node 18+ has global fetch. If running older Node, install undici or node-fetch.
run().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
