import api from '@/lib/api';
import type {
  Category,
  EffectivePriceResponse,
  Menu,
  MenuItem,
  MenuItemCreatePayload,
  MenuItemListQuery,
  MenuItemListResponse,
  MenuItemUpdatePayload,
  PricingRulePayload,
  AvailabilityWindowPayload,
} from '@/types/menu';

/**
 * All endpoints match packages/api/src/routes/menu.routes.ts.
 * The shared axios client already attaches Authorization + X-Tenant-ID.
 */
export const menuService = {
  async listMenus(): Promise<Menu[]> {
    const { data } = await api.get<{ data: Menu[] }>('/menus');
    return data.data;
  },

  async listCategories(menuId: string): Promise<Category[]> {
    const { data } = await api.get<{ data: Category[] }>(`/menus/${menuId}/categories`);
    return data.data;
  },

  async createCategory(
    menuId: string,
    payload: { name: string; parentId?: string | null; icon?: string },
  ): Promise<Category> {
    const { data } = await api.post<{ data: Category }>(`/menus/${menuId}/categories`, payload);
    return data.data;
  },

  async listMenuItems(query: MenuItemListQuery = {}): Promise<MenuItemListResponse> {
    const { data } = await api.get<MenuItemListResponse>('/menus/items', { params: query });
    return data;
  },

  async createMenuItem(payload: MenuItemCreatePayload): Promise<MenuItem> {
    const { data } = await api.post<{ data: MenuItem }>('/menus/items', payload);
    return data.data;
  },

  async updateMenuItem(id: string, payload: MenuItemUpdatePayload): Promise<MenuItem> {
    const { data } = await api.patch<{ data: MenuItem }>(`/menus/items/${id}`, payload);
    return data.data;
  },

  async updateItemAvailability(id: string, isAvailable: boolean): Promise<MenuItem> {
    const { data } = await api.patch<{ data: MenuItem }>(`/menus/items/${id}/availability`, {
      isAvailable,
    });
    return data.data;
  },

  async deleteMenuItem(id: string): Promise<void> {
    await api.delete(`/menus/items/${id}`);
  },

  async createPricingRule(
    itemId: string,
    payload: PricingRulePayload,
  ): Promise<{ appliedRuleIds: string[] }> {
    const { data } = await api.post(`/menus/items/${itemId}/pricing-rules`, payload);
    return data.data;
  },

  async updatePricingRule(itemId: string, ruleId: string, payload: Partial<PricingRulePayload>) {
    const { data } = await api.patch(`/menus/items/${itemId}/pricing-rules/${ruleId}`, payload);
    return data.data;
  },

  async deletePricingRule(itemId: string, ruleId: string): Promise<void> {
    await api.delete(`/menus/items/${itemId}/pricing-rules/${ruleId}`);
  },

  async createAvailabilityWindow(
    itemId: string,
    payload: AvailabilityWindowPayload,
  ): Promise<void> {
    await api.post(`/menus/items/${itemId}/availability-windows`, payload);
  },

  async updateAvailabilityWindow(
    itemId: string,
    windowId: string,
    payload: AvailabilityWindowPayload,
  ): Promise<void> {
    await api.patch(`/menus/items/${itemId}/availability-windows/${windowId}`, payload);
  },

  async deleteAvailabilityWindow(itemId: string, windowId: string): Promise<void> {
    await api.delete(`/menus/items/${itemId}/availability-windows/${windowId}`);
  },

  async getEffectivePrice(itemId: string, at?: Date): Promise<EffectivePriceResponse['data']> {
    const { data } = await api.get<EffectivePriceResponse>(`/menus/items/${itemId}/effective`, {
      params: at ? { at: at.toISOString() } : {},
    });
    return data.data;
  },
};
