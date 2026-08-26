# Core Platform - The Cross-Platform Foundation 🏛️

## 📋 Overview
The **Core Platform** is the heart of your cross-platform restaurant system. It provides a unified foundation that seamlessly delivers experiences on both **native mobile apps** and **web browsers** without code duplication.

## 🧱 Platform Strategy

### The "Unified Experience" Approach
```
┌─────────────────────────────────────────────────────┐
│              Unified API Layer                       │
│              (Backend Services)                      │
└─────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
┌───────▼─────────┐  ┌────▼──────┐  ┌──────▼────────┐
│   Mobile App    │  │   Web PWA │  │  Admin Panel   │
│  (React Native) │  │ (Next.js) │  │   (React)      │
└─────────────────┘  └───────────┘  └────────────────┘
```

### Technology Choices
| Layer | Mobile | Web | Admin |
|-------|--------|-----|-------|
| **Framework** | React Native / Expo | Next.js PWA | React |
| **State** | Redux/Zustand | Redux Toolkit | Zustand |
| **Styling** | Tailwind | Tailwind + CSS Modules | Tailwind |
| **Routing** | React Navigation | React Router | React Router |

### Cross-Platform Magic
- **Service Workers**: Cache assets for offline-first PWA experience
- **Adaptive UIs**: Components that resize and reflow automatically
- **Touch vs Click**: Unified interaction model with platform-specific gestures
- **Responsive Images**: Smart loading for different screen densities

---

## 🎯 Core Modules

### 1. **Base Components**
Reusable UI primitives that work identically across platforms:
- `Card`, `Button`, `Input`, `Modal`, `Avatar`
- Platform-aware variants: `Button.Touch` vs `Button.Click`
- **Design Tokens**: Color, spacing, typography system

### 2. **Navigation System**
Unified routing that adapts to each platform:
- **Mobile**: Bottom tabs, drawer navigation, gesture swipes
- **Web**: Multi-level routing, breadcrumbs, hover states
- **Shared**: Breadcrumbs, back buttons, search filters

### 3. **Data Fetching Layer**
Smart data loading with platform optimization:
- **Mobile**: Optimistic updates, background sync
- **Web**: Prefetching, progressive hydration
- **Shared**: GraphQL or REST with pagination

### 4. **State Management**
Unified state that syncs across devices:
- **Redux Toolkit**: Normalized state for complex data
- **Context API**: For simple, nested data
- **Persisted State**: localStorage for offline resilience

---

## 📐 Architecture Patterns

### Feature-Sliced Architecture
```
┌─────────────────────────────────────────────────────┐
│                    Shared Layer                      │
│  (Base components, utilities, hooks)                 │
└─────────────────────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
┌───────▼─────────┐  ┌─▼────────┐  ┌─▼──────────┐
│    Feature A    │  │ Feature B│  │ Feature C   │
│  (e.g., Menu)   │  │(e.g., Cart)│ │(e.g., Cart) │
└─────────────────┘  └──────────┘  └─────────────┘
```

### Layout System
- **Mobile**: Stacked, bottom navigation, 375px wide
- **Tablet**: 2-column grid, side navigation
- **Desktop**: 4-column grid, hover interactions

### Responsive Breakpoints
```css
/* Mobile First Approach */
--breakpoint-sm: 640px;   /* Tablet */
--breakpoint-md: 768px;   /* Small Desktop */
--breakpoint-lg: 1024px;  /* Large Desktop */
```

---

## 🔄 Platform Synchronization

### Real-Time Sync Strategy
- **WebSockets**: Live order updates across devices
- **Event Bus**: Internal messaging for state changes
- **Local Storage**: Offline-first with background sync

### Offline-First Design
1. **Cache First**: Service worker caches API responses
2. **Queue Writes**: Store mutations locally, sync later
3. **Conflict Resolution**: Last-write-wins or timestamp-based

---

## 🎨 Design System

### Color Palette (Client-Configurable)
```
Primary:  #2563EB (Blue)
Secondary: #10B981 (Emerald)
Neutral:  #F1F5F9 (Slate)
Dark:     #0F172A
```

### Typography Scale
```
H1:   28px / 32px
H2:   24px / 28px
H3:   20px / 24px
Body: 16px / 24px
Caption: 12px / 16px
```

### Spacing Grid (8px Base)
```
xs: 4px
sm: 8px
md: 16px
lg: 24px
xl: 32px
```

---

## 📊 Performance Targets

| Metric | Mobile | Web |
|--------|--------|-----|
| **First Paint** | < 1.5s | < 1.2s |
| **Scroll 60fps** | 100% | 95%+ |
| **Tap Response** | < 100ms | < 80ms |
| **Memory Usage** | < 150MB | < 80MB |

---

## 🔧 Implementation Checklist

- [ ] Set up **Expo/React Native** for mobile
- [ ] Configure **Next.js** for web PWA
- [ ] Define **Shared Component Library**
- [ ] Implement **Design Tokens** system
- [ ] Build **State Management** layer
- [ ] Create **Navigation** abstraction
- [ ] Setup **Service Workers** for PWA
- [ ] Implement **Platform Detection** hooks

---

## 🚀 Getting Started

### For Mobile Developers
```bash
# Install shared dependencies
npm install shared-ui @state-management

# Mobile app entry
npx expo start
```

### For Web Developers
```bash
# Web entry point
npm run build:web
npm run dev:web
```

---

*This core platform serves as the foundation for all cross-platform features.*