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
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { MarkdownViewer } from './components/MarkdownViewer';
import { TableOfContents } from './components/TableOfContents';
import { SearchModal } from './components/SearchModal';
import { RootConfigModal } from './components/RootConfigModal';
import { apiService } from './services/api';
import { FileData, StatsResponse, ConfigResponse } from './types';
import { BookOpen, Sparkles, ArrowRight, FileText } from 'lucide-react';

export const App: React.FC = () => {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [fileData, setFileData] = useState<FileData | null>(null);
  const [loadingFile, setLoadingFile] = useState<boolean>(false);
  const [isRawMode, setIsRawMode] = useState<boolean>(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isRootConfigOpen, setIsRootConfigOpen] = useState<boolean>(false);
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [displayRoot, setDisplayRoot] = useState<string>('~');
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  // Load config, bookmarks & theme from localStorage
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('local_md_theme') as 'dark' | 'light';
      if (savedTheme) {
        setTheme(savedTheme);
        document.body.className = `theme-${savedTheme}`;
      }
      const savedBm = localStorage.getItem('local_md_bookmarks');
      if (savedBm) setBookmarks(JSON.parse(savedBm));
    } catch (e) {
      console.error(e);
    }

    // Load initial config and stats
    apiService.getConfig().then(cfg => {
      setConfig(cfg);
      setDisplayRoot(cfg.display_root);
    }).catch(console.error);

    apiService.getStats().then(setStats).catch(console.error);

    // Initial check if hash contains a file path
    const hash = window.location.hash.replace(/^#/, '');
    if (hash) {
      handleSelectFile(decodeURIComponent(hash));
    }
  }, [refreshTrigger]);

  // Global Keyboard Shortcuts (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleToggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.body.className = `theme-${newTheme}`;
    localStorage.setItem('local_md_theme', newTheme);
  };

  const handleToggleBookmark = (path: string) => {
    setBookmarks(prev => {
      let updated: string[];
      if (prev.includes(path)) {
        updated = prev.filter(p => p !== path);
      } else {
        updated = [...prev, path];
      }
      localStorage.setItem('local_md_bookmarks', JSON.stringify(updated));
      return updated;
    });
  };

  const handleSelectFile = async (path: string) => {
    setLoadingFile(true);
    setSelectedFilePath(path);
    window.location.hash = encodeURIComponent(path);

    try {
      const data = await apiService.getFile(path);
      setFileData(data);

      try {
        const stored = localStorage.getItem('local_md_recents');
        const recents: string[] = stored ? JSON.parse(stored) : [];
        const filtered = [path, ...recents.filter(p => p !== path)].slice(0, 15);
        localStorage.setItem('local_md_recents', JSON.stringify(filtered));
      } catch (e) {
        console.error(e);
      }
    } catch (err) {
      console.error('Failed to load file:', err);
    } finally {
      setLoadingFile(false);
    }
  };

  const handleNavigateFolder = (path: string) => {
    setCurrentPath(path);
  };

  const handleRootChanged = (newDisplayRoot: string) => {
    setDisplayRoot(newDisplayRoot);
    setCurrentPath('');
    setSelectedFilePath(null);
    setFileData(null);
    window.location.hash = '';
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="app-container">
      {/* Left Sidebar Directory Explorer */}
      <Sidebar
        currentPath={currentPath}
        selectedFile={selectedFilePath}
        displayRoot={displayRoot}
        onSelectFile={handleSelectFile}
        onNavigateFolder={handleNavigateFolder}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenRootConfig={() => setIsRootConfigOpen(true)}
        bookmarks={bookmarks}
        onToggleBookmark={handleToggleBookmark}
        refreshTrigger={refreshTrigger}
      />

      {/* Main Content Workspace */}
      <main className="main-wrapper">
        <Header
          breadcrumbs={fileData?.breadcrumbs || [{ name: displayRoot, path: '' }]}
          fileData={fileData}
          onNavigateFolder={handleNavigateFolder}
          isRawMode={isRawMode}
          onToggleRawMode={() => setIsRawMode(prev => !prev)}
          theme={theme}
          onToggleTheme={handleToggleTheme}
        />

        <div className="content-body">
          {loadingFile ? (
            <div className="empty-state" style={{ flex: 1 }}>
              <Sparkles size={28} className="animate-spin text-blue-500" style={{ color: 'var(--accent-primary)', marginBottom: '16px' }} />
              <p>Loading document...</p>
            </div>
          ) : fileData ? (
            <>
              <MarkdownViewer
                fileData={fileData}
                isRawMode={isRawMode}
                isBookmarked={bookmarks.includes(fileData.path)}
                onToggleBookmark={() => handleToggleBookmark(fileData.path)}
              />
              {!isRawMode && <TableOfContents toc={fileData.toc} />}
            </>
          ) : (
            <div className="doc-scroll-pane" style={{ flex: 1 }}>
              <div className="doc-max-width" style={{ paddingTop: '40px' }}>
                <div style={{ textAlign: 'center', marginBottom: '36px' }}>
                  <BookOpen size={48} style={{ color: 'var(--accent-primary)', marginBottom: '14px' }} />
                  <h1 style={{ fontSize: '26px', fontWeight: 700, marginBottom: '8px' }}>Local Markdown Explorer</h1>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
                    Browse, render, and search all Markdown documentation and Codelabs across <code>{displayRoot}</code>
                  </p>
                </div>

                {stats && stats.recent_files.length > 0 && (
                  <div className="frontmatter-card">
                    <h3 style={{ fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '14px' }}>
                      🌟 Featured & Recent Documentation
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                      {stats.recent_files.map(rf => (
                        <div
                          key={rf.path}
                          className="tree-item"
                          style={{ padding: '10px 14px', background: 'var(--bg-tertiary)' }}
                          onClick={() => handleSelectFile(rf.path)}
                        >
                          <FileText size={16} style={{ color: 'var(--accent-primary)' }} />
                          <span className="tree-item-name" style={{ fontWeight: 500 }}>{rf.name}</span>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{rf.path}</span>
                          <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Global Cmd+K Search Modal */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectResult={handleSelectFile}
      />

      {/* Root Configuration Modal */}
      <RootConfigModal
        isOpen={isRootConfigOpen}
        onClose={() => setIsRootConfigOpen(false)}
        config={config}
        onRootChanged={handleRootChanged}
        onConfigUpdated={setConfig}
      />
    </div>
  );
};
