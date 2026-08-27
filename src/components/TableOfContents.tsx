import React from 'react';
import { List, Hash } from 'lucide-react';
import { TocItem } from '../types';

interface TableOfContentsProps {
  toc: TocItem[];
}

export const TableOfContents: React.FC<TableOfContentsProps> = ({ toc }) => {
  if (!toc || toc.length === 0) {
    return null;
  }

  const handleHeadingClick = (e: React.MouseEvent<HTMLAnchorElement>, slug: string) => {
    e.preventDefault();
    // Locate the heading element in markdown-body
    const headings = Array.from(document.querySelectorAll('.markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4'));
    const target = headings.find(h => {
      const text = h.textContent || '';
      const clean = text.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
      return clean.includes(slug) || slug.includes(clean);
    });

    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <aside className="toc-pane">
      <div className="toc-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <List size={14} />
        <span>On This Page</span>
      </div>
      <nav>
        {toc.map((item, idx) => (
          <a
            key={`${item.slug}-${idx}`}
            href={`#${item.slug}`}
            className={`toc-link toc-level-${Math.min(item.level, 4)}`}
            onClick={(e) => handleHeadingClick(e, item.slug)}
            title={item.title}
          >
            {item.title}
          </a>
        ))}
      </nav>
    </aside>
  );
};
