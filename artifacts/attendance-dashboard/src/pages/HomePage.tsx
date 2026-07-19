import React from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import {
  useGetAttendanceStats,
  useListClasses,
  useListStudents,
  useListExcuses,
} from '@workspace/api-client-react';
import {
  LayoutDashboard,
  Sparkles,
  Users,
  BookOpen,
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  ShieldAlert,
  FileText,
  BarChart3,
  ClipboardCheck,
  Brain,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Stat card ──────────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  loading,
}: {
  label: string;
  value: string | number | undefined;
  loading: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1 px-6 py-5 border-r border-white/10 last:border-0">
      <span
        className={cn(
          'text-3xl font-bold text-white tracking-tight',
          loading && 'opacity-40 blur-sm select-none',
        )}
      >
        {loading ? '—' : value}
      </span>
      <span className="text-sm text-blue-100/70 text-center leading-tight">{label}</span>
    </div>
  );
}

// ── Feature card ───────────────────────────────────────────────────────────────
function FeatureCard({
  icon: Icon,
  iconBg,
  title,
  description,
  bullets,
  href,
  cta,
  highlight,
}: {
  icon: React.ElementType;
  iconBg: string;
  title: string;
  description: string;
  bullets: string[];
  href: string;
  cta: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        'relative flex flex-col rounded-2xl border bg-white p-8 shadow-sm transition-shadow hover:shadow-md',
        highlight ? 'border-primary/30 ring-1 ring-primary/20' : 'border-border',
      )}
    >
      {highlight && (
        <span className="absolute top-5 right-5 rounded-full bg-primary/10 px-3 py-0.5 text-xs font-semibold text-primary">
          Core feature
        </span>
      )}
      <div
        className={cn(
          'mb-5 flex h-12 w-12 items-center justify-center rounded-xl',
          iconBg,
        )}
      >
        <Icon className="h-6 w-6 text-white" />
      </div>

      <h3 className="text-xl font-bold text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed mb-6">{description}</p>

      <ul className="space-y-2 mb-8 flex-1">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2 text-sm text-foreground/80">
            <CheckCircle2 className="h-4 w-4 text-status-present mt-0.5 shrink-0" />
            {b}
          </li>
        ))}
      </ul>

      <Link href={href}>
        <Button
          className={cn('w-full gap-2', highlight ? '' : 'bg-foreground text-background hover:bg-foreground/90')}
        >
          {cta}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </Link>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function HomePage() {
  const { data: stats, isLoading: statsLoading } = useGetAttendanceStats();
  const { data: classes, isLoading: classesLoading } = useListClasses();
  const { data: students, isLoading: studentsLoading } = useListStudents();
  const { data: excuses, isLoading: excusesLoading } = useListExcuses();

  const attendanceRate =
    stats?.attendanceRate != null ? `${Math.round(stats.attendanceRate)}%` : undefined;

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-lg shadow-sm">
              A
            </div>
            <span className="font-semibold text-lg tracking-tight text-foreground">Attend</span>
          </Link>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-1">
            {[
              { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
              { label: 'Classes', href: '/classes', icon: BookOpen },
              { label: 'Students', href: '/students', icon: Users },
              { label: 'Excuses', href: '/excuses', icon: Sparkles },
            ].map(({ label, href, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            ))}
          </nav>

          {/* CTA */}
          <Link href="/dashboard">
            <Button className="gap-2 shadow-sm">
              Open Dashboard
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden"
        style={{
          background:
            'linear-gradient(135deg, hsl(221,83%,28%) 0%, hsl(221,83%,42%) 60%, hsl(230,70%,55%) 100%)',
        }}
      >
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        {/* Glow blobs */}
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-blue-400/20 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-indigo-600/20 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-6 py-24 md:py-32">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium text-white/90 backdrop-blur-sm">
            <ClipboardCheck className="h-4 w-4" />
            Student Attendance Platform
          </div>

          <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tight max-w-3xl leading-[1.1] mb-6">
            Know exactly who's{' '}
            <span className="text-blue-200">in the room.</span>
          </h1>

          <p className="max-w-xl text-lg text-blue-100/80 leading-relaxed mb-10">
            Attend gives educators real-time attendance insights, AI-powered excuse analysis, and
            automatic at-risk student detection — all in one clean, fast interface.
          </p>

          <div className="flex flex-wrap gap-4">
            <Link href="/dashboard">
              <Button
                size="lg"
                className="gap-2 bg-white text-primary font-semibold hover:bg-white/90 shadow-lg"
              >
                <LayoutDashboard className="h-4 w-4" />
                Go to Dashboard
              </Button>
            </Link>
            <Link href="/excuses">
              <Button
                size="lg"
                variant="outline"
                className="gap-2 border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white backdrop-blur-sm"
              >
                <Sparkles className="h-4 w-4" />
                Try Excuse Analyzer
              </Button>
            </Link>
          </div>
        </div>

        {/* ── Live stats strip ──────────────────────────────────────────────── */}
        <div
          className="relative border-t border-white/10 bg-white/5 backdrop-blur-sm"
        >
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-white/10">
              <StatCard
                label="Students Enrolled"
                value={students?.length}
                loading={studentsLoading}
              />
              <StatCard
                label="Active Classes"
                value={classes?.length}
                loading={classesLoading}
              />
              <StatCard
                label="Overall Attendance Rate"
                value={attendanceRate}
                loading={statsLoading}
              />
              <StatCard
                label="Excuses Analyzed"
                value={excuses?.length}
                loading={excusesLoading}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature cards ──────────────────────────────────────────────────── */}
      <section className="bg-muted/40 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-foreground mb-3">
              Everything you need to run a tight classroom
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Two powerful tools, one unified system. No spreadsheets, no paper rosters, no guesswork.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <FeatureCard
              icon={BarChart3}
              iconBg="bg-primary"
              title="Attendance Dashboard"
              description="Mark attendance in seconds, track trends over time, and surface students who need intervention before they fall too far behind."
              bullets={[
                'Bulk mark an entire class with one click',
                'Automatic at-risk flagging below 85% attendance',
                '30-day trend charts per class and school-wide',
                'Per-student activity grid and absence history',
              ]}
              href="/dashboard"
              cta="Open Dashboard"
              highlight
            />
            <FeatureCard
              icon={Brain}
              iconBg="bg-indigo-600"
              title="AI Excuse Analyzer"
              description="Paste any parent note or email. The analyzer scores it against school policy patterns and returns a verdict, reasoning, and a suggested action — instantly."
              bullets={[
                'Valid / Invalid / Needs Review verdict',
                'Confidence score and key factors detected',
                'Suggested action for each case',
                'Full history log linked to student records',
              ]}
              href="/excuses"
              cta="Try the Analyzer"
            />
          </div>
        </div>
      </section>

      {/* ── Secondary features strip ───────────────────────────────────────── */}
      <section className="py-16 border-t border-border bg-white">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
            {[
              {
                icon: TrendingUp,
                title: 'Trend tracking',
                desc: 'Daily attendance rates charted over 30 days for every class.',
              },
              {
                icon: ShieldAlert,
                title: 'At-risk detection',
                desc: 'Students below the threshold are surfaced automatically on the dashboard.',
              },
              {
                icon: FileText,
                title: 'Excuse records',
                desc: "Every analyzed excuse is saved to the student's permanent record.",
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex flex-col items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h4 className="font-semibold text-foreground">{title}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border bg-muted/30 py-8">
        <div className="mx-auto max-w-7xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-sm">
              A
            </div>
            <span className="font-semibold text-sm text-foreground">Attend</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Student Attendance &amp; Excuse Management Platform
          </p>
          <nav className="flex items-center gap-4 text-xs text-muted-foreground">
            <Link href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
            <Link href="/classes" className="hover:text-foreground transition-colors">Classes</Link>
            <Link href="/students" className="hover:text-foreground transition-colors">Students</Link>
            <Link href="/excuses" className="hover:text-foreground transition-colors">Excuses</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
