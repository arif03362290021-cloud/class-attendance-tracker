import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  useGetClass, 
  useListStudents, 
  useListAttendance, 
  useBulkUpsertAttendance,
  useGetAttendanceTrends,
  useCreateStudent,
  useUpdateStudent,
  useDeleteStudent,
  useListClasses,
  AttendanceInputStatus,
  BulkAttendanceInputRecordsItem
} from '@workspace/api-client-react';
import { useParams } from 'wouter';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CalendarIcon, ChevronLeft, Search, Save, Check, X, Clock, FileText, UserPlus, MoreHorizontal, Pencil, Trash2, Users } from 'lucide-react';
import { Link } from 'wouter';
import { cn, formatPercent } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { getListAttendanceQueryKey, getGetAttendanceTrendsQueryKey, getListStudentsQueryKey } from '@workspace/api-client-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

// ── Student form schema ────────────────────────────────────────────────────────
const studentSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  studentId: z.string().min(1, 'Student ID is required'),
  classId: z.coerce.number().min(1, 'Class is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
});
type StudentFormValues = z.infer<typeof studentSchema>;

export default function ClassDetail() {
  const { id } = useParams();
  const classId = Number(id);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ── Attendance state ─────────────────────────────────────────────────────────
  const [date, setDate] = useState<Date>(new Date());
  const [search, setSearch] = useState('');
  const [localRecords, setLocalRecords] = useState<Record<number, BulkAttendanceInputRecordsItem>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [discardPending, setDiscardPending] = useState<Date | null>(null);

  // ── Roster / student CRUD state ───────────────────────────────────────────────
  const [rosterSearch, setRosterSearch] = useState('');
  const [isStudentDialogOpen, setIsStudentDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any | null>(null);
  const [deleteStudentId, setDeleteStudentId] = useState<number | null>(null);
  const [deleteStudentName, setDeleteStudentName] = useState('');

  const dateStr = format(date, 'yyyy-MM-dd');

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: classData, isLoading: classLoading } = useGetClass(classId, { query: { enabled: !!classId } });
  const { data: students, isLoading: studentsLoading } = useListStudents({ classId }, { query: { enabled: !!classId } });
  const { data: allClasses } = useListClasses();
  const { data: attendance, isLoading: attendanceLoading } = useListAttendance(
    { classId, date: dateStr },
    { query: { enabled: !!classId } }
  );
  const { data: trends } = useGetAttendanceTrends({ classId, days: 30 }, { query: { enabled: !!classId } });

  // ── Mutations ────────────────────────────────────────────────────────────────
  const bulkMutation = useBulkUpsertAttendance();
  const createStudentMutation = useCreateStudent();
  const updateStudentMutation = useUpdateStudent();
  const deleteStudentMutation = useDeleteStudent();

  // ── Student form ─────────────────────────────────────────────────────────────
  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: { name: '', studentId: '', classId, email: '', phone: '' },
  });

  const openCreateStudent = () => {
    form.reset({ name: '', studentId: '', classId, email: '', phone: '' });
    setEditingStudent(null);
    setIsStudentDialogOpen(true);
  };

  const openEditStudent = (s: any) => {
    form.reset({
      name: s.name,
      studentId: s.studentId,
      classId: s.classId,
      email: s.email || '',
      phone: s.phone || '',
    });
    setEditingStudent(s);
    setIsStudentDialogOpen(true);
  };

  const onStudentSubmit = (data: StudentFormValues) => {
    if (editingStudent) {
      updateStudentMutation.mutate({ id: editingStudent.id, data }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey({ classId }) });
          queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
          setIsStudentDialogOpen(false);
          toast({ title: 'Student updated' });
        },
        onError: () => toast({ title: 'Failed to update student', variant: 'destructive' }),
      });
    } else {
      createStudentMutation.mutate({ data }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey({ classId }) });
          queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
          setIsStudentDialogOpen(false);
          form.reset();
          toast({ title: 'Student added to class' });
        },
        onError: () => toast({ title: 'Failed to add student', variant: 'destructive' }),
      });
    }
  };

  const confirmDeleteStudent = () => {
    if (!deleteStudentId) return;
    deleteStudentMutation.mutate({ id: deleteStudentId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey({ classId }) });
        queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
        setDeleteStudentId(null);
        toast({ title: 'Student removed from class' });
      },
      onError: () => toast({ title: 'Failed to remove student', variant: 'destructive' }),
    });
  };

  // ── Attendance sync ──────────────────────────────────────────────────────────
  const initializedForDate = useRef<string | null>(null);

  useEffect(() => {
    if (attendance && initializedForDate.current !== dateStr) {
      const records: Record<number, BulkAttendanceInputRecordsItem> = {};
      attendance.forEach(r => {
        records[r.studentId] = { studentId: r.studentId, status: r.status as any, notes: r.notes || undefined };
      });
      setLocalRecords(records);
      setHasChanges(false);
      initializedForDate.current = dateStr;
    }
  }, [attendance, dateStr]);

  const handleDateChange = (newDate: Date | undefined) => {
    if (!newDate) return;
    if (hasChanges) { setDiscardPending(newDate); return; }
    applyDateChange(newDate);
  };

  const applyDateChange = (newDate: Date) => {
    setDate(newDate);
    initializedForDate.current = null;
    setLocalRecords({});
    setHasChanges(false);
  };

  const filteredStudents = useMemo(() => {
    if (!students) return [];
    if (!search.trim()) return students;
    const q = search.toLowerCase();
    return students.filter(s => s.name.toLowerCase().includes(q) || s.studentId.toLowerCase().includes(q));
  }, [students, search]);

  const filteredRosterStudents = useMemo(() => {
    if (!students) return [];
    if (!rosterSearch.trim()) return students;
    const q = rosterSearch.toLowerCase();
    return students.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.studentId.toLowerCase().includes(q) ||
      (s.email && s.email.toLowerCase().includes(q))
    );
  }, [students, rosterSearch]);

  const setStatus = (studentId: number, status: AttendanceInputStatus) => {
    setLocalRecords(prev => ({ ...prev, [studentId]: { ...prev[studentId], studentId, status } }));
    setHasChanges(true);
  };

  const markAll = (status: AttendanceInputStatus) => {
    if (!filteredStudents.length) return;
    const next = { ...localRecords };
    filteredStudents.forEach(s => { next[s.id] = { ...next[s.id], studentId: s.id, status }; });
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
          toast({ title: 'Attendance saved', description: `Recorded for ${records.length} students on ${format(date, 'MMM d, yyyy')}` });
        },
        onError: () => toast({ title: 'Failed to save attendance', variant: 'destructive' }),
      }
    );
  };

  const dateStats = useMemo(() => {
    const records = Object.values(localRecords);
    return {
      present: records.filter(r => r.status === 'present').length,
      absent: records.filter(r => r.status === 'absent').length,
      late: records.filter(r => r.status === 'late').length,
      excused: records.filter(r => r.status === 'excused').length,
      total: records.length,
      possible: students?.length || 0,
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
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start justify-between">
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
      </div>

      {/* Tabs */}
      <Tabs defaultValue="attendance">
        <TabsList className="mb-4">
          <TabsTrigger value="attendance">
            <CalendarIcon className="w-4 h-4 mr-2" />
            Take Attendance
          </TabsTrigger>
          <TabsTrigger value="roster">
            <Users className="w-4 h-4 mr-2" />
            Roster
            {students && (
              <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {students.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Attendance Tab ─────────────────────────────────────────────────── */}
        <TabsContent value="attendance" className="mt-0">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-end mb-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('min-w-[200px] justify-start text-left font-normal', !date && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'EEEE, MMMM d, yyyy') : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar mode="single" selected={date} onSelect={handleDateChange} disabled={(d) => d > new Date()} initialFocus />
              </PopoverContent>
            </Popover>
            <Button onClick={saveAttendance} disabled={!hasChanges || bulkMutation.isPending} className="min-w-[120px]">
              {bulkMutation.isPending ? 'Saving…' : <><Save className="w-4 h-4 mr-2" />Save Roll</>}
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Roster + mark buttons */}
            <div className="lg:col-span-3 space-y-4">
              <Card>
                <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="relative w-full max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search students…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
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
                              <AvatarFallback className="bg-primary/5 text-primary">{student.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div>
                              <Link href={`/students/${student.id}`} className="font-medium hover:text-primary transition-colors">{student.name}</Link>
                              <p className="text-xs text-muted-foreground mt-0.5">{student.studentId}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 sm:ml-auto">
                            {(['present', 'absent', 'late', 'excused'] as AttendanceInputStatus[]).map((s) => {
                              const icons = { present: Check, absent: X, late: Clock, excused: FileText };
                              const labels = { present: 'Present', absent: 'Absent', late: 'Late', excused: 'Excused' };
                              const colors = {
                                present: status === 'present' ? 'bg-status-present hover:bg-status-present/90 text-white border-transparent' : 'hover:text-status-present hover:border-status-present',
                                absent:  status === 'absent'  ? 'bg-status-absent hover:bg-status-absent/90 text-white border-transparent'   : 'hover:text-status-absent hover:border-status-absent',
                                late:    status === 'late'    ? 'bg-status-late hover:bg-status-late/90 text-white border-transparent'         : 'hover:text-status-late hover:border-status-late',
                                excused: status === 'excused' ? 'bg-status-excused hover:bg-status-excused/90 text-white border-transparent'   : 'hover:text-status-excused hover:border-status-excused',
                              };
                              const Icon = icons[s];
                              return (
                                <Button key={s} size="sm" variant={status === s ? 'default' : 'outline'}
                                  className={cn('w-10 sm:w-auto h-9 px-0 sm:px-3', colors[s])}
                                  onClick={() => setStatus(student.id, s)}>
                                  <Icon className="w-4 h-4 sm:mr-1.5" />
                                  <span className="hidden sm:inline">{labels[s]}</span>
                                </Button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </Card>
            </div>

            {/* Stats sidebar */}
            <div className="space-y-6">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">Daily Summary</CardTitle>
                  <CardDescription>{dateStats.total} of {dateStats.possible} marked</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {(['present', 'absent', 'late', 'excused'] as const).map((s) => (
                      <div key={s} className="flex justify-between items-center">
                        <span className="text-sm font-medium flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full bg-status-${s}`} />
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </span>
                        <span className="font-semibold">{dateStats[s]}</span>
                      </div>
                    ))}
                    {dateStats.possible > 0 && (
                      <div className="pt-4 mt-4 border-t border-border">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm text-muted-foreground">Attendance Rate</span>
                          <span className="font-bold text-lg">{formatPercent((dateStats.present + dateStats.late) / dateStats.possible * 100)}</span>
                        </div>
                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden flex">
                          <div className="h-full bg-status-present" style={{ width: `${(dateStats.present / dateStats.possible) * 100}%` }} />
                          <div className="h-full bg-status-late"    style={{ width: `${(dateStats.late    / dateStats.possible) * 100}%` }} />
                          <div className="h-full bg-status-excused" style={{ width: `${(dateStats.excused / dateStats.possible) * 100}%` }} />
                          <div className="h-full bg-status-absent"  style={{ width: `${(dateStats.absent  / dateStats.possible) * 100}%` }} />
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
                              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <Tooltip
                            contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))', fontSize: '12px' }}
                            labelFormatter={(label) => new Date(label).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            formatter={(val: number) => [`${val.toFixed(1)}%`, 'Present']}
                          />
                          <Area type="monotone" dataKey="presentRate" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#trendColor)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm border border-dashed rounded-md">Not enough data</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ── Roster Tab ────────────────────────────────────────────────────── */}
        <TabsContent value="roster" className="mt-0">
          <Card>
            <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search students…" className="pl-9" value={rosterSearch} onChange={(e) => setRosterSearch(e.target.value)} />
              </div>
              <Button onClick={openCreateStudent} className="gap-2 shrink-0">
                <UserPlus className="w-4 h-4" />
                Add Student
              </Button>
            </div>

            <div className="divide-y">
              {studentsLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="p-4 flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1"><Skeleton className="h-4 w-40 mb-1" /><Skeleton className="h-3 w-24" /></div>
                    <Skeleton className="h-8 w-8 rounded-md" />
                  </div>
                ))
              ) : filteredRosterStudents.length === 0 ? (
                <div className="p-12 text-center">
                  <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                  <p className="text-muted-foreground">{rosterSearch ? 'No students match your search.' : 'No students enrolled yet.'}</p>
                  {!rosterSearch && (
                    <Button variant="outline" className="mt-4 gap-2" onClick={openCreateStudent}>
                      <UserPlus className="w-4 h-4" /> Add First Student
                    </Button>
                  )}
                </div>
              ) : (
                filteredRosterStudents.map((student) => (
                  <div key={student.id} className="p-4 flex items-center gap-4 group hover:bg-muted/30 transition-colors">
                    <Avatar className="h-10 w-10 border shrink-0">
                      <AvatarFallback className="bg-primary/5 text-primary text-xs font-medium">
                        {student.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <Link href={`/students/${student.id}`} className="font-medium hover:text-primary transition-colors">{student.name}</Link>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                        <span className="font-mono">{student.studentId}</span>
                        {student.email && <span className="truncate">{student.email}</span>}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/students/${student.id}`} className="cursor-default">View Profile</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEditStudent(student)}>
                          <Pencil className="w-4 h-4 mr-2" /> Edit Details
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => { setDeleteStudentId(student.id); setDeleteStudentName(student.name); }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Remove from Class
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))
              )}
            </div>

            {students && students.length > 0 && (
              <div className="px-4 py-3 border-t text-sm text-muted-foreground">
                {students.length} student{students.length !== 1 ? 's' : ''} enrolled
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Student add/edit dialog ─────────────────────────────────────────── */}
      <Dialog open={isStudentDialogOpen} onOpenChange={(open) => { if (!open) form.reset(); setIsStudentDialogOpen(open); }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingStudent ? 'Edit Student' : 'Add Student to Class'}</DialogTitle>
            <DialogDescription>
              {editingStudent ? 'Update student details.' : `Enroll a new student into ${classData.name}.`}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onStudentSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl><Input placeholder="Jane Doe" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="studentId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Student ID</FormLabel>
                    <FormControl><Input placeholder="STU-022" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="classId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Class</FormLabel>
                  <Select onValueChange={(v) => field.onChange(parseInt(v, 10))} value={field.value ? field.value.toString() : ''}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select a class" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {allClasses?.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email (Optional)</FormLabel>
                    <FormControl><Input type="email" placeholder="jane@example.com" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone (Optional)</FormLabel>
                    <FormControl><Input placeholder="Parent contact" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <DialogFooter className="mt-2">
                <Button type="button" variant="outline" onClick={() => setIsStudentDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createStudentMutation.isPending || updateStudentMutation.isPending}>
                  {createStudentMutation.isPending || updateStudentMutation.isPending
                    ? (editingStudent ? 'Saving…' : 'Adding…')
                    : (editingStudent ? 'Save Changes' : 'Add Student')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Delete student confirmation ─────────────────────────────────────── */}
      <AlertDialog open={!!deleteStudentId} onOpenChange={(open) => { if (!open) setDeleteStudentId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleteStudentName}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the student and all their attendance records. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDeleteStudent}
            >
              Remove Student
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Discard changes confirmation ────────────────────────────────────── */}
      <AlertDialog open={!!discardPending} onOpenChange={(open) => { if (!open) setDiscardPending(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved attendance changes for {format(date, 'MMMM d')}. Switching dates will discard them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay on this date</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (discardPending) applyDateChange(discardPending); setDiscardPending(null); }}>
              Discard &amp; Switch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
