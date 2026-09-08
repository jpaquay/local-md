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

import { BrowseResponse, FileData, SearchResponse, StatsResponse } from '../types';

const API_BASE = '/api';

export const apiService = {
  async browse(path: string = ''): Promise<BrowseResponse> {
    const res = await fetch(`${API_BASE}/browse?path=${encodeURIComponent(path)}`);
    if (!res.ok) {
      throw new Error(`Failed to browse directory: ${res.statusText}`);
    }
    return res.json();
  },

  async getFile(path: string): Promise<FileData> {
    const res = await fetch(`${API_BASE}/file?path=${encodeURIComponent(path)}`);
    if (!res.ok) {
      throw new Error(`Failed to load file: ${res.statusText}`);
    }
    return res.json();
  },

  async search(query: string, extFilter: string = 'md'): Promise<SearchResponse> {
    const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}&ext_filter=${extFilter}`);
    if (!res.ok) {
      throw new Error(`Search failed: ${res.statusText}`);
    }
    return res.json();
  },

  async getStats(): Promise<StatsResponse> {
    const res = await fetch(`${API_BASE}/stats`);
    if (!res.ok) {
      throw new Error(`Failed to fetch stats: ${res.statusText}`);
    }
    return res.json();
  }
};
