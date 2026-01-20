"use client";

export const STORAGE_VERSION = 9;

export const STORAGE_KEYS = {
  AUTH_CACHE: 'blindy_auth_cache',
  DATA_CACHE: `blindy_data_v${STORAGE_VERSION}`,
  VISOES_CACHE: `blindy_visoes_v${STORAGE_VERSION}`,
  TIMER_STATE: `blindados_timer_state_v${STORAGE_VERSION}`,
  TIMER_BACKUP: `blindados_timer_backup_v${STORAGE_VERSION}`,
  TIMER_SYNC: `blindados_timer_sync_v${STORAGE_VERSION}`,
  TIMER_PAUSED: `blindados_timer_paused_v${STORAGE_VERSION}`,
  ACTIVE_SECTION: 'blindy_active_section_v1',
  SIDEBAR_COLLAPSED: 'blindy_sidebar_collapsed_v1',
  SELECTED_CATEGORY: 'blindy_selected_category_v1',
  CATEGORY_DURATIONS: 'blindy_category_durations_v1',
  SOUND_ENABLED: 'blindy_sound_enabled_v1',
} as const;

export const OLD_CACHE_KEYS = [
  'blindy_data_cache_v1',
  'blindy_data_cache_v2',
  'blindy_data_cache_v3',
  'blindy_data_cache_v4',
  'blindy_data_cache_v5',
  'blindy_data_v6',
  'blindy_data_v7',
  'blindy_data_v8',
  'blindy_visoes_cache_v1',
  'blindy_visoes_cache_v2',
  'blindy_visoes_cache_v3',
  'blindy_visoes_cache_v4',
  'blindy_visoes_cache_v5',
  'blindy_visoes_cache_v6',
  'blindy_visoes_v7',
  'blindy_visoes_v8',
  'blindados_timer_state_v1',
  'blindados_timer_state_v2',
  'blindados_timer_state_v3',
  'blindados_timer_state_v4',
  'blindados_timer_state_v5',
  'blindados_timer_state_v6',
  'blindados_timer_state_v7',
  'blindados_timer_state_v8',
  'blindados_timer_sync_v1',
  'blindados_timer_sync_v2',
  'blindados_timer_sync_v3',
  'blindados_timer_sync_v4',
  'blindados_timer_paused_v1',
  'blindados_timer_paused_v2',
  'blindados_timer_paused_v3',
  'blindados_timer_paused_v4',
];

export const AUTH_CACHE_EXPIRY = 1000 * 60 * 60 * 24 * 7;
