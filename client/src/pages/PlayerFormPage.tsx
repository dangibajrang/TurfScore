import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Input, Select, Skeleton } from '@/components/ui';
import { ImageUploadField } from '@/components/ui/ImageUploadField';
import { playersApi } from '@/features/players/playersApi';
import { useUiStore } from '@/stores/uiStore';
import { ApiError } from '@/lib/apiClient';

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  role: z.enum(['BATTER', 'BOWLER', 'ALL_ROUNDER', 'WICKET_KEEPER']),
  battingStyle: z.enum(['RIGHT_HAND', 'LEFT_HAND', '']).optional(),
  bowlingStyle: z
    .enum([
      'RIGHT_ARM_FAST',
      'RIGHT_ARM_MEDIUM',
      'RIGHT_ARM_SPIN',
      'LEFT_ARM_FAST',
      'LEFT_ARM_MEDIUM',
      'LEFT_ARM_SPIN',
      '',
    ])
    .optional(),
  bio: z.string().max(1000).optional(),
  phone: z.string().max(32).optional(),
  profileImageUrl: z.string().nullable().optional(),
});

type FormValues = z.infer<typeof schema>;

export function PlayerFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const showToast = useUiStore((s) => s.showToast);
  const qc = useQueryClient();

  const existing = useQuery({
    queryKey: ['player', id],
    queryFn: () => playersApi.get(id!),
    enabled: mode === 'edit' && !!id,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      role: 'ALL_ROUNDER',
      battingStyle: '',
      bowlingStyle: '',
      bio: '',
      phone: '',
      profileImageUrl: null,
    },
  });

  useEffect(() => {
    if (!existing.data) return;
    form.reset({
      name: existing.data.name,
      role: (existing.data.role === 'BATSMAN'
        ? 'BATTER'
        : existing.data.role) as FormValues['role'],
      battingStyle: (existing.data.battingStyle ?? '') as FormValues['battingStyle'],
      bowlingStyle: (existing.data.bowlingStyle ?? '') as FormValues['bowlingStyle'],
      bio: existing.data.bio ?? '',
      phone: existing.data.phone ?? '',
      profileImageUrl: existing.data.profileImageUrl,
    });
  }, [existing.data, form]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        name: values.name,
        role: values.role,
        battingStyle: values.battingStyle || undefined,
        bowlingStyle: values.bowlingStyle || undefined,
        bio: values.bio || undefined,
        phone: values.phone || undefined,
        profileImageUrl: values.profileImageUrl ?? '',
      };
      return mode === 'create' ? playersApi.create(payload) : playersApi.update(id!, payload);
    },
    onSuccess: (player) => {
      void qc.invalidateQueries({ queryKey: ['players'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      showToast(mode === 'create' ? 'Player created' : 'Player updated');
      navigate(`/players/${player.id}`);
    },
    onError: (err) => {
      showToast(err instanceof ApiError ? err.message : 'Could not save player');
    },
  });

  const profileImageUrl = useWatch({ control: form.control, name: 'profileImageUrl' }) ?? null;
  const playerName = useWatch({ control: form.control, name: 'name' }) || existing.data?.name || 'Player';

  if (mode === 'edit' && existing.isLoading) {
    return <Skeleton className="mx-auto h-80 max-w-xl w-full" />;
  }

  return (
    <div className="mx-auto max-w-xl">
      <h2 className="mb-6 font-display text-2xl font-semibold">
        {mode === 'create' ? 'Add Player' : 'Edit Player'}
      </h2>
      <form
        className="space-y-4"
        onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
        noValidate
      >
        <ImageUploadField
          name={playerName}
          value={profileImageUrl}
          onChange={(url) => form.setValue('profileImageUrl', url, { shouldDirty: true })}
          label="Player photo"
          optional
        />
        <Input label="Name" error={form.formState.errors.name?.message} {...form.register('name')} />
        <Select
          label="Role"
          options={[
            { value: 'BATTER', label: 'Batter' },
            { value: 'BOWLER', label: 'Bowler' },
            { value: 'ALL_ROUNDER', label: 'All-rounder' },
            { value: 'WICKET_KEEPER', label: 'Wicket Keeper' },
          ]}
          error={form.formState.errors.role?.message}
          {...form.register('role')}
        />
        <Select
          label="Batting style"
          options={[
            { value: '', label: 'Not set' },
            { value: 'RIGHT_HAND', label: 'Right Hand' },
            { value: 'LEFT_HAND', label: 'Left Hand' },
          ]}
          {...form.register('battingStyle')}
        />
        <Select
          label="Bowling style"
          options={[
            { value: '', label: 'Not set' },
            { value: 'RIGHT_ARM_FAST', label: 'Right Arm Fast' },
            { value: 'RIGHT_ARM_MEDIUM', label: 'Right Arm Medium' },
            { value: 'RIGHT_ARM_SPIN', label: 'Right Arm Spin' },
            { value: 'LEFT_ARM_FAST', label: 'Left Arm Fast' },
            { value: 'LEFT_ARM_MEDIUM', label: 'Left Arm Medium' },
            { value: 'LEFT_ARM_SPIN', label: 'Left Arm Spin' },
          ]}
          {...form.register('bowlingStyle')}
        />
        <Input label="Phone (optional)" {...form.register('phone')} />
        <Input label="Bio (optional)" {...form.register('bio')} />
        <Button type="submit" className="w-full" size="lg" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : mode === 'create' ? 'Create Player' : 'Save changes'}
        </Button>
      </form>
    </div>
  );
}
