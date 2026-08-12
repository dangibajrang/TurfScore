import { useEffect } from 'react';
import {
  getCachedReachability,
  isProbablyOnline,
  markApiUnreachable,
  probeApiHealth,
} from './connectivity';
import { ensureOfflineDb } from './db';
import { countByStatus, listResumeCandidates } from './queue';
import { useOfflineUiStore } from './offlineUiStore';
import { syncMatchQueue } from './sync';
import { useScoringUiStore } from '@/features/scoring/scoringUiStore';

/**
 * Global connectivity + resume sync hooks for the app shell / live scoring.
 */
export function useOfflineConnectivity(activeMatchId?: string) {
  const setConnection = useOfflineUiStore((s) => s.setConnection);
  const setCounts = useOfflineUiStore((s) => s.setCounts);
  const authPaused = useOfflineUiStore((s) => s.authPaused);
  const setAuthPaused = useOfflineUiStore((s) => s.setAuthPaused);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      await ensureOfflineDb();
      const reach = await probeApiHealth(true);
      if (cancelled) return;

      if (authPaused) {
        setConnection('AUTH_REQUIRED');
      } else if (!reach.browserOnline || reach.apiReachable === false) {
        setConnection('OFFLINE');
      } else if (useOfflineUiStore.getState().syncingMatchId) {
        setConnection('SYNCING');
      } else {
        setConnection('ONLINE');
      }

      if (activeMatchId) {
        const counts = await countByStatus(activeMatchId);
        if (!cancelled) {
          setCounts(counts.PENDING + counts.SYNCING, counts.FAILED);
        }
        if (reach.browserOnline && reach.apiReachable !== false && !authPaused) {
          void syncMatchQueue(activeMatchId);
        }
      }
    };

    void refresh();

    const onOnline = () => {
      void refresh();
    };
    const onOffline = () => {
      setConnection('OFFLINE');
      markApiUnreachable();
      // Unstick UI if a fetch was mid-flight when the network dropped.
      useScoringUiStore.getState().setSubmitting(false);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisible);

    const interval = window.setInterval(() => {
      if (isProbablyOnline()) void probeApiHealth(true).then(() => {
        const r = getCachedReachability();
        if (r.apiReachable && activeMatchId && !useOfflineUiStore.getState().authPaused) {
          void syncMatchQueue(activeMatchId);
        }
      });
    }, 15_000);

    return () => {
      cancelled = true;
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(interval);
    };
  }, [activeMatchId, authPaused, setAuthPaused, setConnection, setCounts]);
}

export function useResumeMatches() {
  useEffect(() => {
    void ensureOfflineDb();
  }, []);
  return {
    async load() {
      return listResumeCandidates();
    },
  };
}
