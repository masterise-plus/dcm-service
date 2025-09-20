import { createWriteStream } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { MetadataItem } from '../domain/models/QueryResponse.js';

export class CsvWriter {
  private filePath: string;
  private writeStream: NodeJS.WritableStream | null = null;

  constructor(filePath: string) {
    this.filePath = resolve(process.cwd(), filePath);
    this.ensureDirectoryExists();
  }

  private ensureDirectoryExists(): void {
    const outDir = dirname(this.filePath);
    if (!existsSync(outDir)) {
      mkdirSync(outDir, { recursive: true });
    }
  }

  open(): void {
    this.writeStream = createWriteStream(this.filePath, { encoding: 'utf8' });
  }

  writeHeaders(headers: string[]): void {
    if (!this.writeStream) {
      throw new Error('Write stream not opened. Call open() first.');
    }
    this.writeStream.write(headers.map(this.escapeCsv).join(',') + '\n');
  }

  writeRow(row: any[], headers: string[]): void {
    if (!this.writeStream) {
      throw new Error('Write stream not opened. Call open() first.');
    }
    
    const ordered = this.rowToOrderedArray(row, headers);
    const line = ordered.map(this.escapeCsv).join(',');
    this.writeStream.write(line + '\n');
  }

  close(): void {
    if (this.writeStream) {
      this.writeStream.end();
      console.log(`✅ Wrote CSV to ${this.filePath}`);
    }
  }

  private escapeCsv(value: unknown): string {
    if (value === null || value === undefined) return '';
    const str = String(value);
    
    // Quote if contains comma, quote, or newline
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    
    return str;
  }

  private rowToOrderedArray(row: any, headers: string[]): unknown[] {
    if (Array.isArray(row)) return row;
    
    // If object-style row, map by header names
    return headers.map(header => row[header]);
  }

  static getHeadersFromMetadata(metadata: MetadataItem[]): string[] {
    // Extract names from metadata array to use as CSV headers
    return metadata.map(item => item.name);
  }
}
