import React, { useState } from 'react';
import { 
  useListClasses, 
  useCreateClass, 
  useDeleteClass,
  useUpdateClass
} from '@workspace/api-client-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link } from 'wouter';
import { Users, Clock, BookOpen, UserCircle, MoreHorizontal, Pencil, Trash2, ArrowRight } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useQueryClient } from '@tanstack/react-query';
import { getListClassesQueryKey } from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const classSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  subject: z.string().min(1, 'Subject is required'),
  teacherName: z.string().min(1, 'Teacher name is required'),
  schedule: z.string().optional(),
  room: z.string().optional(),
});

type ClassFormValues = z.infer<typeof classSchema>;

export default function ClassesList() {
  const { data: classes, isLoading } = useListClasses();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingClassId, setEditingClassId] = useState<number | null>(null);
  const [deleteClassId, setDeleteClassId] = useState<number | null>(null);
  const [deleteClassName, setDeleteClassName] = useState('');
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const createMutation = useCreateClass();
  const updateMutation = useUpdateClass();
  const deleteMutation = useDeleteClass();

  const form = useForm<ClassFormValues>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      name: '',
      subject: '',
      teacherName: '',
      schedule: '',
      room: '',
    }
  });

  const openEdit = (c: any) => {
    form.reset({
      name: c.name,
      subject: c.subject,
      teacherName: c.teacherName,
      schedule: c.schedule || '',
      room: c.room || '',
    });
    setEditingClassId(c.id);
    setIsEditOpen(true);
  };

  const onSubmit = (data: ClassFormValues) => {
    if (editingClassId) {
      updateMutation.mutate({ id: editingClassId, data }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListClassesQueryKey() });
          setIsEditOpen(false);
          toast({ title: "Class updated successfully" });
        }
      });
    } else {
      createMutation.mutate({ data }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListClassesQueryKey() });
          setIsCreateOpen(false);
          form.reset();
          toast({ title: "Class created successfully" });
        }
      });
    }
  };

  const handleDelete = (id: number, name: string) => {
    setDeleteClassId(id);
    setDeleteClassName(name);
  };

  const confirmDelete = () => {
    if (!deleteClassId) return;
    deleteMutation.mutate({ id: deleteClassId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListClassesQueryKey() });
        setDeleteClassId(null);
        toast({ title: "Class deleted" });
      },
      onError: () => toast({ title: "Failed to delete class", variant: "destructive" }),
    });
  };

  const FormFields = () => (
    <>
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Class Name</FormLabel>
            <FormControl>
              <Input placeholder="e.g. 10th Grade English" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="subject"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Subject</FormLabel>
              <FormControl>
                <Input placeholder="e.g. English" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="teacherName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Teacher</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Mr. Smith" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="schedule"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Schedule</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Mon/Wed/Fri 9:00 AM" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="room"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Room</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Room 204" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Classes</h1>
          <p className="text-muted-foreground mt-1">Manage your active classes and rosters.</p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={(open) => {
          if (!open) form.reset();
          setIsCreateOpen(open);
        }}>
          <DialogTrigger asChild>
            <Button>Create Class</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Class</DialogTitle>
              <DialogDescription>Add a new class to start tracking attendance.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormFields />
                <DialogFooter className="mt-6">
                  <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Creating..." : "Create Class"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Class</DialogTitle>
              <DialogDescription>Update class details.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormFields />
                <DialogFooter className="mt-6">
                  <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3 mt-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : classes?.length === 0 ? (
          <div className="col-span-full py-16 text-center border-2 border-dashed border-border rounded-xl">
            <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-foreground mb-1">No classes yet</h3>
            <p className="text-muted-foreground mb-4">Create your first class to start tracking attendance.</p>
            <Button onClick={() => setIsCreateOpen(true)} variant="outline">Create Class</Button>
          </div>
        ) : (
          classes?.map((c) => (
            <Card key={c.id} className="group hover:shadow-md transition-shadow relative overflow-hidden flex flex-col">
              <div className="absolute top-0 left-0 w-1 h-full bg-primary/50 group-hover:bg-primary transition-colors" />
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl leading-tight">
                      <Link href={`/classes/${c.id}`} className="hover:text-primary transition-colors before:absolute before:inset-0">
                        {c.name}
                      </Link>
                    </CardTitle>
                    <CardDescription className="mt-1.5 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5" />
                      {c.subject}
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 -mt-1 -mr-2 relative z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(c)}>
                        <Pencil className="w-4 h-4 mr-2" /> Edit Details
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(c.id, c.name)}>
                        <Trash2 className="w-4 h-4 mr-2" /> Delete Class
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-end">
                <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-sm text-muted-foreground mb-6">
                  <div className="flex items-center gap-2">
                    <UserCircle className="w-4 h-4" />
                    <span className="truncate">{c.teacherName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span>{c.studentCount || 0} students</span>
                  </div>
                  {c.schedule && (
                    <div className="flex items-center gap-2 col-span-2">
                      <Clock className="w-4 h-4 shrink-0" />
                      <span className="truncate">{c.schedule}</span>
                    </div>
                  )}
                </div>
                
                <Button variant="secondary" className="w-full relative z-10" asChild>
                  <Link href={`/classes/${c.id}`}>
                    Manage Roster <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <AlertDialog open={!!deleteClassId} onOpenChange={(open) => { if (!open) setDeleteClassId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteClassName}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the class and all associated attendance records. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDelete}
            >
              Delete Class
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}