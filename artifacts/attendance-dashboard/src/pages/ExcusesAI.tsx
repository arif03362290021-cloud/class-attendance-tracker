import React, { useState } from 'react';
import { 
  useAnalyzeExcuse, 
  useSaveExcuse, 
  useListExcuses,
  useListStudents
} from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Sparkles, Save, Clock, CheckCircle2, XCircle, AlertCircle, FileText } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { getListExcusesQueryKey } from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

const analyzeSchema = z.object({
  excuseText: z.string().min(10, 'Please paste the full excuse text (min 10 chars)'),
  studentId: z.coerce.number().optional().or(z.literal('')),
});

type AnalyzeFormValues = z.infer<typeof analyzeSchema>;

export default function ExcusesAI() {
  const [filterVerdict, setFilterVerdict] = useState<string>('all');
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: students } = useListStudents();
  const { data: history, isLoading: historyLoading } = useListExcuses();
  
  const analyzeMutation = useAnalyzeExcuse();
  const saveMutation = useSaveExcuse();

  const form = useForm<AnalyzeFormValues>({
    resolver: zodResolver(analyzeSchema),
    defaultValues: {
      excuseText: '',
      studentId: '',
    }
  });

  const onSubmit = (data: AnalyzeFormValues) => {
    const studentName = data.studentId 
      ? students?.find(s => s.id === Number(data.studentId))?.name 
      : undefined;

    analyzeMutation.mutate({ 
      data: { 
        excuseText: data.excuseText,
        studentName 
      } 
    });
  };

  const handleSave = () => {
    const result = analyzeMutation.data;
    const studentId = form.getValues('studentId');
    
    if (!result || !studentId) {
      toast({ title: "Select a student to save this record", variant: "destructive" });
      return;
    }

    saveMutation.mutate({
      data: {
        studentId: Number(studentId),
        excuseText: form.getValues('excuseText'),
        verdict: result.verdict as any,
        confidence: result.confidence,
        reasoning: result.reasoning,
        suggestedAction: result.suggestedAction
      }
    }, {
      onSuccess: () => {
        toast({ title: "Excuse saved to student record" });
        queryClient.invalidateQueries({ queryKey: getListExcusesQueryKey() });
        form.reset();
        analyzeMutation.reset();
      }
    });
  };

  const filteredHistory = React.useMemo(() => {
    if (!history) return [];
    if (filterVerdict === 'all') return history;
    return history.filter(h => h.verdict === filterVerdict);
  }, [history, filterVerdict]);

  const VerdictIcon = ({ verdict, className }: { verdict: string, className?: string }) => {
    if (verdict === 'Valid') return <CheckCircle2 className={cn("text-status-present", className)} />;
    if (verdict === 'Invalid') return <XCircle className={cn("text-status-absent", className)} />;
    return <AlertCircle className={cn("text-status-late", className)} />;
  };

  const VerdictBadge = ({ verdict }: { verdict: string }) => {
    const colorClass = 
      verdict === 'Valid' ? "bg-status-present/15 text-status-present hover:bg-status-present/25" :
      verdict === 'Invalid' ? "bg-status-absent/15 text-status-absent hover:bg-status-absent/25" :
      "bg-status-late/15 text-status-late hover:bg-status-late/25";
      
    return (
      <Badge variant="outline" className={cn("border-transparent shadow-none", colorClass)}>
        {verdict}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="w-8 h-8 text-primary" />
          Excuse Analyzer
        </h1>
        <p className="text-muted-foreground mt-1">
          Paste parent emails or notes to evaluate their validity against school policy.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card className="border-primary/20 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
              <Sparkles className="w-32 h-32" />
            </div>
            <CardHeader>
              <CardTitle>Analyze Note</CardTitle>
              <CardDescription>Paste the exact text received from the student or parent.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="studentId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Student (Optional)</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value?.toString()}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-background">
                              <SelectValue placeholder="Link to a student record..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {students?.map(s => (
                              <SelectItem key={s.id} value={s.id.toString()}>{s.name} ({s.studentId})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="excuseText"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Excuse Text</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Dear Teacher, Jimmy was absent yesterday because..." 
                            className="min-h-[150px] resize-none bg-background leading-relaxed" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <Button type="submit" className="w-full gap-2" disabled={analyzeMutation.isPending}>
                    {analyzeMutation.isPending ? "Analyzing..." : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Analyze Request
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {analyzeMutation.data && (
            <Card className="border-2 border-primary animate-in fade-in slide-in-from-bottom-4 duration-500">
              <CardHeader className="pb-3 border-b bg-muted/20">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <VerdictIcon verdict={analyzeMutation.data.verdict} className="w-6 h-6" />
                    AI Verdict: {analyzeMutation.data.verdict}
                  </CardTitle>
                  <div className="text-sm font-mono bg-background px-2 py-1 rounded border">
                    {Math.round(analyzeMutation.data.confidence * 100)}% Confidence
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div>
                  <h4 className="text-sm font-semibold mb-1 text-foreground/80 uppercase tracking-wider">Reasoning</h4>
                  <p className="text-sm leading-relaxed">{analyzeMutation.data.reasoning}</p>
                </div>
                
                {analyzeMutation.data.keyFactors && analyzeMutation.data.keyFactors.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2 text-foreground/80 uppercase tracking-wider">Key Factors</h4>
                    <ul className="space-y-1">
                      {analyzeMutation.data.keyFactors.map((factor, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary/50 mt-1.5 shrink-0" />
                          <span>{factor}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                <div className="bg-primary/5 p-4 rounded-lg border border-primary/10 mt-6">
                  <h4 className="text-sm font-semibold mb-1 text-primary">Suggested Action</h4>
                  <p className="text-sm font-medium">{analyzeMutation.data.suggestedAction}</p>
                </div>

                {form.getValues('studentId') && (
                  <Button 
                    className="w-full mt-4 gap-2" 
                    variant="secondary"
                    onClick={handleSave}
                    disabled={saveMutation.isPending}
                  >
                    <Save className="w-4 h-4" />
                    {saveMutation.isPending ? "Saving..." : "Save to Student Record"}
                  </Button>
                )}
                {!form.getValues('studentId') && (
                  <p className="text-xs text-center text-muted-foreground mt-4">
                    Select a student in the form to save this record.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <Card className={cn("transition-all duration-300 flex-1 flex flex-col", analyzeMutation.data ? "opacity-50 hover:opacity-100" : "")}>
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Recent Analysis History</CardTitle>
                </div>
                <Tabs value={filterVerdict} onValueChange={setFilterVerdict} className="w-auto">
                  <TabsList className="h-8">
                    <TabsTrigger value="all" className="text-xs px-2 h-6">All</TabsTrigger>
                    <TabsTrigger value="Valid" className="text-xs px-2 h-6">Valid</TabsTrigger>
                    <TabsTrigger value="Invalid" className="text-xs px-2 h-6">Invalid</TabsTrigger>
                    <TabsTrigger value="Needs Review" className="text-xs px-2 h-6">Review</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {historyLoading ? (
                <div className="p-4 space-y-4">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground flex flex-col items-center">
                  <FileText className="w-8 h-8 mb-2 opacity-20" />
                  <p>No history found</p>
                </div>
              ) : (
                <div className="divide-y max-h-[500px] overflow-y-auto">
                  {filteredHistory.map(record => (
                    <div key={record.id} className="p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <VerdictBadge verdict={record.verdict} />
                          <span className="font-medium text-sm">
                            {record.studentName || 'Unknown Student'}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(record.createdAt), 'MMM d')}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 italic mb-2 border-l-2 pl-2 border-muted">
                        "{record.excuseText}"
                      </p>
                      <p className="text-xs font-medium text-foreground">
                        {record.suggestedAction}
                      </p>
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