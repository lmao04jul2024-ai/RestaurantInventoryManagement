# Customization Engine - Multi-Client Branding 🎨

## 📋 Overview
A powerful theming and configuration system that allows the same codebase to serve multiple restaurant clients with unique branding, layouts, and features.

## 🎯 Customization Layers

### 1. **Visual Branding**
- **Color Palette**: Primary, secondary, accent colors
- **Typography**: Font families, sizes, weights
- **Logo & Assets**: Header logos, favicons, icons
- **Imagery**: Hero images, background patterns

### 2. **Layout Configuration**
- **Navigation Style**: Bottom tabs, side drawer, top nav
- **Grid System**: Number of columns, spacing
- **Component Density**: Compact, comfortable, spacious
- **Mobile Layout**: Stacked vs side-by-side

### 3. **Feature Toggles**
- **Module Activation**: Enable/disable specific features
- **Payment Methods**: Which payment options to show
- **Order Types**: Dine-in, takeout, delivery
- **Review System**: On/off, moderation settings

### 4. **Business Rules**
- **Tax Rates**: Regional tax configurations
- **Service Charges**: Automatic gratuity rules
- **Opening Hours**: Operating schedules
- **Table Management**: Reservation policies

---

## 🎨 Theme System Architecture

### Theme Tokens
```json
{
  "colors": {
    "primary": "#2563EB",
    "secondary": "#10B981",
    "background": "#FFFFFF",
    "surface": "#F1F5F9",
    "text": "#0F172A"
  },
  "typography": {
    "fontFamily": "Inter, sans-serif",
    "headingSize": "28px",
    "bodySize": "16px"
  },
  "spacing": {
    "base": "8px",
    "compact": "4px",
    "spacious": "12px"
  }
}
```

### Theme Application
- **CSS Variables**: Runtime theme switching
- **Component Props**: Pass theme tokens to components
- **Style Overrides**: Client-specific CSS modules
- **Dark Mode**: Automatic light/dark theme detection

---

## 🔧 Configuration Management

### Client Configuration
```json
{
  "clientId": "client_001",
  "name": "Mario's Italian Kitchen",
  "theme": "italian-theme",
  "features": {
    "qrOrdering": true,
    "tableManagement": true,
    "reviews": true,
    "loyalty": false
  },
  "businessRules": {
    "taxRate": 0.08,
    "serviceCharge": 0.15,
    "currency": "USD",
    "timezone": "America/New_York"
  },
  "branding": {
    "logoUrl": "https://cdn.example.com/marios/logo.png",
    "primaryColor": "#DC2626",
    "fontFamily": "Playfair Display"
  }
}
```

### Environment-Specific Configs
- **Development**: Debug features enabled
- **Staging**: Production-like settings
- **Production**: Optimized configuration

---

## 🎯 Multi-Tenancy Strategy

### Database Design
- **Tenant ID**: Every record tagged with client ID
- **Row-Level Security**: Automatic filtering by tenant
- **Shared Resources**: Common data (countries, currencies)
- **Isolated Data**: Client-specific data separation

### API Design
- **Tenant Header**: `X-Tenant-ID` in all requests
- **Subdomain Routing**: `client.app.com`
- **Path-Based**: `/clients/client-id/...`
- **JWT Claims**: Tenant ID in authentication token

---

## 🔄 Theme Inheritance

### Base Theme
```
Base Theme (Default)
    ├── Light Variant
    ├── Dark Variant
    └── Client Themes
        ├── Italian Restaurant Theme
        ├── Sushi Bar Theme
        └── Café Theme
```

### Theme Override System
```css
/* Base styles */
.button {
  background-color: var(--primary);
  border-radius: var(--radius-md);
}

/* Client override */
.client-italian .button {
  background-color: #DC2626;
  border-radius: 8px;
}
```

---

## 📊 Configuration UI

### Admin Dashboard
- **Theme Editor**: Visual theme builder
- **Feature Manager**: Toggle features on/off
- **Preview Mode**: See changes before publishing
- **Version Control**: Track configuration changes

### Client Self-Service
- **Branding Upload**: Logo, colors, fonts
- **Menu Customization**: Layout, categories
- **Business Hours**: Set operating times
- **Tax Configuration**: Regional settings

---

## 🛡️ Security & Governance

### Access Control
- **Role-Based**: Only admins can change themes
- **Audit Trail**: Track all configuration changes
- **Approval Workflow**: Changes require approval
- **Rollback**: Revert to previous versions

### Data Isolation
- **Tenant Separation**: No data leakage between clients
- **Encryption**: Sensitive data encrypted at rest
- **Backup Strategy**: Regular configuration backups
- **Disaster Recovery**: Restore configurations quickly

---

## 🚀 Implementation Checklist

- [ ] Theme token system
- [ ] Configuration storage
- [ ] Multi-tenancy setup
- [ ] Theme inheritance
- [ ] Admin dashboard
- [ ] Client self-service
- [ ] Audit logging
- [ ] Rollback mechanism
- [ ] Testing suite
- [ ] Documentation

---

*The customization engine enables true white-label solutions for multiple clients.*