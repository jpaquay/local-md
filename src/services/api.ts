/*
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { BrowseResponse, FileData, SearchResponse, StatsResponse, ConfigResponse } from '../types';

function getApiBase(): string {
  const path = window.location.pathname;
  const match = path.match(/^(\/port\/\d+)/);
  if (match) {
    return `${match[1]}/api`;
  }
  return './api';
}

export const apiService = {
  async browse(path: string = '', showHidden: boolean = false): Promise<BrowseResponse> {
    const base = getApiBase();
    const res = await fetch(`${base}/browse?path=${encodeURIComponent(path)}&show_hidden=${showHidden}`);
    if (!res.ok) {
      throw new Error(`Failed to browse directory: ${res.statusText}`);
    }
    return res.json();
  },

  async getFile(path: string): Promise<FileData> {
    const base = getApiBase();
    const res = await fetch(`${base}/file?path=${encodeURIComponent(path)}`);
    if (!res.ok) {
      throw new Error(`Failed to load file: ${res.statusText}`);
    }
    return res.json();
  },

  async search(query: string, extFilter: string = 'md'): Promise<SearchResponse> {
    const base = getApiBase();
    const res = await fetch(`${base}/search?q=${encodeURIComponent(query)}&ext_filter=${extFilter}`);
    if (!res.ok) {
      throw new Error(`Search failed: ${res.statusText}`);
    }
    return res.json();
  },

  async getStats(): Promise<StatsResponse> {
    const base = getApiBase();
    const res = await fetch(`${base}/stats`);
    if (!res.ok) {
      throw new Error(`Failed to fetch stats: ${res.statusText}`);
    }
    return res.json();
  },

  async getConfig(): Promise<ConfigResponse> {
    const base = getApiBase();
    const res = await fetch(`${base}/config`);
    if (!res.ok) {
      throw new Error(`Failed to fetch config: ${res.statusText}`);
    }
    return res.json();
  },

  async setRoot(rootPath: string, pinAsDefault: boolean = false): Promise<{ status: string; current_root: string; display_root: string; is_locked?: boolean }> {
    const base = getApiBase();
    const res = await fetch(`${base}/config/root`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ root_path: rootPath, pin_as_default: pinAsDefault }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `Failed to change root directory`);
    }
    return res.json();
  },

  async pinRootConfig(path: string, action: 'pin' | 'unpin' | 'set_default' | 'toggle_lock'): Promise<ConfigResponse> {
    const base = getApiBase();
    const res = await fetch(`${base}/config/pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, action }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `Failed to update pin configuration`);
    }
    return res.json();
  }
};
