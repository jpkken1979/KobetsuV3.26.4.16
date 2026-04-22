import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Check, Download, Loader2, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { HeroSkeleton, StatCardSkeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/design-preview")({
  component: DesignPreview,
});

function DesignPreview() {
  const [loading, setLoading] = useState(false);

  return (
    <div className="min-h-screen p-8 space-y-10">
      {/* Hero header */}
      <header className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          <Sparkles className="h-3 w-3 text-primary" />
          <span>Fase 1 · Primitives · Path B Hypercar Aurora</span>
        </div>
        <h1 className="text-display text-6xl text-gradient">Design Preview</h1>
        <p className="max-w-2xl text-muted-foreground">
          Showcase de los 7 primitives foundation rediseñados. Aprobá esta estética antes de aplicarla a las ~20 rutas.
        </p>
      </header>

      {/* Buttons */}
      <Section title="Buttons" description="Primary con gradient rojo→naranja + shine permanente. Rounded-md.">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
          <Button variant="success">Success</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="default">Default</Button>
          <Button size="lg">Large</Button>
          <Button size="icon" aria-label="Add">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button loading={loading} onClick={() => {
            setLoading(true);
            setTimeout(() => setLoading(false), 2000);
          }}>
            {loading ? "Loading..." : "Click to load"}
          </Button>
          <Button disabled>Disabled</Button>
          <Button>
            Continue <ArrowRight className="h-4 w-4" />
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4" /> Download PDF
          </Button>
          <Button variant="destructive">
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </div>
      </Section>

      {/* Cards */}
      <Section title="Cards" description="4 variantes. Hero con aurora-border rotando. Elevated con spotlight cursor-follow.">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card className="p-5 space-y-2">
            <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Default</div>
            <div className="text-display text-3xl">336</div>
            <p className="text-sm text-muted-foreground">社員在籍</p>
          </Card>
          <Card variant="elevated" spotlight className="p-5 space-y-2">
            <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Elevated + Spotlight</div>
            <div className="text-display text-3xl">16</div>
            <p className="text-sm text-muted-foreground">有効契約 · mové el mouse</p>
          </Card>
          <Card variant="hero" className="p-5 space-y-2">
            <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Hero · Aurora</div>
            <div className="text-display text-3xl bg-[linear-gradient(135deg,var(--color-primary),var(--color-accent))] bg-clip-text text-transparent">
              ¥8.4M
            </div>
            <p className="text-sm text-muted-foreground">月次売上</p>
          </Card>
          <Card variant="glass" className="p-5 space-y-2">
            <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Glass</div>
            <div className="text-display text-3xl mono-tabular">98.2<span className="text-base text-muted-foreground">%</span></div>
            <p className="text-sm text-muted-foreground">稼働率</p>
          </Card>
        </div>
      </Section>

      {/* Badges */}
      <Section title="Badges" description="10 variantes con status tokens + 2 sizes + pulse.">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="active">Active</Badge>
          <Badge variant="alert">Alert</Badge>
          <Badge variant="info">Info</Badge>
          <Badge variant="pending">Pending</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge size="sm">SM</Badge>
          <Badge size="md">MD</Badge>
          <Badge dot variant="active">Live</Badge>
          <Badge dot pulse variant="alert">Alert · Pulsing</Badge>
          <Badge dot variant="info">Info</Badge>
          <Badge variant="success" dot>
            在籍 336
          </Badge>
        </div>
        {/* Chip status (utility nueva) */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <span className="chip-status chip-status-ok">OK</span>
          <span className="chip-status chip-status-warn">WARN</span>
          <span className="chip-status chip-status-err">ERROR</span>
          <span className="chip-status chip-status-info">INFO</span>
          <span className="chip-status chip-status-pend">PENDING</span>
          <span className="chip-status chip-status-neutral">NEUTRAL</span>
        </div>
      </Section>

      {/* Inputs */}
      <Section title="Inputs" description="Focus con doble glow soft + shadow premium. rounded-md.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
          <Input placeholder="氏名を入力..." />
          <Input icon={Search} placeholder="社員検索..." />
          <Input placeholder="単価" suffix={<span className="text-xs text-muted-foreground">円</span>} />
          <Input placeholder="Error state" error="この項目は必須です" />
          <Select defaultValue="tokyo">
            <option value="tokyo">東京工場</option>
            <option value="osaka">大阪工場</option>
            <option value="nagoya">名古屋工場</option>
          </Select>
          <Input disabled placeholder="Disabled" />
        </div>
        <Textarea placeholder="備考・特記事項..." className="max-w-3xl" />
      </Section>

      {/* Skeletons */}
      <Section title="Skeletons" description="Shimmer smooth + Hero skeleton con aurora-border.">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <HeroSkeleton />
        </div>
      </Section>

      {/* Typography */}
      <Section title="Typography" description="Display (heroes) + mono-tabular (números).">
        <div className="space-y-3">
          <div className="text-display text-7xl">336</div>
          <div className="text-display text-5xl text-gradient">ユニバーサル企画</div>
          <div className="text-display text-3xl mono-tabular">¥ 8,432,100</div>
          <p className="text-sm text-muted-foreground">
            Body regular · Noto Sans JP + Space Grotesk. Heading <span className="text-foreground font-semibold">強調</span> con peso 600.
          </p>
        </div>
      </Section>

      {/* Utility showcase */}
      <Section title="Utility Showcase" description="Nuevas utilities Path B disponibles para el resto del sistema.">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-md border border-border/60 bg-card p-4 noise">
            <p className="text-sm font-semibold mb-1">.noise</p>
            <p className="text-xs text-muted-foreground">Grain sutil + blend overlay</p>
          </div>
          <div className="rounded-md border border-border/60 bg-card p-4 hover-lift">
            <p className="text-sm font-semibold mb-1">.hover-lift</p>
            <p className="text-xs text-muted-foreground">Hover levanta 2px + shadow</p>
          </div>
          <div className="relative rounded-md border border-border/60 bg-card p-4 shine-hover overflow-hidden">
            <p className="text-sm font-semibold mb-1 relative z-10">.shine-hover</p>
            <p className="text-xs text-muted-foreground relative z-10">Barrido luminoso al hover</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="live-dot text-[var(--color-status-ok)]" />
          <span className="text-sm text-muted-foreground">Live-dot con pulse animado</span>
        </div>
        <div className="sep-fade" />
        <div className="flex items-center gap-3">
          <Button className="spotlight">
            <Check className="h-4 w-4" />
            Premium CTA
          </Button>
          <span className="text-xs text-muted-foreground">Button + shine + spotlight combo</span>
        </div>
      </Section>

      {/* Color palette */}
      <Section title="Color Tokens" description="Status tokens nuevos + chart tokens.">
        <div className="grid grid-cols-6 gap-3">
          <Swatch color="var(--color-primary)" label="primary" />
          <Swatch color="var(--color-accent)" label="accent" />
          <Swatch color="var(--color-status-ok)" label="status-ok" />
          <Swatch color="var(--color-status-warning)" label="status-warn" />
          <Swatch color="var(--color-status-error)" label="status-error" />
          <Swatch color="var(--color-status-info)" label="status-info" />
          <Swatch color="var(--color-status-pending)" label="status-pending" />
          <Swatch color="var(--color-status-neutral)" label="status-neutral" />
          <Swatch color="var(--color-chart-1)" label="chart-1" />
          <Swatch color="var(--color-chart-2)" label="chart-2" />
          <Swatch color="var(--color-chart-3)" label="chart-3" />
          <Swatch color="var(--color-chart-4)" label="chart-4" />
          <Swatch color="var(--color-chart-5)" label="chart-5" />
          <Swatch color="var(--color-chart-6)" label="chart-6" />
          <Swatch color="var(--color-chart-7)" label="chart-7" />
          <Swatch color="var(--color-chart-8)" label="chart-8" />
        </div>
      </Section>

      <footer className="pt-8 text-xs text-muted-foreground">
        Ruta experimental. No afecta al resto de la app. Mergeable como feature flag.
      </footer>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-baseline gap-3">
        <h2 className="text-display text-2xl">{title}</h2>
        <Loader2 className="hidden" />
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="space-y-1.5">
      <div
        className="h-14 w-full rounded-md border border-border/60"
        style={{ backgroundColor: color }}
      />
      <div className="text-[0.625rem] font-mono text-muted-foreground">{label}</div>
    </div>
  );
}
