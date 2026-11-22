import type { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'fs';
import path from 'path';

const STORAGE_FILE = path.join('/tmp', 'classroom_persistent_storage.json');

let memoryStore: Record<string, string> = {};

function loadStore(): Record<string, string> {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const raw = fs.readFileSync(STORAGE_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        memoryStore = { ...memoryStore, ...parsed };
      }
    }
  } catch {}
  return memoryStore;
}

function saveStore(store: Record<string, string>): void {
  memoryStore = store;
  try {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch {}
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const store = loadStore();

  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      entries: store,
    });
  }

  if (req.method === 'POST') {
    const { entries = {}, deletedKeys = [] } = req.body || {};

    if (Array.isArray(deletedKeys)) {
      for (const k of deletedKeys) {
        if (typeof k === 'string') {
          delete store[k];
        }
      }
    }

    if (entries && typeof entries === 'object') {
      for (const [k, v] of Object.entries(entries)) {
        if (typeof k === 'string' && typeof v === 'string') {
          store[k] = v;
        }
      }
    }

    saveStore(store);

    return res.status(200).json({
      success: true,
      entries: store,
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
