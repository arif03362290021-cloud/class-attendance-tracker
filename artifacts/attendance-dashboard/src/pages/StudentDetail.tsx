import React, { useMemo } from 'react';
import { useParams, Link } from 'wouter';
import { 
  useGetStudent, 
  useListAttendance, 
  useGetClass,
  useListExcuses
} from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatPercent } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ChevronLeft, Mail, Phone, Calendar as CalendarIcon, FileCheck } from 'lucide-react';
import { format, subDays, isSameDay } from 'date-fns';

export default function StudentDetail() {
  const { id } = useParams();
  const studentId = Number(id);

  const { data: student, isLoading: studentLoading } = useGetStudent(studentId, { query: { enabled: !!studentId } });
  const { data: attendance, isLoading: attendanceLoading } = useListAttendance({ studentId }, { query: { enabled: !!studentId } });
  const { data: classData, isLoading: classLoading } = useGetClass(student?.classId || 0, { query: { enabled: !!student?.classId } });
  const { data: excuses, isLoading: excusesLoading } = useListExcuses({ studentId }, { query: { enabled: !!studentId } });

  const stats = useMemo(() => {
    if (!attendance) return { present: 0, absent: 0, late: 0, excused: 0, total: 0, rate: 0 };
    
    const present = attendance.filter(r => r.status === 'present').length;
    const absent = attendance.filter(r => r.status === 'absent').length;
    const late = attendance.filter(r => r.status === 'late').length;
    const excused = attendance.filter(r => r.status === 'excused').length;
    const total = attendance.length;
    
    return {
      present, absent, late, excused, total,
      rate: total > 0 ? ((present + late) / total) * 100 : 0
    };
  }, [attendance]);

  // Generate a mini calendar grid for the last 30 days
  const recentDays = useMemo(() => {
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const record = attendance?.find(r => isSameDay(new Date(r.date), date));
      days.push({
        date,
        status: record?.status,
        recordId: record?.id
      });
    }
    return days;
  }, [attendance]);

  if (studentLoading) {
    return <div className="p-8"><Skeleton className="h-32 w-full mb-8" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!student) {
    return <div className="p-8 text-center">Student not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Link href="/students" className="hover:text-foreground transition-colors flex items-center">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to Students
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Card */}
        <Card className="md:col-span-1 border-primary/20 overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-br from-primary/10 to-primary/5" />
          <CardContent className="pt-12 px-6 pb-6 relative z-10 text-center">
            <Avatar className="w-24 h-24 mx-auto border-4 border-background shadow-sm mb-4">
              <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                {student.name.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <h2 className="text-2xl font-bold tracking-tight">{student.name}</h2>
            <p className="text-muted-foreground font-mono text-sm mt-1">{student.studentId}</p>
            
            <div className="mt-6 flex justify-center gap-4 border-t pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold">{formatPercent(stats.rate)}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Attendance</p>
              </div>
            </div>

            <div className="mt-6 space-y-3 text-sm text-left bg-muted/30 p-4 rounded-lg">
              <div className="flex items-center gap-3">
                <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                <span>
                  {classLoading ? <Skeleton className="h-4 w-24 inline-block" /> : (
                    <Link href={`/classes/${student.classId}`} className="hover:underline font-medium">
                      {classData?.name}
                    </Link>
                  )}
                </span>
              </div>
              {student.email && (
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <a href={`mailto:${student.email}`} className="hover:underline">{student.email}</a>
                </div>
              )}
              {student.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span>{student.phone}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Details Column */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-4 border-b">
              <CardTitle>Attendance History</CardTitle>
              <CardDescription>Last 30 days activity pattern</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-6 text-sm">
                <div className="flex gap-4">
                  <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-status-present" /> Present</div>
                  <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-status-late" /> Late</div>
                  <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-status-excused" /> Excused</div>
                  <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-status-absent" /> Absent</div>
                  <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-muted border border-border" /> No Data</div>
                </div>
              </div>

              <div className="grid grid-cols-10 gap-2 mb-8">
                {recentDays.map((day, i) => {
                  let colorClass = "bg-muted border border-border";
                  if (day.status === 'present') colorClass = "bg-status-present text-white border-transparent";
                  if (day.status === 'absent') colorClass = "bg-status-absent text-white border-transparent";
                  if (day.status === 'late') colorClass = "bg-status-late text-white border-transparent";
                  if (day.status === 'excused') colorClass = "bg-status-excused text-white border-transparent";

                  return (
                    <div 
                      key={i} 
                      className="group relative aspect-square"
                      title={`${format(day.date, 'MMM d')}: ${day.status || 'No record'}`}
                    >
                      <div className={cn("w-full h-full rounded-md flex items-center justify-center text-xs cursor-pointer hover:opacity-80 transition-opacity", colorClass)}>
                        {format(day.date, 'd')}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t pt-6">
                <div className="p-4 bg-status-present/5 rounded-lg border border-status-present/10">
                  <p className="text-2xl font-bold text-status-present">{stats.present}</p>
                  <p className="text-xs text-muted-foreground mt-1 font-medium">Present</p>
                </div>
                <div className="p-4 bg-status-late/5 rounded-lg border border-status-late/10">
                  <p className="text-2xl font-bold text-status-late">{stats.late}</p>
                  <p className="text-xs text-muted-foreground mt-1 font-medium">Late</p>
                </div>
                <div className="p-4 bg-status-excused/5 rounded-lg border border-status-excused/10">
                  <p className="text-2xl font-bold text-status-excused">{stats.excused}</p>
                  <p className="text-xs text-muted-foreground mt-1 font-medium">Excused</p>
                </div>
                <div className="p-4 bg-status-absent/5 rounded-lg border border-status-absent/10">
                  <p className="text-2xl font-bold text-status-absent">{stats.absent}</p>
                  <p className="text-xs text-muted-foreground mt-1 font-medium">Absent</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
              <div>
                <CardTitle>Excuse History</CardTitle>
                <CardDescription>Processed absence excuses</CardDescription>
              </div>
              <FileCheck className="w-5 h-5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-0 p-0">
              {excusesLoading ? (
                <div className="p-6 space-y-4">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : !excuses || excuses.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  No excuses on file for this student.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {excuses.map(excuse => (
                    <div key={excuse.id} className="p-4 sm:p-6 hover:bg-muted/30 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex gap-2 items-center">
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider",
                            excuse.verdict === 'Valid' ? "bg-status-present/15 text-status-present" :
                            excuse.verdict === 'Invalid' ? "bg-status-absent/15 text-status-absent" :
                            "bg-status-late/15 text-status-late"
                          )}>
                            {excuse.verdict}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(excuse.createdAt), 'MMM d, yyyy')}
                          </span>
                        </div>
                        {excuse.confidence !== null && excuse.confidence !== undefined && (
                          <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded">
                            {Math.round(excuse.confidence * 100)}% Match
                          </span>
                        )}
                      </div>
                      
                      <p className="text-sm italic text-muted-foreground border-l-2 border-border pl-3 my-3">
                        "{excuse.excuseText}"
                      </p>
                      
                      <div className="text-sm">
                        <span className="font-medium">Reasoning: </span> 
                        {excuse.reasoning}
                      </div>
                      
                      {excuse.suggestedAction && (
                        <div className="text-sm mt-2 text-primary font-medium">
                          <span className="text-foreground font-medium">Action: </span> 
                          {excuse.suggestedAction}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}