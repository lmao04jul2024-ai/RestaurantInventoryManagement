jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

import api from '@/lib/api';
import { analyticsService, downloadBlob } from '@/services/analytics.service';

const apiGet = api.get as jest.Mock;
const apiPost = api.post as jest.Mock;
const apiPatch = api.patch as jest.Mock;
const apiDelete = api.delete as jest.Mock;

describe('analyticsService — Week 19 endpoints', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fetches sales/inventory/customer reports with the window param', async () => {
    apiGet.mockResolvedValueOnce({ data: { data: { windowDays: 7 } } });
    apiGet.mockResolvedValueOnce({ data: { data: { windowDays: 30 } } });
    apiGet.mockResolvedValueOnce({ data: { data: { windowDays: 90 } } });

    await expect(analyticsService.getSales(7)).resolves.toEqual({ windowDays: 7 });
    await expect(analyticsService.getInventory(30)).resolves.toEqual({ windowDays: 30 });
    await expect(analyticsService.getCustomers(90)).resolves.toEqual({ windowDays: 90 });

    expect(apiGet).toHaveBeenNthCalledWith(1, '/analytics/sales', { params: { days: 7 } });
    expect(apiGet).toHaveBeenNthCalledWith(2, '/analytics/inventory', { params: { days: 30 } });
    expect(apiGet).toHaveBeenNthCalledWith(3, '/analytics/customers', { params: { days: 90 } });
  });

  it('downloads an export as a blob with responseType blob', async () => {
    const blob = new Blob(['csv']);
    apiGet.mockResolvedValue({ data: blob });

    await expect(analyticsService.exportReport('sales', 'csv', 30)).resolves.toBe(blob);
    expect(apiGet).toHaveBeenCalledWith('/analytics/export', {
      params: { type: 'sales', format: 'csv', days: 30 },
      responseType: 'blob',
    });
  });

  it('lists, creates, updates and deletes report templates', async () => {
    apiGet.mockResolvedValue({ data: { data: [{ id: 't1' }] } });
    apiPost.mockResolvedValue({ data: { data: { id: 't2' } } });
    apiPatch.mockResolvedValue({ data: { data: { id: 't1', name: 'Renamed' } } });
    apiDelete.mockResolvedValue({});

    await expect(analyticsService.listTemplates()).resolves.toEqual([{ id: 't1' }]);
    await expect(analyticsService.createTemplate({ name: 'A', type: 'sales' })).resolves.toEqual({ id: 't2' });
    await expect(analyticsService.updateTemplate('t1', { name: 'Renamed' })).resolves.toEqual({ id: 't1', name: 'Renamed' });
    await analyticsService.deleteTemplate('t1');

    expect(apiGet).toHaveBeenCalledWith('/analytics/templates');
    expect(apiPost).toHaveBeenCalledWith('/analytics/templates', { name: 'A', type: 'sales' });
    expect(apiPatch).toHaveBeenCalledWith('/analytics/templates/t1', { name: 'Renamed' });
    expect(apiDelete).toHaveBeenCalledWith('/analytics/templates/t1');
  });
});

describe('downloadBlob — Week 19.4 browser save', () => {
  it('creates an anchor with the blob URL and clicks it', () => {
    // jsdom does not implement blob URLs — stub both URL methods.
    const create = (URL.createObjectURL = jest.fn()) as unknown as jest.Mock;
    const revoke = (URL.revokeObjectURL = jest.fn()) as unknown as jest.Mock;
    create.mockReturnValue('blob:mock');

    const click = jest.fn();
    const removeAnchor = jest.fn();
    const anchor = {
      href: '',
      download: '',
      click,
      remove: removeAnchor,
    } as unknown as HTMLAnchorElement & { click: () => void; remove: () => void };
    const createElement = jest.spyOn(document, 'createElement').mockReturnValue(anchor);
    const append = jest.spyOn(document.body, 'appendChild').mockImplementation(() => anchor);

    downloadBlob(new Blob(['x']), 'sales-report.csv');

    expect(createElement).toHaveBeenCalledWith('a');
    expect(anchor.href).toBe('blob:mock');
    expect(anchor.download).toBe('sales-report.csv');
    expect(click).toHaveBeenCalled();
    expect(append).toHaveBeenCalled();
    expect(removeAnchor).toHaveBeenCalled();
    expect(revoke).toHaveBeenCalledWith('blob:mock');

    createElement.mockRestore();
    append.mockRestore();
  });
});