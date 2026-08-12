import { useRef, useState } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { uploadsApi } from '@/features/uploads/uploadsApi';
import { ApiError } from '@/lib/apiClient';
import { cn } from '@/lib/cn';

type ImageUploadFieldProps = {
  name: string;
  value: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  optional?: boolean;
  className?: string;
};

export function ImageUploadField({
  name,
  value,
  onChange,
  label = 'Profile image',
  optional = false,
  className,
}: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickFile = () => inputRef.current?.click();

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const result = await uploadsApi.uploadImage(file);
      onChange(result.url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not upload image');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-text-muted">
          {label}
          {optional ? ' (optional)' : ''}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={name || 'User'} src={value} size="lg" />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={uploading}
            onClick={pickFile}
          >
            <Camera className="h-4 w-4" aria-hidden />
            {uploading ? 'Uploading…' : value ? 'Change photo' : 'Upload photo'}
          </Button>
          {value ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={uploading}
              onClick={() => onChange(null)}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Remove
            </Button>
          ) : null}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />

      <p className="text-xs text-text-subtle">JPEG, PNG, WebP, or GIF · max 2 MB</p>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
