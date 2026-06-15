export interface UserOut {
  id: number;
  email: string;
  subscription_tier: string;
  created_at: string;
}

export interface Token {
  access_token: string;
  token_type: string;
}

export interface KeywordOut {
  id: number;
  keyword_text: string;
  target_domain: string;
  competitor_domains: string[];
  last_checked: string | null;
  created_at: string;
}

export interface CompetitorMention {
  is_mentioned: boolean;
  citation_rank: number | null;
}

export interface Suggestion {
  category: string;
  issue: string;
  recommendation: string;
}

export interface RankHistoryOut {
  id: number;
  is_mentioned: boolean;
  ai_response_snippet: string | null;
  source_url: string | null;
  citation_rank: number | null;
  competitor_mentions: Record<string, CompetitorMention>;
  suggestions: Suggestion[];
  checked_at: string;
}

export interface RankCheckResult {
  keyword_id: number;
  is_mentioned: boolean;
  citation_rank: number | null;
  ai_response_snippet: string | null;
  source_url: string | null;
  competitor_mentions: Record<string, CompetitorMention>;
  suggestions: Suggestion[];
  checked_at: string;
  from_cache: boolean;
}

export interface AuditOut {
  id: number;
  content_title: string;
  geo_score: number;
  suggestions_json: {
    geo_score: number;
    suggestions: Suggestion[];
  };
  created_at: string;
}
