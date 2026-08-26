# Data Models - Core Entities 🗂️

## 📋 Overview
The foundational data structures that power the cross-platform restaurant management system. These models support inventory, ordering, and multi-client operations.

## 🏗️ Core Entity Relationships

```
┌─────────────────┐
│   Restaurant    │ (Multi-tenant root)
└────────┬────────┘
         │
    ┌────┴────────────────────────────────────┐
    │                                         │
┌───▼──────────┐                        ┌────▼──────────┐
│    Menu      │                        │    Tables     │
│  - Categories│                        │  - Capacity   │
│  - Items     │                        │  - Status     │
└───┬──────────┘                        └────┬──────────┘
    │                                         │
    │  ┌─────────────────┐                   │
    │  │   Ingredients   │                   │
    │  │  - Stock Levels │                   │
    │  │  - BOM          │                   │
    │  └─────────────────┘                   │
    │                                         │
┌───▼──────────┐                        ┌────▼──────────┐
│    Orders    │◄───────────────────────│  Reservations │
│  - Items     │                        │  - Date/Time  │
│  - Status    │                        │  - Party Size │
└───┬──────────┘                        └───────────────┘
    │
    │  ┌─────────────────┐
    │  │    Reviews      │
    │  │  - Rating       │
    │  │  - Comments     │
    │  └─────────────────┘
    │
┌───▼──────────┐
│    Users     │ (Customers, Staff, Managers)
│  - Roles     │
│  - Permissions
└──────────────┘
```

## 📊 Key Entities

### 1. Restaurant (Tenant Root)
- **id**: UUID
- **name**: Restaurant name
- **slug**: Unique URL identifier
- **address**: Full address object
- **operatingHours**: Daily schedules
- **timezone**: Time zone for operations
- **currency**: Default currency
- **taxRate**: Sales tax percentage
- **isActive**: Active status

### 2. Category (Menu Organization)
- **id**: UUID
- **restaurantId**: Parent restaurant
- **name**: Category name (Appetizers, Mains, etc.)
- **displayOrder**: Sort order
- **isActive**: Active status

### 3. Ingredient (Raw Materials)
- **id**: UUID
- **restaurantId**: Parent restaurant
- **name**: Ingredient name
- **category**: Type (Vegetable, Protein, etc.)
- **unit**: Measurement unit (kg, pcs, g)
- **minLevel**: Reorder threshold
- **currentStock**: Current quantity
- **averageCost**: Cost per unit
- **isActive**: Active status

### 4. MenuItem (Menu Items)
- **id**: UUID
- **restaurantId**: Parent restaurant
- **categoryId**: Menu category
- **name**: Item name
- **description**: Item description
- **basePrice**: Cost to make
- **displayPrice**: Customer price
- **prepTime**: Minutes to prepare
- **dietaryTags**: ["Vegetarian", "Gluten-Free"]
- **isAvailable**: Can be ordered
- **isPopular**: Featured item

### 5. IngredientUsage (Bill of Materials)
- **id**: UUID
- **menuItemId**: Associated menu item
- **ingredientId**: Used ingredient
- **quantity**: Amount needed
- **unit**: Unit of measurement
- **portionMultiplier**: Serving size multiplier

### 6. StockLevel (Inventory Snapshot)
- **id**: UUID
- **ingredientId**: Associated ingredient
- **restaurantId**: Parent restaurant
- **quantity**: Current stock
- **unit**: Measurement unit
- **lastUpdated**: Last update time
- **source**: How updated (manual, scanner, etc.)

### 7. Table (Seating)
- **id**: UUID
- **restaurantId**: Parent restaurant
- **number**: Table identifier
- **capacity**: Seat count
- **status**: available/occupied/reserved
- **section**: Area (front, back, window)
- **qrCode**: Unique QR code for table
- **isActive**: Active status

### 8. Order (Customer Orders)
- **id**: UUID
- **restaurantId**: Parent restaurant
- **customerId**: Customer (optional)
- **tableId**: Associated table (optional)
- **type**: dine-in/takeout/delivery
- **status**: pending/confirmed/preparing/ready/served
- **orderNumber**: Human-readable number
- **items**: Array of OrderItem
- **subtotal**: Before tax
- **tax**: Tax amount
- **totalAmount**: Final amount
- **paymentStatus**: pending/paid/refunded
- **estimatedReady**: Predicted ready time
- **createdAt**: Order timestamp

### 9. OrderItem (Individual Items)
- **id**: UUID
- **orderId**: Parent order
- **menuItemId**: Menu item
- **quantity**: Number ordered
- **unitPrice**: Price per item
- **modifiers**: Customizations
- **specialInstructions**: Kitchen notes
- **status**: pending/preparing/ready

### 10. Reservation (Table Bookings)
- **id**: UUID
- **restaurantId**: Parent restaurant
- **tableId**: Reserved table (optional)
- **customerId**: Customer (optional)
- **guestName**: Reservation name
- **guestPhone**: Contact phone
- **partySize**: Number of guests
- **date**: Reservation date
- **time**: Reservation time
- **status**: confirmed/checked-in/cancelled
- **notes**: Special requests

### 11. Review (Customer Feedback)
- **id**: UUID
- **restaurantId**: Parent restaurant
- **orderId**: Associated order
- **customerId**: Reviewer
- **rating**: Overall rating (1-5)
- **foodRating**: Food quality rating
- **serviceRating**: Service rating
- **comment**: Written feedback
- **photos**: Array of photo URLs
- **isPublic**: Visible to others
- **isVerified**: From actual order

### 12. User (All System Users)
- **id**: UUID
- **email**: User email
- **name**: Full name
- **phone**: Contact phone
- **role**: customer/server/kitchen/manager/admin
- **permissions**: Array of permission strings
- **restaurants**: Array of accessible restaurant IDs
- **preferences**: Theme, notifications, language
- **lastLogin**: Last login timestamp
- **isActive**: Active status

---

*These data models form the backbone of the entire system, supporting cross-platform operations and multi-client customization.*