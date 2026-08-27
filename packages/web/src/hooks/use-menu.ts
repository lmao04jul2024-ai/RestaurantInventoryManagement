'use client';

import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { menuService } from '@/services/menu.service';
import type {
  AvailabilityWindowPayload,
  Menu,
  MenuItemCreatePayload,
  MenuItemListQuery,
  MenuItemUpdatePayload,
  PricingRulePayload,
} from '@/types/menu';

/** The tenant's first menu drives category-tree browsing on the admin page. */
export function useMenus() {
  return useQuery({
    queryKey: ['menus'],
    queryFn: menuService.listMenus,
    staleTime: 5 * 60_000,
  });
}

export function useCategories(menuId: string | undefined) {
  return useQuery({
    queryKey: ['categories', menuId],
    queryFn: () => menuService.listCategories(menuId!),
    enabled: !!menuId,
    staleTime: 30_000,
  });
}

export function useMenuItems(query: MenuItemListQuery) {
  return useQuery({
    queryKey: ['menuItems', query],
    queryFn: () => menuService.listMenuItems(query),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function useEffectivePrice(itemId: string | undefined, at?: Date) {
  return useQuery({
    queryKey: ['effective', itemId, at?.toISOString()],
    queryFn: () => menuService.getEffectivePrice(itemId!, at),
    enabled: !!itemId,
    staleTime: 30_000,
  });
}

export function useCreateMenuItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: MenuItemCreatePayload) => menuService.createMenuItem(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menuItems'] }),
  });
}

export function useUpdateMenuItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: MenuItemUpdatePayload }) =>
      menuService.updateMenuItem(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menuItems'] }),
  });
}

export function useDeleteMenuItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => menuService.deleteMenuItem(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menuItems'] }),
  });
}

export function useCreatePricingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, payload }: { itemId: string; payload: PricingRulePayload }) =>
      menuService.createPricingRule(itemId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menuItems'] }),
  });
}

export function useDeletePricingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, ruleId }: { itemId: string; ruleId: string }) =>
      menuService.deletePricingRule(itemId, ruleId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menuItems'] }),
  });
}

export function useCreateAvailabilityWindow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, payload }: { itemId: string; payload: AvailabilityWindowPayload }) =>
      menuService.createAvailabilityWindow(itemId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menuItems'] }),
  });
}

export function useDeleteAvailabilityWindow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, windowId }: { itemId: string; windowId: string }) =>
      menuService.deleteAvailabilityWindow(itemId, windowId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menuItems'] }),
  });
}

export type { Menu };
