/**
 * Stable, machine-readable keys — frontend can key off `key` for icons/links/
 * i18n instead of parsing `label` text. Adding a future setup requirement
 * means adding one more member here + one more branch in
 * `SetupStatusService.getStatus()`; nothing else needs to change shape.
 */
export type SetupCheckKey =
  'SUBSCRIPTION' | 'RBAC' | 'LOCATION' | 'UNIT' | 'PRODUCT';

export interface SetupCheckItem {
  key: SetupCheckKey;
  label: string;
  completed: boolean;
}

export interface SetupStatusData {
  completedCount: number;
  totalCount: number;
  isComplete: boolean;
  checks: SetupCheckItem[];
}

export interface SetupStatusResponse {
  success: true;
  data: SetupStatusData;
}
