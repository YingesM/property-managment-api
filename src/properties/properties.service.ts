/* eslint-disable prettier/prettier */
import { Injectable, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs-extra';
import * as path from 'path';
import { Mutex } from 'async-mutex';
import { createReadStream, createWriteStream } from 'fs';
import * as readline from 'readline';

@Injectable()
export class PropertiesService implements OnModuleInit, OnModuleDestroy {
  private readonly filePath: string;
  private cache: Record<string, string> = {}; // In-memory cache of key-value pairs
  private isFileLoaded = false;
  private debounceWriteTimeout: NodeJS.Timeout = null;
  private readonly debounceTime: number;
  private readonly maxCacheSize: number; // Maximum cache size before offloading
  private readonly mutex = new Mutex(); // Mutex for consistent file writes
  private fileWatcher: fs.FSWatcher = null;

  constructor() {
    this.filePath = path.resolve(__dirname, '../../data/properties.txt');
    this.debounceTime = 500; // Default debounce time
    this.maxCacheSize = 1000; // max cache limit 
  }

  async onModuleInit(): Promise<void> {
    await this.ensureFileExists();
    await this.loadFileIfNeeded();
    this.setupFileWatcher(); 
  }

  async onModuleDestroy(): Promise<void> {
    if (this.fileWatcher) {
      this.fileWatcher.close(); // Stop file watcher
    }
    await this.flushCacheToFile(); // Flush cache to disk on shutdown
  }
 
  async getAllProperties(): Promise<Record<string, string>> {
    await this.loadFileIfNeeded();
    return this.cache;
  }

  async getProperty(key: string): Promise<string> {
    await this.loadFileIfNeeded();
    const value = this.cache[key];
    if (!value) {
      throw new NotFoundException(`Property with key ${key} not found`);
    }
    return value;
  }

  async addProperty(key: string, value: string): Promise<void> {
    await this.loadFileIfNeeded();
    if (this.cache[key]) {
      throw new Error(`Property with key ${key} already exists`);
    }
    this.cache[key] = value;
    this.manageCacheSize();
    this.debounceWriteFile();
  }

  async updateProperty(key: string, value: string): Promise<void> {
    await this.loadFileIfNeeded();
    if (!this.cache[key]) {
      throw new NotFoundException(`Property with key ${key} not found`);
    }
    this.cache[key] = value;
    this.debounceWriteFile();
  }

  async deleteProperty(key: string): Promise<void> {
    await this.loadFileIfNeeded();
    if (!this.cache[key]) {
      throw new NotFoundException(`Property with key ${key} not found`);
    }
    delete this.cache[key];
    this.debounceWriteFile();
  }

  // Ensure the properties file exists; create it if it doesn't
  private async ensureFileExists(): Promise<void> {
    if (!await fs.pathExists(this.filePath)) {
      await fs.writeFile(this.filePath, '', 'utf-8'); // Create an empty file
    }
  }

  private setupFileWatcher(): void {
    this.fileWatcher = fs.watch(this.filePath, async (eventType) => {
      if (eventType === 'change') {
        console.log('Properties file changed externally, reloading cache.');
        await this.reloadFileIfModified();
      }
    });
  }

  private async reloadFileIfModified(): Promise<void> {
    const fileStats = await fs.stat(this.filePath);
    if (fileStats.mtimeMs > Date.now() - 1000) { // 1 second grace period
      this.isFileLoaded = false;
      await this.loadFileIfNeeded();
    }
  }

  private debounceWriteFile(): void {
    if (this.debounceWriteTimeout) {
      clearTimeout(this.debounceWriteTimeout);
    }
    this.debounceWriteTimeout = setTimeout(() => this.writeFile(), this.debounceTime);
  }

  private async writeFile(): Promise<void> {
    const content = Object.entries(this.cache)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Stream the write operation for large files
    await this.mutex.runExclusive(async () => {
      try {
        const writeStream = createWriteStream(this.filePath);
        writeStream.write(content);
        writeStream.end();
      } catch (error) {
        console.error('Error writing properties file:', error);
        throw new Error('Failed to write properties file');
      }
    });
  }

  private async loadFileIfNeeded(): Promise<void> {
    if (!this.isFileLoaded) {
      await this.loadFile();
    }
  }

  // Stream-based file loading to prevent memory overload
  private async loadFile(): Promise<void> {
    try {
      const readStream = createReadStream(this.filePath);
      const rl = readline.createInterface({
        input: readStream,
        crlfDelay: Infinity,
      });

      const tempCache: Record<string, string> = {};

      for await (const line of rl) {
        if (line.trim()) {
          const [key, ...rest] = line.split('=', 2);
          const value = rest.join('=');
          tempCache[key] = value;
        }
      }

      this.cache = tempCache;
      this.isFileLoaded = true;
    } catch (error) {
      console.error('Error loading properties file:', error);
      throw new Error('Failed to load properties file');
    }
  }

  private async flushCacheToFile(): Promise<void> {
    if (this.debounceWriteTimeout) {
      clearTimeout(this.debounceWriteTimeout);
    }
    await this.writeFile();
  }

  // Cache size management: ensures cache doesn't grow indefinitely
  private manageCacheSize(): void {
    if (Object.keys(this.cache).length > this.maxCacheSize) {
      console.warn('Cache size exceeded limit, clearing cache.');
      this.cache = {};
      this.isFileLoaded = false;
    }
  }
}
