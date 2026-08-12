import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Input, Skeleton } from '@/components/ui';
import { teamsApi } from '@/features/teams/teamsApi';
import { useUiStore } from '@/stores/uiStore';
import { ApiError } from '@/lib/apiClient';
import { useEffect } from 'react';

const schema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(120),
  shortName: z.string().trim().max(12).optional(),
  description: z.string().trim().max(500).optional(),
  logoUrl: z.string().trim().url('Enter a valid URL').optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

export function TeamFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const showToast = useUiStore((s) => s.showToast);
  const qc = useQueryClient();

  const existing = useQuery({
    queryKey: ['team', id],
    queryFn: () => teamsApi.get(id!),
    enabled: mode === 'edit' && !!id,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', shortName: '', description: '', logoUrl: '' },
  });

  useEffect(() => {
    if (existing.data) {
      form.reset({
        name: existing.data.name,
        shortName: existing.data.shortName ?? '',
        description: existing.data.description ?? '',
        logoUrl: existing.data.logoUrl ?? '',
      });
    }
  }, [existing.data, form]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        name: values.name,
        shortName: values.shortName || undefined,
        description: values.description || undefined,
        logoUrl: values.logoUrl || undefined,
      };
      return mode === 'create'
        ? teamsApi.create(payload)
        : teamsApi.update(id!, payload);
    },
    onSuccess: (team) => {
      void qc.invalidateQueries({ queryKey: ['teams'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      showToast(mode === 'create' ? 'Team created' : 'Team updated');
      navigate(`/teams/${team.id}`);
    },
    onError: (err) => {
      showToast(err instanceof ApiError ? err.message : 'Could not save team');
    },
  });

  if (mode === 'edit' && existing.isLoading) {
    return <Skeleton className="mx-auto h-80 max-w-xl w-full" />;
  }

  return (
    <div className="mx-auto max-w-xl">
      <h2 className="mb-6 font-display text-2xl font-semibold">
        {mode === 'create' ? 'Create Team' : 'Edit Team'}
      </h2>
      <form
        className="space-y-4"
        onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
        noValidate
      >
        <Input label="Team name" error={form.formState.errors.name?.message} {...form.register('name')} />
        <Input
          label="Short name"
          placeholder="RCC"
          error={form.formState.errors.shortName?.message}
          {...form.register('shortName')}
        />
        <Input
          label="Description"
          error={form.formState.errors.description?.message}
          {...form.register('description')}
        />
        <Input
          label="Logo URL (optional)"
          error={form.formState.errors.logoUrl?.message}
          {...form.register('logoUrl')}
        />
        <Button type="submit" className="w-full" disabled={mutation.isPending} size="lg">
          {mutation.isPending
            ? mode === 'create'
              ? 'Creating…'
              : 'Saving…'
            : mode === 'create'
              ? 'Create Team'
              : 'Save changes'}
        </Button>
      </form>
    </div>
  );
}
