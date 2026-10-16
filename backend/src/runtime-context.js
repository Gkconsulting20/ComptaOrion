import { AsyncLocalStorage } from 'node:async_hooks';

// Each Worker request owns its connections and storage binding. No sockets may
// leak into another request in the Workers runtime.
export const runtimeContext = new AsyncLocalStorage();
