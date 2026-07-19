import React, { useMemo } from 'react';
import { 
  useGetAttendanceStats, 
  useGetAttendanceTrends, 
  useGetAtRiskStudents,
  useListClasses,
  useListAttendance
} from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { formatPercent, cn } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AlertCircle, ArrowUpRight, TrendingUp, Users, CheckCircle2, Clock } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetAttendanceStats();
  const { data: trends, isLoading: trendsLoading } = useGetAttendanceTrends({ days: 14 });
  const { data: atRisk, isLoading: atRiskLoading } = useGetAtRiskStudents({ threshold: 85 });
  const { data: recentRecords, isLoading: recentLoading } = useListAttendance();
  const { data: classes } = useListClasses();

  // Sort recent by date desc, ID desc to get true latest
  const latestActivity = useMemo(() => {
    if (!recentRecords || !classes) return [];
    const sorted = [...recentRecords].sort((a, b) => {
      if (a.date !== b.date) return new Date(b.date).getTime() - new Date(a.date).getTime();
      return b.id - a.id;
    });
    
    return sorted.slice(0, 5).map(record => ({
      ...record,
      className: classes.find(c => c.id === record.classId)?.name || 'Unknown Class'
    }));
  }, [recentRecords, classes]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
          <p className="text-muted-foreground mt-1">Good morning. Here's what's happening today.</p>
        </div>
        <Button asChild>
          <Link href="/classes">Take Attendance</Link>
        </Button>
      </div>

      {/* Top Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between space-y-0 pb-2">
              <p className="text-sm font-medium text-muted-foreground">Total Students</p>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            {statsLoading ? <Skeleton className="h-8 w-24 mt-1" /> : (
              <div className="flex items-baseline gap-2">
                <h2 className="text-3xl font-bold">{stats?.totalStudents || 0}</h2>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between space-y-0 pb-2">
              <p className="text-sm font-medium text-muted-foreground">Overall Attendance</p>
              <TrendingUp className="h-4 w-4 text-status-present" />
            </div>
            {statsLoading ? <Skeleton className="h-8 w-24 mt-1" /> : (
              <div className="flex items-baseline gap-2">
                <h2 className="text-3xl font-bold">{formatPercent(stats?.attendanceRate)}</h2>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between space-y-0 pb-2">
              <p className="text-sm font-medium text-muted-foreground">Present Today</p>
              <CheckCircle2 className="h-4 w-4 text-status-present" />
            </div>
            {statsLoading ? <Skeleton className="h-8 w-24 mt-1" /> : (
              <div className="flex items-baseline gap-2">
                <h2 className="text-3xl font-bold">{stats?.presentCount || 0}</h2>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between space-y-0 pb-2">
              <p className="text-sm font-medium text-muted-foreground">Absent / Late</p>
              <AlertCircle className="h-4 w-4 text-status-absent" />
            </div>
            {statsLoading ? <Skeleton className="h-8 w-24 mt-1" /> : (
              <div className="flex items-baseline gap-2">
                <h2 className="text-3xl font-bold text-status-absent">{stats?.absentCount || 0}</h2>
                <span className="text-xl font-medium text-muted-foreground">/</span>
                <h2 className="text-3xl font-bold text-status-late">{stats?.lateCount || 0}</h2>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Attendance Trend</CardTitle>
            <CardDescription>14-day trailing average</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {trendsLoading ? (
                <div className="w-full h-full flex items-center justify-center">
                  <Skeleton className="w-full h-full" />
                </div>
              ) : trends && trends.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis 
                      tickFormatter={(val) => `${val}%`}
                      tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false}
                      tickLine={false}
                      domain={[0, 100]}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                      labelFormatter={(label) => new Date(label).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="presentRate" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorRate)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                  No trend data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* At Risk Sidebar */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-status-absent" />
              At-Risk Students
            </CardTitle>
            <CardDescription>Attendance below 85%</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            {atRiskLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : atRisk && atRisk.length > 0 ? (
              <div className="space-y-4">
                {atRisk.slice(0, 5).map((student) => (
                  <Link key={`${student.studentId}-${student.classId}`} href={`/students/${student.studentId}`}>
                    <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer group">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border">
                          <AvatarFallback className="text-xs bg-primary/5 text-primary">
                            {student.studentName.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium leading-none group-hover:text-primary transition-colors">
                            {student.studentName}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1 truncate max-w-[120px]">
                            {student.className}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-status-absent">
                          {formatPercent(student.attendanceRate)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {student.absentDays} absences
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
                <div className="w-12 h-12 rounded-full bg-status-present/10 flex items-center justify-center mb-2">
                  <CheckCircle2 className="w-6 h-6 text-status-present" />
                </div>
                <p className="font-medium">All clear</p>
                <p className="text-sm text-muted-foreground">No students are currently below the risk threshold.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {recentLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : latestActivity.length > 0 ? (
            <div className="space-y-1">
              {latestActivity.map((record) => (
                <div key={record.id} className="flex items-center justify-between p-3 hover:bg-muted/50 rounded-md transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                    <div>
                      <p className="text-sm font-medium">
                        <span className="text-foreground">{record.studentName}</span>
                        <span className="text-muted-foreground font-normal mx-1">was marked</span>
                        <StatusBadge status={record.status} dot={false} className="scale-90 origin-left" />
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        in {record.className} • {new Date(record.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/classes/${record.classId}`}>
                      <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground text-sm">
              No recent attendance records.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}