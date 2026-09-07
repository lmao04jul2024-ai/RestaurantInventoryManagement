import api from '@/lib/api';
import type {
  CustomerAnalytics,
  ExportFormat,
  InventoryAnalytics,
  ReportTemplate,
  ReportTemplateInput,
  ReportType,
  SalesAnalytics,
} from '@/types/analytics';

/** Week 19 — analytics endpoints (packages/api/src/routes/analytics.routes.ts). */
export const analyticsService = {
  async getSales(days = 30): Promise<SalesAnalytics> {
    const { data } = await api.get<{ data: SalesAnalytics }>('/analytics/sales', { params: { days } });
    return data.data;
  },

  async getInventory(days = 30): Promise<InventoryAnalytics> {
    const { data } = await api.get<{ data: InventoryAnalytics }>('/analytics/inventory', { params: { days } });
    return data.data;
  },

  async getCustomers(days = 30): Promise<CustomerAnalytics> {
    const { data } = await api.get<{ data: CustomerAnalytics }>('/analytics/customers', { params: { days } });
    return data.data;
  },

  /**
   * Downloads a report export (CSV or PDF) and triggers the browser save.
   * The API returns raw bytes with Content-Disposition; axios hands us the
   * Blob, which we materialize client-side.
   */
  async exportReport(type: ReportType, format: ExportFormat, days = 30): Promise<Blob> {
    const res = await api.get<Blob>('/analytics/export', {
      params: { type, format, days },
      responseType: 'blob',
    });
    return res.data;
  },

  async listTemplates(): Promise<ReportTemplate[]> {
    const { data } = await api.get<{ data: ReportTemplate[] }>('/analytics/templates');
    return data.data;
  },

  async createTemplate(payload: ReportTemplateInput): Promise<ReportTemplate> {
    const { data } = await api.post<{ data: ReportTemplate }>('/analytics/templates', payload);
    return data.data;
  },

  async updateTemplate(id: string, payload: Partial<ReportTemplateInput>): Promise<ReportTemplate> {
    const { data } = await api.patch<{ data: ReportTemplate }>(`/analytics/templates/${id}`, payload);
    return data.data;
  },

  async deleteTemplate(id: string): Promise<void> {
    await api.delete(`/analytics/templates/${id}`);
  },
};

/** Triggers a browser download from a Blob with a suggested filename. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}