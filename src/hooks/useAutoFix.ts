"use client";

import { useEffect } from 'react';

const OLD_CACHE_KEYS = [
  'blindy_data_cache_v1',
  'blindy_data_cache_v2',
  'blindy_data_cache_v3',
  'blindy_data_cache_v4',
  'blindy_data_cache_v5',
  'blindy_data_v6',
  'blindy_visoes_cache_v1',
  'blindy_visoes_cache_v2',
  'blindy_visoes_cache_v3',
  'blindy_visoes_cache_v4',
  'blindy_visoes_cache_v5',
  'blindados_timer_state_v1',
  'blindados_timer_state_v2',
  'blindados_timer_state_v3',
  'blindados_timer_state_v4',
  'blindados_timer_state_v5',
  'blindados_timer_state_v6',
  'blindados_timer_state_v7',
];

export function useAutoFix() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      OLD_CACHE_KEYS.forEach(key => {
        localStorage.removeItem(key);
      });
    } catch {
    }
  }, []);
}
