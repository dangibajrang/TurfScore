import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ImageUploadField } from '@/components/ui/ImageUploadField';
import { useAuthStore, requireAccountMessage } from '@/features/auth/authStore';
import { authApi } from '@/features/auth/authApi';
import { useUiStore } from '@/stores/uiStore';
import { ApiError } from '@/lib/apiClient';

export function ProfilePage() {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);
  const showToast = useUiStore((s) => s.showToast);
  const [saving, setSaving] = useState(false);

  if (status === 'guest') {
    return (
      <EmptyState
        title="Guest profile"
        description={requireAccountMessage()}
        action={
          <Link
            to="/register"
            className="inline-flex h-11 items-center rounded-control bg-primary px-4 text-sm font-semibold text-background"
          >
            Create Account
          </Link>
        }
      />
    );
  }

  if (!user) return null;

  const saveImage = async (url: string | null) => {
    setSaving(true);
    try {
      const updated = await authApi.updateProfile({ profileImageUrl: url });
      setAuthenticated(updated);
      showToast(url ? 'Profile photo updated' : 'Profile photo removed');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not update profile photo');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card className="space-y-4">
        <ImageUploadField
          name={user.name}
          value={user.profileImage}
          onChange={(url) => {
            if (saving) return;
            void saveImage(url);
          }}
          label="Your photo"
        />
        <div className="min-w-0 border-t border-border-subtle pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-2xl font-semibold">{user.name}</h2>
            <Badge tone={user.role === 'ADMIN' ? 'warning' : 'primary'}>{user.role}</Badge>
          </div>
          <p className="mt-1 text-sm text-text-muted">{user.email}</p>
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-text-muted">Account</h3>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-text-muted">Name</dt>
            <dd className="font-medium">{user.name}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-text-muted">Email</dt>
            <dd className="font-medium">{user.email}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-text-muted">Role</dt>
            <dd className="font-medium">{user.role}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-text-muted">Profile image</dt>
            <dd className="font-medium">{user.profileImage ? 'Set' : 'None'}</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
