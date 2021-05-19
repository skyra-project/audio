import { rm } from 'node:fs/promises';

const distFolder = new URL('../dist/', import.meta.url);

await rm(distFolder, { recursive: true, force: true });
