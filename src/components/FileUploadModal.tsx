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

import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, X, Check, AlertCircle, FilePlus, Code2 } from 'lucide-react';
import { apiService } from '../services/api';

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFileUploaded: (newPath: string) => void;
  currentDirectory?: string;
}

export const FileUploadModal: React.FC<FileUploadModalProps> = ({
  isOpen,
  onClose,
  onFileUploaded,
  currentDirectory = '',
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pasteFilename, setPasteFilename] = useState<string>('');
  const [pasteContent, setPasteContent] = useState<string>('');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (isValidMarkdownFile(file.name)) {
        setSelectedFile(file);
        setStatusMessage(null);
      } else {
        setStatusMessage({ type: 'error', text: 'Please select a Markdown (.md, .markdown, .txt) file.' });
      }
    }
  };

  const isValidMarkdownFile = (name: string): boolean => {
    const lower = name.toLowerCase();
    return lower.endsWith('.md') || lower.endsWith('.markdown') || lower.endsWith('.txt') || lower.endsWith('.lab.md');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (isValidMarkdownFile(file.name)) {
        setSelectedFile(file);
        setStatusMessage(null);
      } else {
        setStatusMessage({ type: 'error', text: 'Please select a Markdown (.md, .markdown, .txt) file.' });
      }
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      if (activeTab === 'upload') {
        if (!selectedFile) {
          setStatusMessage({ type: 'error', text: 'Please select a file to upload.' });
          setIsSubmitting(false);
          return;
        }

        const res = await apiService.uploadFile(selectedFile, currentDirectory);
        setStatusMessage({ type: 'success', text: `Loaded ${res.filename} successfully!` });
        setTimeout(() => {
          onFileUploaded(res.path);
          onClose();
        }, 600);
      } else {
        if (!pasteFilename.trim()) {
          setStatusMessage({ type: 'error', text: 'Please specify a document filename.' });
          setIsSubmitting(false);
          return;
        }
        if (!pasteContent.trim()) {
          setStatusMessage({ type: 'error', text: 'Markdown content cannot be empty.' });
          setIsSubmitting(false);
          return;
        }

        let name = pasteFilename.trim();
        if (!isValidMarkdownFile(name)) {
          name += '.md';
        }

        const res = await apiService.createFile(name, pasteContent, currentDirectory);
        setStatusMessage({ type: 'success', text: `Created ${res.filename} successfully!` });
        setTimeout(() => {
          onFileUploaded(res.path);
          onClose();
        }, 600);
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to load file.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="search-modal" 
        style={{ width: '560px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }} 
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'var(--accent-surface)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary)',
            }}>
              <UploadCloud size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Load Markdown Document
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                Interactively load or create markdown files into the workspace
              </p>
            </div>
          </div>
          <button 
            className="icon-btn" 
            onClick={onClose}
            style={{ width: '30px', height: '30px', padding: 0 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div style={{
          display: 'flex',
          gap: '8px',
          padding: '12px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-tertiary)',
        }}>
          <button
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: 'none',
              background: activeTab === 'upload' ? 'var(--accent-primary)' : 'transparent',
              color: activeTab === 'upload' ? '#ffffff' : 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            onClick={() => setActiveTab('upload')}
          >
            <UploadCloud size={14} /> Upload from Disk
          </button>
          <button
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: 'none',
              background: activeTab === 'paste' ? 'var(--accent-primary)' : 'transparent',
              color: activeTab === 'paste' ? '#ffffff' : 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            onClick={() => setActiveTab('paste')}
          >
            <FilePlus size={14} /> Paste / Create New
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {statusMessage && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 14px',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '13px',
              background: statusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              color: statusMessage.type === 'success' ? 'var(--success)' : 'var(--danger)',
              border: `1px solid ${statusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            }}>
              {statusMessage.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {activeTab === 'upload' ? (
            <div>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept=".md,.markdown,.txt"
                onChange={handleFileChange}
              />
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${isDragging ? 'var(--accent-primary)' : 'var(--border-strong)'}`,
                  borderRadius: '10px',
                  padding: '36px 20px',
                  textAlign: 'center',
                  background: isDragging ? 'var(--accent-surface)' : 'var(--bg-primary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'var(--accent-surface)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                  color: 'var(--accent-primary)',
                }}>
                  <UploadCloud size={24} />
                </div>
                <p style={{ margin: '0 0 6px', fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                  {selectedFile ? selectedFile.name : 'Click to select or drag & drop file here'}
                </p>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                  Supports .md, .markdown, .txt (up to 10 MB)
                </p>
              </div>

              {selectedFile && (
                <div style={{
                  marginTop: '16px',
                  padding: '12px',
                  borderRadius: '8px',
                  background: 'var(--bg-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  border: '1px solid var(--border-subtle)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileText size={18} color="var(--accent-primary)" />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                        {selectedFile.name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </div>
                    </div>
                  </div>
                  <button
                    className="icon-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                    }}
                    style={{ width: '26px', height: '26px' }}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Document Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. cluster-notes.md"
                  value={pasteFilename}
                  onChange={e => setPasteFilename(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-strong)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    fontFamily: 'var(--font-mono)',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Markdown Content
                </label>
                <textarea
                  placeholder="# Enter or paste markdown content here..."
                  value={pasteContent}
                  onChange={e => setPasteContent(e.target.value)}
                  rows={9}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-strong)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    fontFamily: 'var(--font-mono)',
                    outline: 'none',
                    resize: 'vertical',
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '10px',
          padding: '14px 20px',
          borderTop: '1px solid var(--border-subtle)',
          background: 'var(--bg-secondary)',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '7px 16px',
              borderRadius: '6px',
              border: '1px solid var(--border-strong)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || (activeTab === 'upload' && !selectedFile)}
            style={{
              padding: '7px 18px',
              borderRadius: '6px',
              border: 'none',
              background: 'var(--accent-primary)',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 500,
              cursor: isSubmitting || (activeTab === 'upload' && !selectedFile) ? 'not-allowed' : 'pointer',
              opacity: isSubmitting || (activeTab === 'upload' && !selectedFile) ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {isSubmitting ? (
              <span>Loading...</span>
            ) : (
              <>
                <Check size={14} />
                <span>Load into Viewer</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
