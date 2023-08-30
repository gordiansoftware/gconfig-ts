import { GConfigValueType } from "./config";

export class GCacheEntry {
  typ: GConfigValueType;
  key: string;
  value: any;
  changeCallbackFn: CallableFunction;

  constructor(typ: GConfigValueType, key: string, value: any, changeCallbackFn: CallableFunction) {
    this.typ = typ;
    this.key = key;
    this.value = value;
    this.changeCallbackFn = changeCallbackFn;
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
