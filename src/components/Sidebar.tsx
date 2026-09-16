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

import React, { useState, useEffect } from 'react';
import { 
  Folder, 
  FolderOpen, 
  FileText, 
  FileCode, 
  Search, 
  ChevronRight, 
  BookOpen, 
  Clock, 
  Bookmark, 
  RefreshCw,
  FolderSync,
  Eye,
  EyeOff,
  Pin
} from 'lucide-react';
import { BrowseResponse } from '../types';
import { apiService } from '../services/api';

interface SidebarProps {
  currentPath: string;
  selectedFile: string | null;
  displayRoot: string;
  onSelectFile: (path: string) => void;
  onNavigateFolder: (path: string) => void;
  onOpenSearch: () => void;
  onOpenRootConfig: () => void;
  bookmarks: string[];
  onToggleBookmark: (path: string) => void;
  refreshTrigger: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPath,
  selectedFile,
  displayRoot,
  onSelectFile,
  onNavigateFolder,
  onOpenSearch,
  onOpenRootConfig,
  bookmarks,
  refreshTrigger,
}) => {
  const [activeTab, setActiveTab] = useState<'files' | 'recents' | 'bookmarks'>('files');
  const [browseData, setBrowseData] = useState<BrowseResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [filterText, setFilterText] = useState<string>('');
  const [showHidden, setShowHidden] = useState<boolean>(false);
  const [recentFiles, setRecentFiles] = useState<string[]>([]);
  const [totalMdFiles, setTotalMdFiles] = useState<number>(0);

  const loadDirectory = async (path: string, hidden: boolean = showHidden) => {
    setLoading(true);
    try {
      const data = await apiService.browse(path, hidden);
      setBrowseData(data);
    } catch (err) {
      console.error('Failed to browse directory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDirectory(currentPath, showHidden);
  }, [currentPath, showHidden, refreshTrigger]);

  useEffect(() => {
    apiService.getStats().then(stats => {
      setTotalMdFiles(stats.total_markdown_files);
    }).catch(console.error);

    try {
      const stored = localStorage.getItem('local_md_recents');
      if (stored) setRecentFiles(JSON.parse(stored));
    } catch (e) {
      console.error(e);
    }
  }, [refreshTrigger]);

  const filteredItems = browseData?.items.filter(item => 
    item.name.toLowerCase().includes(filterText.toLowerCase())
  ) || [];

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="sidebar-header">
        <div className="brand-title" style={{ overflow: 'hidden' }}>
          <BookOpen size={18} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
          <span style={{ whiteSpace: 'nowrap' }}>Local Markdown</span>
          <span 
            className="brand-badge" 
            onClick={onOpenRootConfig} 
            title="Click to configure or pin root directory"
            style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', maxWidth: '135px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            <Pin size={10} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayRoot}</span>
          </span>
        </div>
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
          <button 
            className="icon-btn" 
            title="Configure & Pin Root Directory" 
            onClick={onOpenRootConfig}
            style={{ padding: '5px 8px' }}
          >
            <FolderSync size={13} />
          </button>
          <button 
            className="icon-btn" 
            title="Refresh directory" 
            onClick={() => loadDirectory(currentPath, showHidden)}
            disabled={loading}
            style={{ padding: '5px 8px' }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Global Search Shortcut Button */}
      <div className="sidebar-search-btn" onClick={onOpenSearch}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Search size={14} />
          <span>Search docs...</span>
        </div>
        <span className="search-shortcut">⌘K</span>
      </div>

      {/* View Tabs */}
      <div className="sidebar-tabs">
        <button 
          className={`tab-btn ${activeTab === 'files' ? 'active' : ''}`}
          onClick={() => setActiveTab('files')}
        >
          Files
        </button>
        <button 
          className={`tab-btn ${activeTab === 'recents' ? 'active' : ''}`}
          onClick={() => setActiveTab('recents')}
        >
          Recent
        </button>
        <button 
          className={`tab-btn ${activeTab === 'bookmarks' ? 'active' : ''}`}
          onClick={() => setActiveTab('bookmarks')}
        >
          Bookmarks ({bookmarks.length})
        </button>
      </div>

      {/* Main Files Tab */}
      {activeTab === 'files' && (
        <>
          <div style={{ padding: '8px 12px 0 12px', display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input 
              type="text" 
              placeholder="Filter current folder..." 
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              style={{
                flex: 1,
                padding: '6px 10px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                fontSize: '12px',
                outline: 'none'
              }}
            />
            <button
              className={`icon-btn ${showHidden ? 'active' : ''}`}
              title={showHidden ? "Hide hidden dotfiles (e.g. .agents)" : "Show hidden dotfiles (e.g. .agents, .env.example)"}
              onClick={() => setShowHidden(prev => !prev)}
              style={{ padding: '6px 8px', flexShrink: 0 }}
            >
              {showHidden ? <Eye size={13} /> : <EyeOff size={13} />}
            </button>
          </div>

          <div className="tree-container">
            {browseData && !browseData.is_root && browseData.parent_path !== null && (
              <div 
                className="tree-item"
                onClick={() => onNavigateFolder(browseData.parent_path || '')}
              >
                <FolderOpen size={16} style={{ color: 'var(--accent-primary)' }} />
                <span className="tree-item-name" style={{ fontStyle: 'italic' }}>.. (parent folder)</span>
              </div>
            )}

            {filteredItems.map(item => {
              const isSelected = selectedFile === item.path;
              return (
                <div 
                  key={item.path}
                  className={`tree-item ${isSelected ? 'active' : ''}`}
                  onClick={() => {
                    if (item.is_dir) {
                      onNavigateFolder(item.path);
                    } else {
                      onSelectFile(item.path);
                    }
                  }}
                  title={item.path}
                >
                  {item.is_dir ? (
                    <Folder size={16} style={{ color: 'var(--warning)', minWidth: '16px' }} />
                  ) : item.is_markdown ? (
                    <FileText size={16} style={{ color: 'var(--accent-primary)', minWidth: '16px' }} />
                  ) : (
                    <FileCode size={16} style={{ color: 'var(--text-muted)', minWidth: '16px' }} />
                  )}
                  
                  <span className="tree-item-name">{item.name}</span>
                  
                  {item.is_dir && (
                    <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                  )}
                </div>
              );
            })}

            {filteredItems.length === 0 && !loading && (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                No files found
              </div>
            )}
          </div>
        </>
      )}

      {/* Recents Tab */}
      {activeTab === 'recents' && (
        <div className="tree-container">
          {recentFiles.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              No recent files opened yet
            </div>
          ) : (
            recentFiles.map(path => (
              <div 
                key={path}
                className={`tree-item ${selectedFile === path ? 'active' : ''}`}
                onClick={() => onSelectFile(path)}
                title={path}
              >
                <Clock size={15} style={{ color: 'var(--text-muted)', minWidth: '15px' }} />
                <span className="tree-item-name">{path.split('/').pop()}</span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Bookmarks Tab */}
      {activeTab === 'bookmarks' && (
        <div className="tree-container">
          {bookmarks.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              No bookmarks saved yet
            </div>
          ) : (
            bookmarks.map(path => (
              <div 
                key={path}
                className={`tree-item ${selectedFile === path ? 'active' : ''}`}
                onClick={() => onSelectFile(path)}
                title={path}
              >
                <Bookmark size={15} style={{ color: 'var(--warning)', minWidth: '15px', fill: 'var(--warning)' }} />
                <span className="tree-item-name">{path.split('/').pop()}</span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Sidebar Footer Stats */}
      <div style={{
        padding: '10px 14px',
        borderTop: '1px solid var(--border-subtle)',
        fontSize: '11px',
        color: 'var(--text-muted)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <span>📁 {browseData?.items.length || 0} items</span>
        <span>📚 {totalMdFiles} Markdown Docs</span>
      </div>
    </aside>
  );
};
