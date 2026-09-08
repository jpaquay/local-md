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

import React, { useState } from 'react';
import { Folder, X, Check, ArrowRight, Home, Code, HardDrive } from 'lucide-react';
import { ConfigResponse } from '../types';
import { apiService } from '../services/api';

interface RootConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ConfigResponse | null;
  onRootChanged: (newRootDisplay: string) => void;
}

export const RootConfigModal: React.FC<RootConfigModalProps> = ({
  isOpen,
  onClose,
  config,
  onRootChanged,
}) => {
  const [customPath, setCustomPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectRoot = async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiService.setRoot(path);
      onRootChanged(res.display_root);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update root folder');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customPath.trim()) {
      handleSelectRoot(customPath.trim());
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="search-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-subtle)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Folder size={18} style={{ color: 'var(--accent-primary)' }} />
            <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Configure Root Directory</h3>
          </div>
          <button className="icon-btn" onClick={onClose} style={{ padding: '4px' }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Choose a root folder to explore. All Markdown documents, subdirectories, and searches will be scoped to this location.
          </p>

          {/* Quick Root Shortcuts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Quick Presets
            </span>
            {config?.quick_roots.map(qr => {
              const isCurrent = config.display_root === qr.display || config.current_root === qr.path;
              return (
                <div
                  key={qr.path}
                  className="tree-item"
                  style={{
                    padding: '10px 14px',
                    background: isCurrent ? 'var(--accent-surface)' : 'var(--bg-tertiary)',
                    border: isCurrent ? '1px solid var(--accent-border)' : '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                  onClick={() => handleSelectRoot(qr.path)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {qr.display === '~' ? (
                      <Home size={16} style={{ color: 'var(--accent-primary)' }} />
                    ) : qr.display.includes('dev') ? (
                      <Code size={16} style={{ color: 'var(--warning)' }} />
                    ) : (
                      <HardDrive size={16} style={{ color: 'var(--text-muted)' }} />
                    )}
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 500 }}>{qr.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{qr.display}</div>
                    </div>
                  </div>
                  {isCurrent ? (
                    <span style={{ fontSize: '11px', color: 'var(--accent-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Check size={13} /> Active
                    </span>
                  ) : (
                    <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Custom Path Input Form */}
          <form onSubmit={handleCustomSubmit}>
            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
              Or Enter Custom Path
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="e.g. ~/dev/github-cloud-gtm or /tmp"
                value={customPath}
                onChange={e => setCustomPath(e.target.value)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  outline: 'none',
                  fontFamily: 'var(--font-mono)'
                }}
              />
              <button
                type="submit"
                className="icon-btn active"
                disabled={loading || !customPath.trim()}
                style={{ padding: '8px 16px' }}
              >
                {loading ? 'Setting...' : 'Set Root'}
              </button>
            </div>
            {error && (
              <div style={{ color: 'var(--danger)', fontSize: '12px', marginTop: '8px' }}>
                {error}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};
