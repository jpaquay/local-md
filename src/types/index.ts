export interface DirectoryItem {
  name: string;
  path: string;
  is_dir: boolean;
  extension: string | null;
  is_markdown: boolean;
  size_bytes: number | null;
  modified_time: string;
}

export interface Breadcrumb {
  name: string;
  path: string;
}

export interface BrowseResponse {
  current_path: string;
  parent_path: string | null;
  is_root: boolean;
  breadcrumbs: Breadcrumb[];
  items: DirectoryItem[];
  total_count: number;
}

export interface TocItem {
  level: number;
  title: string;
  slug: string;
  line: number;
}

export interface FileData {
  name: string;
  path: string;
  extension: string;
  is_markdown: boolean;
  size_bytes: number;
  modified_time: string;
  lines_count: number;
  word_count: number;
  reading_time_minutes: number;
  frontmatter: Record<string, any>;
  toc: TocItem[];
  content: string;
  breadcrumbs: Breadcrumb[];
}

export interface SearchSnippet {
  line_number: number;
  text: string;
}

export interface SearchResult {
  name: string;
  path: string;
  extension: string;
  matched_in_filename: boolean;
  matches_count: number;
  snippets: SearchSnippet[];
}

export interface SearchResponse {
  query: string;
  total_matches: number;
  results: SearchResult[];
}

export interface StatsResponse {
  root: string;
  total_markdown_files: number;
  total_directories: number;
  recent_files: {
    name: string;
    path: string;
    size: number;
    modified_time: string;
  }[];
}
