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

import React, { useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import hljs from 'highlight.js';
import mermaid from 'mermaid';
import katex from 'katex';
import { FileData } from '../types';
import { 
  Copy, 
  Check, 
  FileText, 
  Code2, 
  Calendar, 
  Clock, 
  Hash, 
  Sparkles,
  Bookmark,
  ExternalLink
} from 'lucide-react';

interface MarkdownViewerProps {
  fileData: FileData;
  isRawMode: boolean;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
}

// Initialize Mermaid once
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
  fontFamily: 'Inter, sans-serif'
});

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({
  fileData,
  isRawMode,
  isBookmarked,
  onToggleBookmark,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [copiedCodeIdx, setCopiedCodeIdx] = useState<number | null>(null);

  // Custom Marked Extension / Renderer for Codelabs & GitHub Alerts
  const renderMarkdownToHtml = (content: string): string => {
    let processed = content;

    // 1. Process LaTeX Math (KaTeX)
    // Block Math $$...$$
    processed = processed.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
      try {
        return `<div class="katex-block">${katex.renderToString(math.trim(), { displayMode: true, throwOnError: false })}</div>`;
      } catch (e) {
        return `$$${math}$$`;
      }
    });

    // Inline Math $...$
    processed = processed.replace(/\$([^\$\n]+?)\$/g, (_, math) => {
      try {
        return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false });
      } catch (e) {
        return `$${math}$`;
      }
    });

    // 2. Parse Markdown with marked
    const rawHtml = marked.parse(processed, {
      gfm: true,
      breaks: false,
    }) as string;

    // 3. Transform Codelab Aside Boxes and GitHub Alerts in HTML
    let transformedHtml = rawHtml;

    // Codelab > aside positive / negative
    transformedHtml = transformedHtml.replace(
      /<blockquote>\s*<p>aside positive\s*([\s\S]*?)<\/p>\s*<\/blockquote>/gi,
      '<div class="aside-box aside-positive"><div class="aside-content">$1</div></div>'
    );
    transformedHtml = transformedHtml.replace(
      /<blockquote>\s*<p>aside negative\s*([\s\S]*?)<\/p>\s*<\/blockquote>/gi,
      '<div class="aside-box aside-negative"><div class="aside-content">$1</div></div>'
    );

    // GitHub Alerts: [!NOTE], [!TIP], [!IMPORTANT], [!WARNING], [!CAUTION]
    transformedHtml = transformedHtml.replace(
      /<blockquote>\s*<p>\[!(NOTE|TIP|INFO)\]\s*([\s\S]*?)<\/p>\s*<\/blockquote>/gi,
      '<div class="aside-box aside-info"><div class="aside-content"><strong>$1:</strong> $2</div></div>'
    );
    transformedHtml = transformedHtml.replace(
      /<blockquote>\s*<p>\[!(WARNING|CAUTION|IMPORTANT)\]\s*([\s\S]*?)<\/p>\s*<\/blockquote>/gi,
      '<div class="aside-box aside-negative"><div class="aside-content"><strong>$1:</strong> $2</div></div>'
    );

    return transformedHtml;
  };

  const htmlContent = renderMarkdownToHtml(fileData.content);

  // Handle post-render: Syntax Highlighting, Mermaid Execution, Code Copy Buttons
  useEffect(() => {
    if (isRawMode || !contentRef.current) return;

    // 1. Highlight all code blocks
    const codeBlocks = contentRef.current.querySelectorAll('pre code');
    codeBlocks.forEach((block) => {
      const codeElement = block as HTMLElement;
      // Skip mermaid
      if (codeElement.classList.contains('language-mermaid')) return;
      
      if (!codeElement.dataset.highlighted) {
        hljs.highlightElement(codeElement);
      }

      // Wrap pre in .code-block-wrapper if not wrapped
      const pre = codeElement.parentElement;
      if (pre && !pre.parentElement?.classList.contains('code-block-wrapper')) {
        const langMatch = codeElement.className.match(/language-(\w+)/);
        const lang = langMatch ? langMatch[1] : 'code';

        const wrapper = document.createElement('div');
        wrapper.className = 'code-block-wrapper';

        const header = document.createElement('div');
        header.className = 'code-block-header';
        header.innerHTML = `<span>${lang}</span>`;

        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-code-btn';
        copyBtn.innerHTML = `<span>Copy</span>`;
        copyBtn.onclick = () => {
          navigator.clipboard.writeText(codeElement.innerText);
          copyBtn.innerHTML = `<span>✓ Copied</span>`;
          setTimeout(() => {
            copyBtn.innerHTML = `<span>Copy</span>`;
          }, 2000);
        };

        header.appendChild(copyBtn);
        pre.parentNode?.insertBefore(wrapper, pre);
        wrapper.appendChild(header);
        wrapper.appendChild(pre);
      }
    });

    // 2. Render Mermaid diagrams (per React UX pattern)
    const mermaidNodes = contentRef.current.querySelectorAll('code.language-mermaid');
    if (mermaidNodes.length > 0) {
      mermaidNodes.forEach((node, idx) => {
        const codeText = (node as HTMLElement).innerText;
        const pre = node.parentElement;
        if (pre) {
          const container = document.createElement('div');
          container.className = 'mermaid-wrapper';
          const mermaidDiv = document.createElement('div');
          mermaidDiv.className = 'mermaid';
          mermaidDiv.id = `mermaid-graph-${Date.now()}-${idx}`;
          mermaidDiv.textContent = codeText;
          container.appendChild(mermaidDiv);
          pre.parentNode?.replaceChild(container, pre);
        }
      });

      // Run mermaid on newly created nodes
      setTimeout(async () => {
        try {
          const diagrams = contentRef.current?.querySelectorAll('.mermaid');
          if (diagrams && diagrams.length > 0) {
            await mermaid.run({
              nodes: Array.from(diagrams) as HTMLElement[]
            });
          }
        } catch (err) {
          console.error('Mermaid render error:', err);
        }
      }, 50);
    }
  }, [htmlContent, isRawMode]);

  return (
    <div className="doc-scroll-pane">
      <div className="doc-max-width">
        {/* Frontmatter Metadata Hero Card */}
        {Object.keys(fileData.frontmatter).length > 0 && (
          <div className="frontmatter-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={16} style={{ color: 'var(--accent-primary)' }} />
                <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--accent-primary)' }}>
                  Metadata Specification
                </span>
              </div>
              <button 
                className="icon-btn" 
                onClick={onToggleBookmark}
                title={isBookmarked ? 'Remove Bookmark' : 'Bookmark this file'}
              >
                <Bookmark size={14} style={{ fill: isBookmarked ? 'var(--warning)' : 'none', color: isBookmarked ? 'var(--warning)' : 'inherit' }} />
                <span>{isBookmarked ? 'Bookmarked' : 'Bookmark'}</span>
              </button>
            </div>

            <div className="frontmatter-grid">
              {Object.entries(fileData.frontmatter).map(([k, v]) => (
                <div key={k} className="frontmatter-item">
                  <span className="frontmatter-label">{k}</span>
                  <span className="frontmatter-value">{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Stats Pill */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          padding: '8px 0',
          marginBottom: '20px',
          fontSize: '12px',
          color: 'var(--text-muted)',
          borderBottom: '1px solid var(--border-subtle)'
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Calendar size={13} /> {new Date(fileData.modified_time).toLocaleDateString()}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={13} /> ~{fileData.reading_time_minutes} min read
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Hash size={13} /> {fileData.lines_count} lines ({fileData.word_count} words)
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <FileText size={13} /> {(fileData.size_bytes / 1024).toFixed(1)} KB
          </span>
        </div>

        {/* Rendered View vs Raw Source View */}
        {isRawMode ? (
          <div className="code-block-wrapper" style={{ marginTop: '0' }}>
            <div className="code-block-header">
              <span>Raw Markdown Source</span>
              <button 
                className="copy-code-btn"
                onClick={() => {
                  navigator.clipboard.writeText(fileData.content);
                  setCopiedCodeIdx(1);
                  setTimeout(() => setCopiedCodeIdx(null), 2000);
                }}
              >
                {copiedCodeIdx === 1 ? <Check size={12} /> : <Copy size={12} />}
                <span>{copiedCodeIdx === 1 ? 'Copied' : 'Copy All'}</span>
              </button>
            </div>
            <pre><code>{fileData.content}</code></pre>
          </div>
        ) : (
          <div 
            ref={contentRef}
            className="markdown-body"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        )}
      </div>
    </div>
  );
};
