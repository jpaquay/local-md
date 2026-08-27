import React, { useState, useEffect } from 'react';
import { 
  Folder, 
  FolderOpen, 
  FileText, 
  FileCode, 
  Search, 
  ChevronRight, 
  ChevronDown, 
  BookOpen, 
  Clock, 
  Bookmark, 
  RefreshCw,
  FolderTree,
  Sparkles
} from 'lucide-react';
import { DirectoryItem, BrowseResponse } from '../types';
import { apiService } from '../services/api';

interface SidebarProps {
  currentPath: string;
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
  onNavigateFolder: (path: string) => void;
  onOpenSearch: () => void;
  bookmarks: string[];
  onToggleBookmark: (path: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPath,
  selectedFile,
  onSelectFile,
  onNavigateFolder,
  onOpenSearch,
  bookmarks,
  onToggleBookmark,
}) => {
  const [activeTab, setActiveTab] = useState<'files' | 'recents' | 'bookmarks'>('files');
  const [browseData, setBrowseData] = useState<BrowseResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [filterText, setFilterText] = useState<string>('');
  const [recentFiles, setRecentFiles] = useState<string[]>([]);
  const [totalMdFiles, setTotalMdFiles] = useState<number>(0);

  // Fetch directory listing on currentPath change
  const loadDirectory = async (path: string) => {
    setLoading(true);
    try {
      const data = await apiService.browse(path);
      setBrowseData(data);
    } catch (err) {
      console.error('Failed to browse directory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDirectory(currentPath);
  }, [currentPath]);

  // Load stats & recents
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
  }, []);

  // Filter items
  const filteredItems = browseData?.items.filter(item => 
    item.name.toLowerCase().includes(filterText.toLowerCase())
  ) || [];

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="sidebar-header">
        <div className="brand-title">
          <BookOpen size={18} className="text-blue-500" style={{ color: 'var(--accent-primary)' }} />
          <span>Local Markdown</span>
          <span className="brand-badge">dev/</span>
        </div>
        <button 
          className="icon-btn" 
          title="Refresh directory" 
          onClick={() => loadDirectory(currentPath)}
          disabled={loading}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
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
          {/* In-Directory Quick Filter */}
          <div style={{ padding: '8px 12px 0 12px' }}>
            <input 
              type="text" 
              placeholder="Filter current folder..." 
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                fontSize: '12px',
                outline: 'none'
              }}
            />
          </div>

          <div className="tree-container">
            {/* Parent Directory Link if not root */}
            {browseData && !browseData.is_root && browseData.parent_path !== null && (
              <div 
                className="tree-item"
                onClick={() => onNavigateFolder(browseData.parent_path || '')}
              >
                <FolderOpen size={16} style={{ color: 'var(--accent-primary)' }} />
                <span className="tree-item-name" style={{ fontStyle: 'italic' }}>.. (parent folder)</span>
              </div>
            )}

            {/* Directory Items List */}
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
              No bookmarks saved yet. Click the bookmark icon on any document to save it here.
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
        <span>📁 {browseData?.items.length || 0} items in folder</span>
        <span>📚 {totalMdFiles} Markdown Docs</span>
      </div>
    </aside>
  );
};
