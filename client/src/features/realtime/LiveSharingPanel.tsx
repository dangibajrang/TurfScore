import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { Button, Card } from '@/components/ui';
import { useUiStore } from '@/stores/uiStore';
import { ApiError } from '@/lib/apiClient';
import { liveSharingApi } from './liveSharingApi';

type Props = {
  matchId: string;
};

export function LiveSharingPanel({ matchId }: Props) {
  const showToast = useUiStore((s) => s.showToast);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['live-sharing', matchId],
    queryFn: () => liveSharingApi.get(matchId),
  });

  const info = query.data;
  const publicUrl = info?.publicLiveEnabled ? info.publicUrl : null;

  const qrQuery = useQuery({
    queryKey: ['live-sharing-qr', publicUrl],
    enabled: Boolean(publicUrl),
    queryFn: () =>
      QRCode.toDataURL(publicUrl!, {
        width: 220,
        margin: 1,
        color: { dark: '#06151A', light: '#F3F7F5' },
      }),
    staleTime: Infinity,
  });

  const enable = useMutation({
    mutationFn: () => liveSharingApi.enable(matchId),
    onSuccess: async (data) => {
      showToast('Live sharing enabled');
      await qc.invalidateQueries({ queryKey: ['live-sharing', matchId] });
      await qc.invalidateQueries({ queryKey: ['match', matchId] });
      if (data.publicUrl) {
        try {
          await navigator.clipboard.writeText(data.publicUrl);
          showToast('Live score link copied.');
        } catch {
          /* ignore */
        }
      }
    },
    onError: (e) => showToast(e instanceof ApiError ? e.message : 'Could not enable sharing'),
  });

  const disable = useMutation({
    mutationFn: () => liveSharingApi.disable(matchId),
    onSuccess: async () => {
      showToast('Live sharing stopped');
      await qc.invalidateQueries({ queryKey: ['live-sharing', matchId] });
      await qc.invalidateQueries({ queryKey: ['match', matchId] });
    },
    onError: (e) => showToast(e instanceof ApiError ? e.message : 'Could not disable sharing'),
  });

  const copyLink = async () => {
    if (!info?.publicUrl) return;
    try {
      await navigator.clipboard.writeText(info.publicUrl);
      showToast('Live score link copied.');
    } catch {
      showToast('Could not copy link');
    }
  };

  const share = async () => {
    if (!info?.publicUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'TurfScore Live',
          text: 'Follow this live cricket score on TurfScore',
          url: info.publicUrl,
        });
        return;
      } catch {
        /* fall through to copy */
      }
    }
    await copyLink();
  };

  return (
    <Card className="min-w-0 space-y-3" data-testid="live-sharing-panel">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="font-semibold">Live sharing</h3>
          <p className="text-xs text-text-muted">
            Status:{' '}
            <span className={info?.publicLiveEnabled ? 'text-primary' : 'text-text-muted'}>
              {info?.publicLiveEnabled ? 'ON' : 'OFF'}
            </span>
          </p>
        </div>
        {info?.publicLiveEnabled ? (
          <Button
            variant="danger"
            size="sm"
            className="w-full shrink-0 sm:w-auto"
            disabled={disable.isPending}
            onClick={() => disable.mutate()}
            data-testid="disable-live-sharing"
          >
            Stop live sharing
          </Button>
        ) : (
          <Button
            size="sm"
            className="w-full shrink-0 sm:w-auto"
            disabled={enable.isPending}
            onClick={() => enable.mutate()}
            data-testid="enable-live-sharing"
          >
            {enable.isPending ? 'Enabling…' : 'Enable live score'}
          </Button>
        )}
      </div>

      {info?.publicLiveEnabled && info.publicUrl ? (
        <div className="min-w-0 space-y-3 rounded-control border border-border-subtle bg-surface-elevated p-3">
          <p className="break-all text-xs text-text-muted sm:text-sm" data-testid="public-live-url">
            {info.publicUrl}
          </p>
          <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-3">
            <Button variant="secondary" size="sm" className="w-full" onClick={() => void copyLink()}>
              Copy link
            </Button>
            <Button variant="outline" size="sm" className="w-full" onClick={() => void share()}>
              Share
            </Button>
            <a
              href={info.publicPath ?? info.publicUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 w-full items-center justify-center rounded-control border border-border px-3 text-sm font-semibold"
            >
              Open viewer
            </a>
          </div>
          {qrQuery.data ? (
            <>
              <details className="rounded-control border border-border-subtle bg-surface p-2 sm:hidden">
                <summary className="cursor-pointer select-none text-sm font-semibold text-primary">
                  Show QR code
                </summary>
                <div className="mt-2 flex flex-col items-center gap-2">
                  <img
                    src={qrQuery.data}
                    alt="QR code for live match"
                    className="h-36 w-36 rounded-control bg-white p-2"
                  />
                  <p className="text-xs text-text-muted">Scan to follow the live score</p>
                </div>
              </details>
              <div className="hidden flex-col items-center gap-2 pt-2 sm:flex">
                <img
                  src={qrQuery.data}
                  alt="QR code for live match"
                  className="h-44 w-44 rounded-control bg-white p-2"
                  data-testid="live-qr"
                />
                <p className="text-xs text-text-muted">Scan to follow the live score</p>
              </div>
            </>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-text-muted">
          Enable live sharing so spectators can watch on another phone or tablet.
        </p>
      )}
    </Card>
  );
}
