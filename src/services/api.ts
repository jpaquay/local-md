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
