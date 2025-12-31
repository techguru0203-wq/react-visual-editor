import { lazy } from 'react';

export default function lazyLoad(path: string, namedExport?: string) {
  return lazy(async () => {
    const promise = import(path);
    if (namedExport) {
      return promise.then((module) => ({ default: module[namedExport] }));
    }
    return promise;
  });
}
