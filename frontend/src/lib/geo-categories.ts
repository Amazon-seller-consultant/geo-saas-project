export const GEO_CATEGORY_LABELS: Record<string, string> = {
  answer_first: "Answer-First Structure",
  entity_clarity: "Entity Clarity",
  structured_data: "Structured Data",
  conversational_qa: "Conversational Q&A",
  eeat_signals: "E-E-A-T Signals",
  content_depth: "Content Depth",
  freshness: "Freshness",
  technical_crawlability: "AI Crawler Access",
};

export function geoCategoryLabel(category: string): string {
  return GEO_CATEGORY_LABELS[category] ?? category;
}
