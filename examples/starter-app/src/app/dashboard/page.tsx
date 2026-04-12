'use client';

import { useEffect, useState, useCallback } from 'react';
import { TokenHelpers } from '@/helpers/token-helpers';
import { ApiRequests } from '@/lib/api-requests';
import HomePage from '../../components/home-page';

export default function DashboardPage() {
  const [token, setToken] = useState<string | null>(null);
  const [storeName, setStoreName] = useState('');

  const getHostStoreName = () => {
    if (typeof window === 'undefined') return '';

    const host = window.location.hostname || '';
    const firstPart = host.split('.')[0] || '';

    if (!firstPart) return '';
    if (['localhost', '127', 'ikas-app-examples'].includes(firstPart)) return '';

    return firstPart;
  };

  const fetchStoreName = useCallback(async (currentToken: string) => {
    try {
      const res = await ApiRequests.ikas.getMerchant(currentToken);
      const apiStoreName = res.data?.data?.merchantInfo?.storeName?.trim?.() || '';

      if (res.status === 200 && apiStoreName) {
        setStoreName(apiStoreName);
        return;
      }

      const hostStoreName = getHostStoreName();
      if (hostStoreName) {
        setStoreName(hostStoreName);
      }
    } catch (error) {
      console.error('Error fetching store name:', error);

      const hostStoreName = getHostStoreName();
      if (hostStoreName) {
        setStoreName(hostStoreName);
      }
    }
  }, []);

  const initializeDashboard = useCallback(async () => {
    try {
      const fetchedToken = await TokenHelpers.getTokenForIframeApp();
      setToken(fetchedToken || null);

      if (fetchedToken) {
        await fetchStoreName(fetchedToken);
        return;
      }

      const hostStoreName = getHostStoreName();
      if (hostStoreName) {
        setStoreName(hostStoreName);
      }
    } catch (error) {
      console.error('Error initializing dashboard:', error);

      const hostStoreName = getHostStoreName();
      if (hostStoreName) {
        setStoreName(hostStoreName);
      }
    }
  }, [fetchStoreName]);

  useEffect(() => {
    initializeDashboard();
  }, [initializeDashboard]);

  return <HomePage token={token} storeName={storeName} />;
}
