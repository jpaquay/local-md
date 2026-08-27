import React, { useState, useEffect, useRef } from 'react';
import { Search, X, FileText, ArrowRight, CornerDownLeft, Sparkles } from 'lucide-react';
import { apiService } from '../services/api';
import { SearchResult } from '../types';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectResult: (path: string) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  onSelectResult,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await apiService.search(query);
        setResults(data.results);
        setSelectedIndex(0);
      } catch (err) {
        console.error('Search query failed:', err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      onSelectResult(results[selectedIndex].path);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="search-modal" onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
        {/* Search Input Bar */}
        <div className="search-input-wrapper">
          <Search size={18} style={{ color: 'var(--accent-primary)' }} />
          <input
            ref={inputRef}
            type="text"
            className="search-input"
            placeholder="Search all files and contents in dev/ (e.g. 'Elevate', 'Terraform', 'M0L1')..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && (
            <button className="icon-btn" onClick={() => setQuery('')} style={{ padding: '4px' }}>
              <X size={14} />
            </button>
          )}
        </div>

        {/* Results List */}
        <div className="search-results-list">
          {loading && (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              Searching across dev/ directory...
            </div>
          )}

          {!loading && results.length > 0 && (
            results.map((res, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={`${res.path}-${idx}`}
                  className={`search-result-item ${isSelected ? 'selected' : ''}`}
                  style={{
                    background: isSelected ? 'var(--bg-tertiary)' : 'transparent',
                    borderLeft: isSelected ? '3px solid var(--accent-primary)' : '3px solid transparent'
                  }}
                  onClick={() => {
                    onSelectResult(res.path);
                    onClose();
                  }}
                >
                  <div className="search-result-title">
                    <FileText size={15} />
                    <span>{res.name}</span>
                  </div>
                  <div className="search-result-path">{res.path}</div>
                  
                  {res.snippets && res.snippets.length > 0 && (
                    <div className="search-result-snippet">
                      <span style={{ color: 'var(--text-muted)', marginRight: '6px' }}>
                        L{res.snippets[0].line_number}:
                      </span>
                      {res.snippets[0].text}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {!loading && query.length >= 2 && results.length === 0 && (
            <div className="empty-state" style={{ padding: '40px 20px' }}>
              <p>No matching markdown files found for "{query}"</p>
            </div>
          )}

          {!loading && !query && (
            <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
              Type 2 or more characters to search file names and content across <code>dev/</code>
            </div>
          )}
        </div>

        {/* Footer shortcuts */}
        <div style={{
          padding: '10px 16px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: 'var(--text-muted)'
        }}>
          <span>Navigate with <kbd style={{ fontFamily: 'var(--font-mono)' }}>↑</kbd> <kbd style={{ fontFamily: 'var(--font-mono)' }}>↓</kbd></span>
          <span>Open with <kbd style={{ fontFamily: 'var(--font-mono)' }}>↵ Enter</kbd></span>
          <span>Close with <kbd style={{ fontFamily: 'var(--font-mono)' }}>ESC</kbd></span>
        </div>
      </div>
    </div>
  );
};
