import type {
  AttendanceRowDto,
  LatePayerDto,
  ReportFilters,
  ReportSummaryDto,
  SavedFilterDto,
  SaveFilterRequest,
} from '@aulinha/contracts';
import { api, downloadFile } from './client';

export function reportQuery(f: ReportFilters): string {
  const q = new URLSearchParams({ from: f.from, to: f.to });
  if (f.studentIds?.length) q.set('studentIds', f.studentIds.join(','));
  if (f.tags?.length) q.set('tags', f.tags.join(','));
  if (f.methods?.length) q.set('methods', f.methods.join(','));
  if (f.planTypes?.length) q.set('planTypes', f.planTypes.join(','));
  if (f.onlyLate) q.set('onlyLate', 'true');
  return q.toString();
}

export const reportsApi = {
  summary: (f: ReportFilters) => api<ReportSummaryDto>(`/reports/summary?${reportQuery(f)}`),
  latePayers: (f: ReportFilters) => api<LatePayerDto[]>(`/reports/late-payers?${reportQuery(f)}`),
  attendance: (f: ReportFilters) => api<AttendanceRowDto[]>(`/reports/attendance?${reportQuery(f)}`),
  exportCsv: (type: string, f: ReportFilters) =>
    downloadFile(`/reports/export.csv?type=${type}&${reportQuery(f)}`, `aulinha-${type}.csv`),
  filters: () => api<SavedFilterDto[]>('/saved-filters'),
  saveFilter: (body: SaveFilterRequest) => api<SavedFilterDto>('/saved-filters', { method: 'POST', body: JSON.stringify(body) }),
  removeFilter: (id: string) => api<void>(`/saved-filters/${id}`, { method: 'DELETE' }),
};
