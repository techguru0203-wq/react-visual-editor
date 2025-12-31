export class GlobalStore {
  private records: Map<string, any>;
  constructor() {
    this.records = new Map<string, any>();
  }

  set(key: string, val: any) {
    this.records.set(key, val);
  }
  get(key: string) {
    return this.records.get(key);
  }

  delete(key: string) {
    this.records.delete(key);
  }

  clear() {
    this.records.clear();
  }
}

export const GlobalStoreInst = new GlobalStore();
