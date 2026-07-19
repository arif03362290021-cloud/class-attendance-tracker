import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  useGetClass, 
  useListStudents, 
  useListAttendance, 
  useBulkUpsertAttendance,
  useGetAttendanceTrends,
  AttendanceInputStatus,
  BulkAttendanceInputRecordsItem
} from '@workspace/api-client-react';
import { useParams } from 'wouter';
import { format, subDays, isSameDay } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarIcon, ChevronLeft, Search, Save, Check, X, Clock, FileText } from 'lucide-react';
import { Link } from 'wouter';
import { cn, formatPercent } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { getListAttendanceQueryKey, getGetAttendanceTrendsQueryKey } from '@workspace/api-client-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';

export default function ClassDetail() {
  const { id } = useParams();
  const classId = Number(id);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [date, setDate] = useState<Date>(new Date());
  const [search, setSearch] = useState('');
  const [localRecords, setLocalRecords] = useState<Record<number, BulkAttendanceInputRecordsItem>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const dateStr = format(date, 'yyyy-MM-dd');

  const { data: classData, isLoading: classLoading } = useGetClass(classId, { query: { enabled: !!classId } });
  const { data: students, isLoading: studentsLoading } = useListStudents({ classId }, { query: { enabled: !!classId } });
  const { data: attendance, isLoading: attendanceLoading } = useListAttendance(
    { classId, date: dateStr }, 
    { query: { enabled: !!classId } }
  );
  const { data: trends } = useGetAttendanceTrends({ classId, days: 30 }, { query: { enabled: !!classId } });

  const bulkMutation = useBulkUpsertAttendance();

  // Sync server state to local state when date/attendance changes
  const initializedForDate = useRef<string | null>(null);
  
  useEffect(() => {
    if (attendance && initializedForDate.current !== dateStr) {
      const records: Record<number, BulkAttendanceInputRecordsItem> = {};
      attendance.forEach(r => {
        records[r.studentId] = {
          studentId: r.studentId,
          status: r.status as any,
          notes: r.notes || undefined
        };
      });
      setLocalRecords(records);
      setHasChanges(false);
      initializedForDate.current = dateStr;
    }
  }, [attendance, dateStr]);

  // Handle date change
  const handleDateChange = (newDate: Date | undefined) => {
    if (newDate && (!hasChanges || confirm("You have unsaved changes. Discard them?"))) {
      setDate(newDate);
      initializedForDate.current = null; // force re-init
      setLocalRecords({});
      setHasChanges(false);
    }
  };

  const filteredStudents = useMemo(() => {
    if (!students) return [];
    if (!search.trim()) return students;
    const q = search.toLowerCase();
    return students.filter(s => 
      s.name.toLowerCase().includes(q) || 
      s.studentId.toLowerCase().includes(q)
    );
  }, [students, search]);

  const setStatus = (studentId: number, status: AttendanceInputStatus) => {
    setLocalRecords(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], studentId, status }
    }));
    setHasChanges(true);
  };

  const markAll = (status: AttendanceInputStatus) => {
    if (!filteredStudents.length) return;
    const next = { ...localRecords };
    filteredStudents.forEach(s => {
      next[s.id] = { ...next[s.id], studentId: s.id, status };
    });
    setLocalRecords(next);
    setHasChanges(true);
  };

  const saveAttendance = () => {
    const records = Object.values(localRecords);
    if (records.length === 0) return;

    bulkMutation.mutate(
      { data: { classId, date: dateStr, records } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey({ classId, date: dateStr }) });
          queryClient.invalidateQueries({ queryKey: getGetAttendanceTrendsQueryKey({ classId }) });
          setHasChanges(false);
          toast({ title: "Attendance saved", description: `Recorded for ${records.length} students on ${format(date, 'MMM d, yyyy')}` });
        },
        onError: () => {
          toast({ title: "Failed to save attendance", variant: "destructive" });
        }
      }
    );
  };

  // Stats for the current date
  const dateStats = useMemo(() => {
    const records = Object.values(localRecords);
    return {
      present: records.filter(r => r.status === 'present').length,
      absent: records.filter(r => r.status === 'absent').length,
      late: records.filter(r => r.status === 'late').length,
      excused: records.filter(r => r.status === 'excused').length,
      total: records.length,
      possible: students?.length || 0
    };
  }, [localRecords, students]);

  if (classLoading) {
    return <div className="p-8"><Skeleton className="h-12 w-1/3 mb-4" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!classData) {
    return <div className="p-8 text-center">Class not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/classes" className="hover:text-foreground transition-colors flex items-center">
              <ChevronLeft className="w-4 h-4 mr-1" /> Back to Classes
            </Link>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{classData.name}</h1>
          <p className="text-muted-foreground flex items-center gap-4 mt-1">
            <span>{classData.subject}</span>
            <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
            <span>{classData.teacherName}</span>
            {classData.schedule && (
              <>
                <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                <span>{classData.schedule}</span>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("min-w-[200px] justify-start text-left font-normal", !date && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "EEEE, MMMM d, yyyy") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={date}
                onSelect={handleDateChange}
                disabled={(d) => d > new Date()}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          
          <Button 
            onClick={saveAttendance} 
            disabled={!hasChanges || bulkMutation.isPending}
            className="min-w-[120px]"
          >
            {bulkMutation.isPending ? "Saving..." : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Roll
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column - Roster */}
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search students..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground mr-2">Mark All:</span>
                <Button size="sm" variant="outline" className="h-8 border-status-present text-status-present hover:bg-status-present/10" onClick={() => markAll('present')}>Present</Button>
                <Button size="sm" variant="outline" className="h-8 border-status-absent text-status-absent hover:bg-status-absent/10" onClick={() => markAll('absent')}>Absent</Button>
              </div>
            </div>

            <div className="divide-y">
              {studentsLoading || attendanceLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="p-4 flex items-center gap-4"><Skeleton className="h-10 w-10 rounded-full" /><Skeleton className="h-5 w-48" /></div>
                ))
              ) : filteredStudents.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No students found</div>
              ) : (
                filteredStudents.map((student) => {
                  const status = localRecords[student.id]?.status;
                  return (
                    <div key={student.id} className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-10 w-10 border">
                          <AvatarFallback className="bg-primary/5 text-primary">
                            {student.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <Link href={`/students/${student.id}`} className="font-medium hover:text-primary transition-colors">
                            {student.name}
                          </Link>
                          <p className="text-xs text-muted-foreground mt-0.5">{student.studentId}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1.5 sm:ml-auto">
                        <Button 
                          size="sm" 
                          variant={status === 'present' ? 'default' : 'outline'}
                          className={cn(
                            "w-10 sm:w-auto h-9 px-0 sm:px-3",
                            status === 'present' ? "bg-status-present hover:bg-status-present/90 text-white border-transparent" : "hover:text-status-present hover:border-status-present"
                          )}
                          onClick={() => setStatus(student.id, 'present')}
                        >
                          <Check className="w-4 h-4 sm:mr-1.5" />
                          <span className="hidden sm:inline">Present</span>
                        </Button>
                        <Button 
                          size="sm" 
                          variant={status === 'absent' ? 'default' : 'outline'}
                          className={cn(
                            "w-10 sm:w-auto h-9 px-0 sm:px-3",
                            status === 'absent' ? "bg-status-absent hover:bg-status-absent/90 text-white border-transparent" : "hover:text-status-absent hover:border-status-absent"
                          )}
                          onClick={() => setStatus(student.id, 'absent')}
                        >
                          <X className="w-4 h-4 sm:mr-1.5" />
                          <span className="hidden sm:inline">Absent</span>
                        </Button>
                        <Button 
                          size="sm" 
                          variant={status === 'late' ? 'default' : 'outline'}
                          className={cn(
                            "w-10 sm:w-auto h-9 px-0 sm:px-3",
                            status === 'late' ? "bg-status-late hover:bg-status-late/90 text-white border-transparent" : "hover:text-status-late hover:border-status-late"
                          )}
                          onClick={() => setStatus(student.id, 'late')}
                        >
                          <Clock className="w-4 h-4 sm:mr-1.5" />
                          <span className="hidden sm:inline">Late</span>
                        </Button>
                        <Button 
                          size="sm" 
                          variant={status === 'excused' ? 'default' : 'outline'}
                          className={cn(
                            "w-10 sm:w-auto h-9 px-0 sm:px-3",
                            status === 'excused' ? "bg-status-excused hover:bg-status-excused/90 text-white border-transparent" : "hover:text-status-excused hover:border-status-excused"
                          )}
                          onClick={() => setStatus(student.id, 'excused')}
                        >
                          <FileText className="w-4 h-4 sm:mr-1.5" />
                          <span className="hidden sm:inline">Excused</span>
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>

        {/* Right Column - Stats & Trends */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Daily Summary</CardTitle>
              <CardDescription>
                {dateStats.total} of {dateStats.possible} marked
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-status-present" /> Present
                  </span>
                  <span className="font-semibold">{dateStats.present}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-status-absent" /> Absent
                  </span>
                  <span className="font-semibold">{dateStats.absent}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-status-late" /> Late
                  </span>
                  <span className="font-semibold">{dateStats.late}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-status-excused" /> Excused
                  </span>
                  <span className="font-semibold">{dateStats.excused}</span>
                </div>
                
                {dateStats.possible > 0 && (
                  <div className="pt-4 mt-4 border-t border-border">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-muted-foreground">Attendance Rate</span>
                      <span className="font-bold text-lg">
                        {formatPercent((dateStats.present + dateStats.late) / dateStats.possible * 100)}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden flex">
                      <div className="h-full bg-status-present" style={{ width: `${(dateStats.present / dateStats.possible) * 100}%` }} />
                      <div className="h-full bg-status-late" style={{ width: `${(dateStats.late / dateStats.possible) * 100}%` }} />
                      <div className="h-full bg-status-excused" style={{ width: `${(dateStats.excused / dateStats.possible) * 100}%` }} />
                      <div className="h-full bg-status-absent" style={{ width: `${(dateStats.absent / dateStats.possible) * 100}%` }} />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Class Trend</CardTitle>
              <CardDescription>30-day attendance history</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[180px] w-full mt-4">
                {trends && trends.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trends}>
                      <defs>
                        <linearGradient id="trendColor" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))', fontSize: '12px' }}
                        labelFormatter={(label) => new Date(label).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        formatter={(val: number) => [`${val.toFixed(1)}%`, 'Present']}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="presentRate" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                        fill="url(#trendColor)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm border border-dashed rounded-md">
                    Not enough data
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}