"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import * as api from "@/lib/api";
import { ApiError } from "@/lib/api";
import type { AuditOut, KeywordOut } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  CartesianGrid,
} from "recharts";
import { toast } from "sonner";
import { Loader2, Search, FileSearch, TrendingUp, Eye } from "lucide-react";

const SOV_COLORS = ["var(--chart-1)", "var(--chart-3)"];

interface BenchmarkEntry {
  name: string;
  sov: number;
  checks: number;
}

interface OverviewData {
  keywords: KeywordOut[];
  mentionedCount: number;
  notMentionedCount: number;
  uncheckedCount: number;
  audits: AuditOut[];
  benchmark: BenchmarkEntry[];
}

export default function DashboardOverviewPage() {
  const { token } = useAuth();
  const [data, setData] = useState<OverviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const [keywords, audits] = await Promise.all([
        api.getKeywords(token),
        api.getAudits(token),
      ]);

      const checkedKeywords = keywords.filter((k) => k.last_checked);
      const histories = await Promise.all(
        checkedKeywords.map((k) => api.getKeywordHistory(token, k.id))
      );

      let mentionedCount = 0;
      let notMentionedCount = 0;
      let yourMentioned = 0;
      let yourChecks = 0;
      const competitorStats = new Map<string, { mentioned: number; checks: number }>();

      checkedKeywords.forEach((keyword, i) => {
        const latest = histories[i][0];
        if (!latest) return;

        if (latest.is_mentioned) mentionedCount += 1;
        else notMentionedCount += 1;

        yourChecks += 1;
        if (latest.is_mentioned) yourMentioned += 1;

        keyword.competitor_domains.forEach((domain) => {
          const stats = competitorStats.get(domain) ?? { mentioned: 0, checks: 0 };
          stats.checks += 1;
          if (latest.competitor_mentions[domain]?.is_mentioned) stats.mentioned += 1;
          competitorStats.set(domain, stats);
        });
      });

      const benchmark: BenchmarkEntry[] = [];
      if (yourChecks > 0) {
        benchmark.push({
          name: "You",
          sov: Math.round((yourMentioned / yourChecks) * 100),
          checks: yourChecks,
        });
      }
      competitorStats.forEach((stats, domain) => {
        if (stats.checks === 0) return;
        benchmark.push({
          name: domain,
          sov: Math.round((stats.mentioned / stats.checks) * 100),
          checks: stats.checks,
        });
      });

      setData({
        keywords,
        mentionedCount,
        notMentionedCount,
        uncheckedCount: keywords.length - checkedKeywords.length,
        audits,
        benchmark,
      });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load dashboard");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount data load
    load();
  }, [load]);

  if (isLoading || !data) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalChecked = data.mentionedCount + data.notMentionedCount;
  const sovPercent = totalChecked > 0
    ? Math.round((data.mentionedCount / totalChecked) * 100)
    : 0;

  const pieData = [
    { name: "Mentioned", value: data.mentionedCount },
    { name: "Not mentioned", value: data.notMentionedCount },
  ];

  const avgScore = data.audits.length > 0
    ? Math.round(
        data.audits.reduce((sum, a) => sum + a.geo_score, 0) / data.audits.length
      )
    : 0;

  const scoreHistory = [...data.audits]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((audit) => ({
      date: new Date(audit.created_at).toLocaleDateString(),
      score: audit.geo_score,
      title: audit.content_title,
    }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">
          Your AI search visibility and content optimization at a glance.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          icon={Search}
          label="Tracked keywords"
          value={data.keywords.length.toString()}
        />
        <SummaryCard
          icon={Eye}
          label="Share of voice"
          value={totalChecked > 0 ? `${sovPercent}%` : "—"}
          hint={
            totalChecked > 0
              ? `${data.mentionedCount} of ${totalChecked} checks`
              : "No checks yet"
          }
        />
        <SummaryCard
          icon={FileSearch}
          label="Audits run"
          value={data.audits.length.toString()}
        />
        <SummaryCard
          icon={TrendingUp}
          label="Avg. GEO score"
          value={data.audits.length > 0 ? `${avgScore}` : "—"}
          hint={data.audits.length > 0 ? "out of 100" : "No audits yet"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Share of Voice</CardTitle>
            <CardDescription>
              How often your domain is mentioned across the latest checks for each
              tracked keyword.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {totalChecked === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                Run a check on a keyword to see your share of voice.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={entry.name} fill={SOV_COLORS[index % SOV_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>GEO Score History</CardTitle>
            <CardDescription>
              Content audit scores over time.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {scoreHistory.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                Run a content audit to start tracking your GEO score.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={scoreHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="var(--chart-2)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Competitive Benchmarking</CardTitle>
            <CardDescription>
              Share of voice for you vs. tracked competitor domains, based on the
              latest check for each keyword.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.benchmark.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                Add competitor domains to your keywords and run checks to see
                benchmarking data.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.benchmark}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
                  <Tooltip formatter={(value) => `${value}%`} />
                  <Bar dataKey="sov" name="Share of voice" radius={[4, 4, 0, 0]}>
                    {data.benchmark.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={entry.name === "You" ? "var(--chart-1)" : "var(--chart-3)"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 pt-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold">{value}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
