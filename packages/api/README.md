# Restaurant Management API

Backend API for the Restaurant Management System built with Express.js, TypeScript, and Prisma ORM.

## 🚀 Features

- **Multi-tenant Architecture** with tenant isolation
- **Role-Based Access Control** (Customer, Server, Kitchen, Manager, Admin)
- **JWT Authentication** with refresh tokens
- **PostgreSQL Database** with Prisma ORM
- **Redis Caching** for improved performance
- **Real-time Updates** with WebSocket support
- **Comprehensive Logging** with Winston

## 📦 Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL 15+
- **ORM**: Prisma
- **Cache**: Redis
- **Authentication**: JWT (jsonwebtoken)
- **Validation**: Joi
- **Logging**: Winston

## 🛠️ Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Redis 7+

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your database and Redis connections
```

3. Generate Prisma client:
```bash
npm run prisma:generate
```

4. Run database migrations:
```bash
npm run prisma:migrate
```

5. Seed the database (optional):
```bash
npm run prisma:seed
```

### Development

Start the development server:
```bash
npm run dev
```

The API will be available at `http://localhost:3001`

### Database Commands

```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Create a new migration
npm run prisma:migrate:dev

# Reset database
npm run prisma:reset

# Seed database
npm run prisma:seed

# Open Prisma Studio
npm run prisma:studio
```

## 📁 Project Structure

```
src/
├── services/          # Database, Redis, and other services
├── middleware/        # Express middleware (auth, validation, etc.)
├── routes/            # API route definitions
├── controllers/       # Request handlers
├── services/          # Business logic
├── utils/             # Helper functions
├── types/             # TypeScript type definitions
└── index.ts           # Application entry point
```

## 🔑 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - User logout

### Users
- `GET /api/users` - Get all users (admin only)
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user (admin only)

### Menus
- `GET /api/menus` - Get all menus
- `GET /api/menus/:id` - Get menu by ID
- `POST /api/menus` - Create menu (manager/admin)
- `PUT /api/menus/:id` - Update menu (manager/admin)
- `DELETE /api/menus/:id` - Delete menu (manager/admin)

### Orders
- `GET /api/orders` - Get orders
- `GET /api/orders/:id` - Get order by ID
- `POST /api/orders` - Create order
- `PUT /api/orders/:id/status` - Update order status

### Inventory
- `GET /api/inventory` - Get inventory items
- `POST /api/inventory` - Create inventory item (manager/admin)
- `PUT /api/inventory/:id` - Update inventory item
- `POST /api/inventory/:id/transaction` - Record inventory transaction

## 🔐 Authentication

The API uses JWT for authentication. Include the access token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## 🌐 Multi-Tenancy

All API requests must include the tenant identifier. This can be done via:
- Subdomain: `tenant-api.example.com`
- Header: `X-Tenant-ID: tenant-id`
- Query parameter: `?tenantId=tenant-id`

## 🧪 Testing

Run tests:
```bash
npm test
```

Run tests with coverage:
```bash
npm test -- --coverage
```

## 📊 Database Schema

The database includes the following main entities:
- **Tenants** - Multi-tenant organization
- **Users** - System users with roles
- **Menus** - Restaurant menus
- **Categories** - Menu categories
- **MenuItems** - Individual menu items
- **Orders** - Customer orders
- **OrderItems** - Items in an order
- **Tables** - Restaurant tables
- **InventoryItems** - Inventory tracking
- **Suppliers** - Inventory suppliers
- **Reviews** - Customer reviews
- **Payments** - Payment records

## 🚨 Error Handling

The API uses standard HTTP status codes and returns errors in the following format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  }
}
```

## 📝 License

MIT
