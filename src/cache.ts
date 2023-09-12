import { ConfigValueType } from "./config";

export class GCacheEntry {
  typ: ConfigValueType;
  key: string;
  value: any;

  constructor(typ: ConfigValueType, key: string, value: any) {
    this.typ = typ;
    this.key = key;
    this.value = value;
  }
}

export class GCache {
  cache: {[key: string]: GCacheEntry};

  constructor() {
    this.cache = {};
  }

  set(cacheEntry: GCacheEntry) {
    this.cache[cacheEntry.key] = cacheEntry;
  }

  get(key: string): GCacheEntry {
    return this.cache[key];
  }
}
