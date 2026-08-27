// Shared types and utilities for Restaurant Management System

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum UserRole {
  CUSTOMER = 'customer',
  SERVER = 'server',
  KITCHEN = 'kitchen',
  MANAGER = 'manager',
  ADMIN = 'admin'
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  theme: ThemeConfig;
  features: FeatureFlags;
  createdAt: Date;
  updatedAt: Date;
}

export interface ThemeConfig {
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  logoUrl?: string;
}

export interface FeatureFlags {
  customerOrdering: boolean;
  qrIntegration: boolean;
  qappRConnect: boolean;
  loyaltyProgram: boolean;
  advancedAnalytics: boolean;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  categoryId: string;
  imageUrl?: string;
  available: boolean;
  preparationTime?: number;
  nutritionalInfo?: NutritionalInfo;
}

export interface NutritionalInfo {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Order {
  id: string;
  customerId: string;
  tenantId: string;
  items: OrderItem[];
  status: OrderStatus;
  totalAmount: number;
  tableNumber?: string;
  specialRequests?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PREPARING = 'preparing',
  READY = 'ready',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export interface OrderItem {
  menuItemId: string;
  quantity: number;
  unitPrice: number;
  specialInstructions?: string;
}

// ── Design tokens (see ./tokens.ts — single source of truth for all platforms) ──
export * from './tokens';

