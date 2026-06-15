"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import * as api from "@/lib/api";
import { ApiError } from "@/lib/api";
import type { AuditOut } from "@/lib/types";
import { geoCategoryLabel } from "@/lib/geo-categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";

function scoreVariant(score: number): "default" | "secondary" | "destructive" {
  if (score >= 70) return "default";
  if (score >= 40) return "secondary";
  return "destructive";
}

export default function AuditsPage() {
  const { token } = useAuth();
  const [audits, setAudits] = useState<AuditOut[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [latestResult, setLatestResult] = useState<AuditOut | null>(null);
  const [selectedAudit, setSelectedAudit] = useState<AuditOut | null>(null);

  const loadAudits = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const data = await api.getAudits(token);
      setAudits(data);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load audits");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount data load
    loadAudits();
  }, [loadAudits]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setFormError(null);

    const payload: { content?: string; url?: string; title?: string } = {};
    if (title.trim()) payload.title = title.trim();
    if (content.trim()) payload.content = content.trim();
    if (url.trim()) payload.url = url.trim();

    if (!payload.content && !payload.url) {
      setFormError("Provide either page content or a URL to audit.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await api.createAudit(token, payload);
      setAudits((prev) => [result, ...prev]);
      setLatestResult(result);
      setTitle("");
      setContent("");
      setUrl("");
      toast.success("Audit complete");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to run audit");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">GEO Content Auditor</h1>
        <p className="text-sm text-muted-foreground">
          Score your content for AI-search optimization and get actionable
          recommendations.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>New audit</CardTitle>
            <CardDescription>
              Paste your content or provide a URL to fetch and analyze.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="title">Title (optional)</Label>
                <Input
                  id="title"
                  placeholder="e.g. CRM Buyer's Guide"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <Tabs defaultValue="content">
                <TabsList className="w-full">
                  <TabsTrigger value="content" className="flex-1">
                    Paste content
                  </TabsTrigger>
                  <TabsTrigger value="url" className="flex-1">
                    From URL
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="content" className="flex flex-col gap-2 pt-2">
                  <Label htmlFor="content">Page content</Label>
                  <Textarea
                    id="content"
                    placeholder="Paste the article or page copy here..."
                    rows={8}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  />
                </TabsContent>
                <TabsContent value="url" className="flex flex-col gap-2 pt-2">
                  <Label htmlFor="url">Page URL</Label>
                  <Input
                    id="url"
                    type="url"
                    placeholder="https://example.com/blog/post"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                </TabsContent>
              </Tabs>
              {formError && <p className="text-sm text-destructive">{formError}</p>}
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Run audit
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latest result</CardTitle>
            <CardDescription>GEO score and recommendations</CardDescription>
          </CardHeader>
          <CardContent>
            {!latestResult ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Run an audit to see your GEO score and suggestions here.
              </p>
            ) : (
              <AuditResultDetails audit={latestResult} />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Past audits</CardTitle>
          <CardDescription>
            {audits.length} audit{audits.length === 1 ? "" : "s"} run
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : audits.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No audits yet.
            </p>
          ) : (
            <div className="flex flex-col divide-y">
              {audits.map((audit) => (
                <button
                  key={audit.id}
                  onClick={() => setSelectedAudit(audit)}
                  className="flex items-center justify-between gap-4 py-3 text-left transition-colors hover:bg-muted/50"
                >
                  <div>
                    <p className="font-medium">{audit.content_title}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(audit.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant={scoreVariant(audit.geo_score)}>
                    {audit.geo_score} / 100
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedAudit} onOpenChange={(open) => !open && setSelectedAudit(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedAudit?.content_title}</DialogTitle>
            <DialogDescription>
              {selectedAudit && new Date(selectedAudit.created_at).toLocaleString()}
            </DialogDescription>
          </DialogHeader>
          {selectedAudit && <AuditResultDetails audit={selectedAudit} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AuditResultDetails({ audit }: { audit: AuditOut }) {
  const suggestions = audit.suggestions_json?.suggestions ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">GEO Score</span>
          <span className="text-2xl font-semibold">{audit.geo_score} / 100</span>
        </div>
        <Progress value={audit.geo_score} />
      </div>
      {suggestions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No suggestions provided.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {suggestions.map((suggestion, idx) => (
            <div key={idx} className="rounded-lg border p-3">
              <div className="mb-1 flex items-center gap-2">
                <Badge variant="outline">{geoCategoryLabel(suggestion.category)}</Badge>
              </div>
              <p className="text-sm font-medium">{suggestion.issue}</p>
              <p className="text-sm text-muted-foreground">{suggestion.recommendation}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
