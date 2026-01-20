"use client";

import { useEffect } from 'react';
import { safeStorage } from '@/lib/utils/safeStorage';
import { OLD_CACHE_KEYS } from '@/lib/utils/storage.constants';

export function useAutoFix() {
  useEffect(() => {
    safeStorage.removeMany(OLD_CACHE_KEYS);
  }, []);
}
