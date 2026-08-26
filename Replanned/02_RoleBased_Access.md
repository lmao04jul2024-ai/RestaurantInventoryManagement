# Role-Based Access Control (RBAC) - The Login Flow 🔐

## 📋 Overview
A sophisticated **login and permission system** that tailors the user experience based on who's logged in.

## 👥 User Roles

### 1. **Customer** (Guest/Logged-In)
*The diner browsing the menu and placing orders*
- **View Menu**: Full catalog with filters
- **Place Orders**: Add to cart, checkout
- **View Order Status**: Real-time tracking
- **Leave Reviews**: Rate and comment
- **Screens**: Home, Menu, Cart, Order Tracking, Profile

### 2. **Server/Waiter**
*The front-of-house team taking orders and managing tables*
- **Table Management**: Check-in/out, reservations
- **Take Orders**: Add modifiers, split bills
- **View Kitchen Status**: See prep progress
- **Screens**: Table View, Order Drawer, Kitchen Queue

### 3. **Kitchen Staff**
*The back-of-house preparing and updating orders*
- **View Orders**: Incoming orders by prep time
- **Update Status**: Confirm, complete, modify
- **Voice Notes**: Quick annotations
- **Screens**: KDS, Order List, Prep Tracker

### 4. **Manager**
*The oversight role for inventory, staff, and performance*
- **Dashboard**: KPIs, trends, heatmaps
- **Staff Management**: Scheduling, permissions
- **Inventory Oversight**: Stock levels, alerts
- **Screens**: Dashboard, Reports, Menu Editor

---

## 🔑 Login Flow Design

### 1. **Guest Experience** (No Login)
- Browse menu, view featured items
- Order with email capture
- Track order with order #

### 2. **Quick Login** (Social/Email)
- **Email/Password**: Classic, reliable
- **Social Login**: Google, Apple, Facebook
- **Biometric**: Touch ID, Face ID

### 3. **Role Switching** (For Staff)
- Quick role toggle for multi-role staff
- "Server Mode" for quick order entry

---

## 📊 Permission Matrix

| Feature      | Customer   | Server   | Kitchen  | Manager  |
|--------------|------------|----------|----------|----------|
| View Menu    | ✅ All     | ✅ Avail | ✅ Avail | ✅ All   |
| Add Modifiers| ✅ Yes     | ✅ Yes   | ✅ Yes   | ✅ Edit  |
| Table Mgmt   | ✅ Own     | ✅ All   | ✅ View  | ✅ All   |

---

## 🗂️ Data Model

### User Entity
```typescript
interface User {
  id: string;
  email: string;
  name: string;
  role: 'customer' | 'server' | 'kitchen' | 'manager';
  permissions: string[];
  preferences: {
    theme: 'light' | 'dark' | 'auto';
    notifications: boolean;
  };
}
```

---