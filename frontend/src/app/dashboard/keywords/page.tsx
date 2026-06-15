"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import * as api from "@/lib/api";
import { ApiError } from "@/lib/api";
import type { KeywordOut, RankCheckResult, RankHistoryOut } from "@/lib/types";
import { geoCategoryLabel } from "@/lib/geo-categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, RefreshCw, Trash2, History as HistoryIcon, Pencil } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const TREND_COLORS = ["var(--chart-2)", "var(--chart-1)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function parseDomainList(value: string): string[] {
  return value
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);
}

export default function KeywordsPage() {
  const { token } = useAuth();
  const [keywords, setKeywords] = useState<KeywordOut[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [checkingId, setCheckingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [keywordText, setKeywordText] = useState("");
  const [targetDomain, setTargetDomain] = useState("");
  const [competitorDomainsText, setCompetitorDomainsText] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [historyKeyword, setHistoryKeyword] = useState<KeywordOut | null>(null);
  const [history, setHistory] = useState<RankHistoryOut[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [resultKeyword, setResultKeyword] = useState<KeywordOut | null>(null);
  const [checkResult, setCheckResult] = useState<RankCheckResult | null>(null);

  const [editKeyword, setEditKeyword] = useState<KeywordOut | null>(null);
  const [editCompetitorsText, setEditCompetitorsText] = useState("");
  const [isSavingCompetitors, setIsSavingCompetitors] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const loadKeywords = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const data = await api.getKeywords(token);
      setKeywords(data);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load keywords");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount data load
    loadKeywords();
  }, [loadKeywords]);

  async function handleAddKeyword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setFormError(null);
    setIsCreating(true);
    try {
      const created = await api.createKeyword(
        token,
        keywordText,
        targetDomain,
        parseDomainList(competitorDomainsText)
      );
      setKeywords((prev) => [created, ...prev]);
      setKeywordText("");
      setTargetDomain("");
      setCompetitorDomainsText("");
      setAddOpen(false);
      toast.success("Keyword added");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to add keyword");
    } finally {
      setIsCreating(false);
    }
  }

  function openEditCompetitors(keyword: KeywordOut) {
    setEditKeyword(keyword);
    setEditCompetitorsText(keyword.competitor_domains.join(", "));
    setEditError(null);
  }

  async function handleSaveCompetitors(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !editKeyword) return;
    setEditError(null);
    setIsSavingCompetitors(true);
    try {
      const updated = await api.updateKeyword(
        token,
        editKeyword.id,
        parseDomainList(editCompetitorsText)
      );
      setKeywords((prev) => prev.map((k) => (k.id === updated.id ? updated : k)));
      setEditKeyword(null);
      toast.success("Competitors updated");
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : "Failed to update competitors");
    } finally {
      setIsSavingCompetitors(false);
    }
  }

  async function handleCheck(keyword: KeywordOut) {
    if (!token) return;
    setCheckingId(keyword.id);
    try {
      const result = await api.checkKeyword(token, keyword.id);
      setKeywords((prev) =>
        prev.map((k) =>
          k.id === keyword.id ? { ...k, last_checked: result.checked_at } : k
        )
      );
      setResultKeyword(keyword);
      setCheckResult(result);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to check keyword");
    } finally {
      setCheckingId(null);
    }
  }

  async function handleDelete(keyword: KeywordOut) {
    if (!token) return;
    setDeletingId(keyword.id);
    try {
      await api.deleteKeyword(token, keyword.id);
      setKeywords((prev) => prev.filter((k) => k.id !== keyword.id));
      toast.success("Keyword deleted");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete keyword");
    } finally {
      setDeletingId(null);
    }
  }

  async function openHistory(keyword: KeywordOut) {
    if (!token) return;
    setHistoryKeyword(keyword);
    setHistoryLoading(true);
    try {
      const data = await api.getKeywordHistory(token, keyword.id);
      setHistory(data);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load history");
    } finally {
      setHistoryLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI Rank Tracker</h1>
          <p className="text-sm text-muted-foreground">
            Track whether your domain is mentioned or cited by AI search engines for
            your target keywords.
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger
            render={
              <Button>
                <Plus className="h-4 w-4" />
                Add keyword
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add a keyword</DialogTitle>
              <DialogDescription>
                We&apos;ll check AI search engines for mentions of your target domain
                when you run a check.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddKeyword} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="keyword_text">Keyword / query</Label>
                <Input
                  id="keyword_text"
                  placeholder="best CRM tools for small businesses"
                  required
                  value={keywordText}
                  onChange={(e) => setKeywordText(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="target_domain">Your brand, business name, or domain</Label>
                <Input
                  id="target_domain"
                  placeholder="e.g. Atrium Palace Resort or example.com"
                  required
                  value={targetDomain}
                  onChange={(e) => setTargetDomain(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  We&apos;ll check if this is mentioned anywhere in the AI&apos;s answer -
                  even if it links to a review site or directory instead of your own
                  website. Use whichever name people would recognize (e.g. your hotel
                  or business name), not just your domain.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="competitor_domains">Competitor brands or domains (optional)</Label>
                <Input
                  id="competitor_domains"
                  placeholder="Competitor Hotel Name, competitor2.com"
                  value={competitorDomainsText}
                  onChange={(e) => setCompetitorDomainsText(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated. We&apos;ll check whether these are also mentioned,
                  for benchmarking.
                </p>
              </div>
              {formError && <p className="text-sm text-destructive">{formError}</p>}
              <DialogFooter>
                <Button type="submit" disabled={isCreating}>
                  {isCreating && <Loader2 className="h-4 w-4 animate-spin" />}
                  Add keyword
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tracked keywords</CardTitle>
          <CardDescription>
            {keywords.length} keyword{keywords.length === 1 ? "" : "s"} tracked
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : keywords.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No keywords yet. Add one to start tracking your AI search visibility.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Keyword</TableHead>
                  <TableHead>Target domain</TableHead>
                  <TableHead>Competitors</TableHead>
                  <TableHead>Last checked</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keywords.map((keyword) => (
                  <TableRow key={keyword.id}>
                    <TableCell className="font-medium">{keyword.keyword_text}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{keyword.target_domain}</Badge>
                    </TableCell>
                    <TableCell>
                      {keyword.competitor_domains.length === 0 ? (
                        <span className="text-sm text-muted-foreground">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {keyword.competitor_domains.map((domain) => (
                            <Badge key={domain} variant="outline">
                              {domain}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {keyword.last_checked
                        ? new Date(keyword.last_checked).toLocaleString()
                        : "Never"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="icon"
                          title="Edit competitors"
                          onClick={() => openEditCompetitors(keyword)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          title="Check now"
                          onClick={() => handleCheck(keyword)}
                          disabled={checkingId === keyword.id}
                        >
                          {checkingId === keyword.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          title="View history"
                          onClick={() => openHistory(keyword)}
                        >
                          <HistoryIcon className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Delete keyword"
                          onClick={() => handleDelete(keyword)}
                          disabled={deletingId === keyword.id}
                        >
                          {deletingId === keyword.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-destructive" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!historyKeyword} onOpenChange={(open) => !open && setHistoryKeyword(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>History for &ldquo;{historyKeyword?.keyword_text}&rdquo;</DialogTitle>
            <DialogDescription>
              Past results for {historyKeyword?.target_domain}
            </DialogDescription>
          </DialogHeader>
          {historyLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No checks have been run yet.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              <SovTrendChart history={history} keyword={historyKeyword} />
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Mentioned</TableHead>
                      <TableHead>Citation rank</TableHead>
                      {historyKeyword?.competitor_domains.map((domain) => (
                        <TableHead key={domain}>{domain}</TableHead>
                      ))}
                      <TableHead>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="text-muted-foreground">
                          {new Date(entry.checked_at).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant={entry.is_mentioned ? "default" : "secondary"}>
                            {entry.is_mentioned ? "Yes" : "No"}
                          </Badge>
                        </TableCell>
                        <TableCell>{entry.citation_rank ?? "—"}</TableCell>
                        {historyKeyword?.competitor_domains.map((domain) => {
                          const mention = entry.competitor_mentions[domain];
                          return (
                            <TableCell key={domain}>
                              <Badge variant={mention?.is_mentioned ? "default" : "secondary"}>
                                {mention?.is_mentioned ? "Yes" : "No"}
                              </Badge>
                            </TableCell>
                          );
                        })}
                        <TableCell className="max-w-[200px] truncate">
                          {entry.source_url ? (
                            <a
                              href={entry.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary underline"
                            >
                              {entry.source_url}
                            </a>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editKeyword} onOpenChange={(open) => !open && setEditKeyword(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit competitors</DialogTitle>
            <DialogDescription>
              Update the competitor brands or domains tracked for &ldquo;
              {editKeyword?.keyword_text}&rdquo;.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveCompetitors} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit_competitor_domains">Competitor brands or domains</Label>
              <Input
                id="edit_competitor_domains"
                placeholder="Competitor Hotel Name, competitor2.com"
                value={editCompetitorsText}
                onChange={(e) => setEditCompetitorsText(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated, up to 10. Use brand/business names or domains.
              </p>
            </div>
            {editError && <p className="text-sm text-destructive">{editError}</p>}
            <DialogFooter>
              <Button type="submit" disabled={isSavingCompetitors}>
                {isSavingCompetitors && <Loader2 className="h-4 w-4 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!resultKeyword}
        onOpenChange={(open) => {
          if (!open) {
            setResultKeyword(null);
            setCheckResult(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Check result for &ldquo;{resultKeyword?.keyword_text}&rdquo;</DialogTitle>
            <DialogDescription>
              {checkResult?.from_cache
                ? "Showing the most recent cached result."
                : "Fresh result from an AI search just now."}
            </DialogDescription>
          </DialogHeader>
          {checkResult && resultKeyword && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm font-medium">{resultKeyword.target_domain}</span>
                <Badge variant={checkResult.is_mentioned ? "default" : "secondary"}>
                  {checkResult.is_mentioned
                    ? `Mentioned${
                        checkResult.citation_rank ? ` (citation #${checkResult.citation_rank})` : ""
                      }`
                    : "Not mentioned"}
                </Badge>
              </div>

              {resultKeyword.competitor_domains.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-sm font-medium text-muted-foreground">Competitors</p>
                  {resultKeyword.competitor_domains.map((domain) => {
                    const mention = checkResult.competitor_mentions?.[domain];
                    return (
                      <div
                        key={domain}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <span className="text-sm">{domain}</span>
                        <Badge variant={mention?.is_mentioned ? "default" : "secondary"}>
                          {mention?.is_mentioned
                            ? `Mentioned${
                                mention.citation_rank ? ` (citation #${mention.citation_rank})` : ""
                              }`
                            : "Not mentioned"}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}

              {checkResult.ai_response_snippet && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-sm font-medium text-muted-foreground">
                    What the AI said
                  </p>
                  <p className="rounded-lg border bg-muted/30 p-3 text-sm">
                    &ldquo;{checkResult.ai_response_snippet}&rdquo;
                  </p>
                </div>
              )}

              {checkResult.source_url && (
                <a
                  href={checkResult.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary underline"
                >
                  {checkResult.source_url}
                </a>
              )}

              {!checkResult.is_mentioned && (
                <div className="flex flex-col gap-3">
                  <p className="text-sm font-medium text-muted-foreground">
                    What to do to show up for this search
                  </p>
                  {(checkResult.suggestions ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No suggestions available.</p>
                  ) : (
                    (checkResult.suggestions ?? []).map((suggestion, idx) => (
                      <div key={idx} className="rounded-lg border p-3">
                        <div className="mb-1 flex items-center gap-2">
                          <Badge variant="outline">{geoCategoryLabel(suggestion.category)}</Badge>
                        </div>
                        <p className="text-sm font-medium">{suggestion.issue}</p>
                        <p className="text-sm text-muted-foreground">{suggestion.recommendation}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SovTrendChart({
  history,
  keyword,
}: {
  history: RankHistoryOut[];
  keyword: KeywordOut | null;
}) {
  const competitorDomains = keyword?.competitor_domains ?? [];
  const targetDomain = keyword?.target_domain ?? "you";

  const chartData = [...history]
    .sort((a, b) => new Date(a.checked_at).getTime() - new Date(b.checked_at).getTime())
    .map((entry) => {
      const point: Record<string, string | number> = {
        date: new Date(entry.checked_at).toLocaleDateString(),
        [targetDomain]: entry.is_mentioned ? 1 : 0,
      };
      competitorDomains.forEach((domain) => {
        point[domain] = entry.competitor_mentions[domain]?.is_mentioned ? 1 : 0;
      });
      return point;
    });

  return (
    <div>
      <p className="mb-2 text-sm font-medium">Mention trend</p>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis
            domain={[0, 1]}
            ticks={[0, 1]}
            tickFormatter={(value) => (value === 1 ? "Mentioned" : "Not mentioned")}
            tick={{ fontSize: 12 }}
            width={90}
          />
          <Tooltip formatter={(value) => (value === 1 ? "Mentioned" : "Not mentioned")} />
          <Legend />
          <Line
            type="stepAfter"
            dataKey={targetDomain}
            stroke={TREND_COLORS[0]}
            strokeWidth={2}
            dot={{ r: 3 }}
          />
          {competitorDomains.map((domain, index) => (
            <Line
              key={domain}
              type="stepAfter"
              dataKey={domain}
              stroke={TREND_COLORS[(index + 1) % TREND_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
