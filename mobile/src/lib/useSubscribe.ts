import { useState } from 'react';
import { apiFetch } from './api';

export function useSubscribe(communityId: string, initialSubscribed: boolean, initialCount: number) {
  const [isSubscribed, setIsSubscribed] = useState(initialSubscribed);
  const [subscriberCount, setSubscriberCount] = useState(initialCount);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setError(null);
    const wasSubscribed = isSubscribed;
    const nextSubscribed = !wasSubscribed;

    setIsSubscribed(nextSubscribed);
    setSubscriberCount((c) => c + (nextSubscribed ? 1 : -1));

    try {
      await apiFetch(`/communities/${communityId}/subscribe`, {
        method: nextSubscribed ? 'POST' : 'DELETE',
      });
    } catch (err) {
      setIsSubscribed(wasSubscribed);
      setSubscriberCount((c) => c + (nextSubscribed ? -1 : 1));
      setError(err instanceof Error ? err.message : 'Не удалось обновить подписку');
    }
  }

  return { isSubscribed, subscriberCount, toggle, error };
}
