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
import { Folder, X, Check, ArrowRight, Home, Code, HardDrive, Pin, Lock, Unlock, Star } from 'lucide-react';
import { ConfigResponse } from '../types';
import { apiService } from '../services/api';

interface RootConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ConfigResponse | null;
  onRootChanged: (newRootDisplay: string) => void;
  onConfigUpdated?: (newConfig: ConfigResponse) => void;
}

export const RootConfigModal: React.FC<RootConfigModalProps> = ({
  isOpen,
  onClose,
  config,
  onRootChanged,
  onConfigUpdated,
}) => {
  const [customPath, setCustomPath] = useState('');
  const [pinAsDefault, setPinAsDefault] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectRoot = async (path: string, saveAsDefault: boolean = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiService.setRoot(path, saveAsDefault);
      onRootChanged(res.display_root);
      const updatedCfg = await apiService.getConfig();
      if (onConfigUpdated) onConfigUpdated(updatedCfg);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update root folder');
    } finally {
      setLoading(false);
    }
  };

  const handlePinAction = async (e: React.MouseEvent, path: string, action: 'pin' | 'unpin' | 'set_default' | 'toggle_lock') => {
    e.stopPropagation();
    setLoading(true);
    setError(null);
    try {
      const updatedCfg = await apiService.pinRootConfig(path, action);
      if (onConfigUpdated) onConfigUpdated(updatedCfg);
      if (action === 'set_default') {
        onRootChanged(updatedCfg.display_root);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update pin configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customPath.trim()) {
      handleSelectRoot(customPath.trim(), pinAsDefault);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="search-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-subtle)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Folder size={18} style={{ color: 'var(--accent-primary)' }} />
            <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Configure & Pin Root Directory</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className={`icon-btn ${config?.is_locked ? 'active' : ''}`}
              title={config?.is_locked ? "Unlock root directory switching" : "Lock current root directory (prevent switching outside)"}
              onClick={(e) => handlePinAction(e, config?.display_root || '', 'toggle_lock')}
              style={{ padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              {config?.is_locked ? <Lock size={12} /> : <Unlock size={12} />}
              <span>{config?.is_locked ? 'Locked' : 'Unlocked'}</span>
            </button>
            <button className="icon-btn" onClick={onClose} style={{ padding: '4px' }}>
              <X size={14} />
            </button>
          </div>
        </div>

        <div style={{ padding: '20px' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Select or pin a workspace root folder. Pinned roots are saved to <code>.env</code> (100% De-ID) and persist across restarts.
          </p>

          {/* Pinned & Quick Root Shortcuts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Pinned & Workspace Presets
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
                  onClick={() => handleSelectRoot(qr.path, false)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                    {qr.display === '~' ? (
                      <Home size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                    ) : qr.display.includes('dev') ? (
                      <Code size={16} style={{ color: 'var(--warning)', flexShrink: 0 }} />
                    ) : (
                      <HardDrive size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    )}
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{qr.name}</span>
                        {qr.is_default && (
                          <span style={{ fontSize: '10px', background: 'var(--bg-secondary)', padding: '1px 6px', borderRadius: '4px', color: 'var(--warning)', border: '1px solid var(--border-subtle)' }}>
                            Startup Default
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{qr.display}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    {!qr.is_default && (
                      <button
                        className="icon-btn"
                        title="Set as default startup root in .env"
                        onClick={(e) => handlePinAction(e, qr.path, 'set_default')}
                        style={{ padding: '4px 6px' }}
                      >
                        <Star size={12} />
                      </button>
                    )}
                    <button
                      className={`icon-btn ${qr.is_pinned ? 'active' : ''}`}
                      title={qr.is_pinned ? "Unpin from .env" : "Pin preset to .env"}
                      onClick={(e) => handlePinAction(e, qr.path, qr.is_pinned ? 'unpin' : 'pin')}
                      style={{ padding: '4px 6px' }}
                    >
                      <Pin size={12} />
                    </button>
                    {isCurrent ? (
                      <span style={{ fontSize: '11px', color: 'var(--accent-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '4px' }}>
                        <Check size={13} /> Active
                      </span>
                    ) : (
                      <ArrowRight size={14} style={{ color: 'var(--text-muted)', marginLeft: '4px' }} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Custom Path Input Form */}
          <form onSubmit={handleCustomSubmit}>
            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
              Enter Custom Root Path
            </span>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              <input
                type="text"
                placeholder="e.g. ~/dev/cloud-gtm or ~/dev"
                value={customPath}
                onChange={e => setCustomPath(e.target.value)}
                disabled={config?.is_locked}
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
                disabled={loading || !customPath.trim() || config?.is_locked}
                style={{ padding: '8px 16px', whiteSpace: 'nowrap' }}
              >
                {loading ? 'Setting...' : 'Set Root'}
              </button>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={pinAsDefault}
                onChange={e => setPinAsDefault(e.target.checked)}
                disabled={config?.is_locked}
              />
              <span>📌 Pin & save as default startup root in <code>.env</code></span>
            </label>
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
