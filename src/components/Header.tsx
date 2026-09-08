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

import React from 'react';
import { 
  ChevronRight, 
  Eye, 
  Code2, 
  Copy, 
  Check, 
  Moon, 
  Sun, 
  Share2,
  FileText
} from 'lucide-react';
import { Breadcrumb, FileData } from '../types';

interface HeaderProps {
  breadcrumbs: Breadcrumb[];
  fileData: FileData | null;
  onNavigateFolder: (path: string) => void;
  isRawMode: boolean;
  onToggleRawMode: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  breadcrumbs,
  fileData,
  onNavigateFolder,
  isRawMode,
  onToggleRawMode,
  theme,
  onToggleTheme,
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopyPath = () => {
    if (fileData) {
      navigator.clipboard.writeText(fileData.path);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <header className="top-header">
      {/* Breadcrumbs Navigation */}
      <div className="breadcrumbs">
        {breadcrumbs.map((b, idx) => {
          const isLast = idx === breadcrumbs.length - 1;
          return (
            <React.Fragment key={`${b.path}-${idx}`}>
              <span
                className={`breadcrumb-segment ${isLast ? 'current' : ''}`}
                onClick={() => !isLast && onNavigateFolder(b.path)}
              >
                {b.name}
              </span>
              {!isLast && <ChevronRight size={14} />}
            </React.Fragment>
          );
        })}
      </div>

      {/* Header Actions */}
      <div className="header-actions">
        {fileData && (
          <>
            {/* Copy Path */}
            <button 
              className="icon-btn" 
              onClick={handleCopyPath} 
              title="Copy Relative File Path"
            >
              {copied ? <Check size={14} style={{ color: 'var(--success)' }} /> : <Copy size={14} />}
              <span>{copied ? 'Path Copied' : 'Copy Path'}</span>
            </button>

            {/* Raw vs Rendered View Toggle */}
            <button 
              className={`icon-btn ${isRawMode ? 'active' : ''}`} 
              onClick={onToggleRawMode}
              title={isRawMode ? 'Switch to Rendered Markdown' : 'Switch to Raw Markdown'}
            >
              {isRawMode ? <Eye size={14} /> : <Code2 size={14} />}
              <span>{isRawMode ? 'Rendered View' : 'Raw View'}</span>
            </button>
          </>
        )}

        {/* Dark / Light Theme Toggle */}
        <button 
          className="icon-btn" 
          onClick={onToggleTheme} 
          title="Toggle Light/Dark Theme"
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>
    </header>
  );
};
