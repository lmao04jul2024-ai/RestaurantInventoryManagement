# Database Setup Guide

This guide walks you through setting up the PostgreSQL database for the Restaurant Management System.

## Prerequisites

- PostgreSQL 15+
- Redis 7+
- Node.js 18+

## Quick Setup with Docker (Recommended)

The easiest way to set up the database is using Docker Compose from the project root:

```bash
# From project root
docker-compose up -d postgres redis

# Wait for services to be ready
sleep 10

# Then run database initialization
cd packages/api
./scripts/init-db.sh
```

## Manual Setup

### 1. Create PostgreSQL Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database and user
CREATE DATABASE restaurant_management;
CREATE USER restaurant WITH PASSWORD 'restaurant123';
GRANT ALL PRIVILEGES ON DATABASE restaurant_management TO restaurant;
\q
```

### 2. Configure Environment

Create `.env` file in the `packages/api` directory:

```env
DATABASE_URL=postgresql://restaurant:restaurant123@localhost:5432/restaurant_management
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d
PORT=3001
NODE_ENV=development
```

### 3. Install Dependencies

```bash
cd packages/api
npm install
```

### 4. Generate Prisma Client

```bash
npm run prisma:generate
```

### 5. Run Migrations

```bash
npm run prisma:migrate
```

### 6. Seed Database (Optional)

```bash
npm run prisma:seed
```

This creates demo data including:
- 1 tenant (Demo Restaurant)
- 2 users (admin and manager)
- 1 menu with 4 categories and 6 menu items
- 3 tables with QR codes
- 1 supplier
- 3 inventory items
- Feature flags

### 7. Verify Setup

Start the API server:

```bash
npm run dev
```

Visit `http://localhost:3001/health` to verify the API is running.

## Database Management Commands

### View Database with Prisma Studio

```bash
npm run prisma:studio
```

### Create New Migration

```bash
npm run prisma:migrate:dev
```

### Reset Database (WARNING: Deletes all data)

```bash
npm run prisma:reset
```

### Generate Prisma Client (after schema changes)

```bash
npm run prisma:generate
```

## Troubleshooting

### Connection Issues

If you can't connect to PostgreSQL:

1. Check if PostgreSQL is running:
```bash
pg_isready
```

2. Verify credentials in `.env` file

3. Check PostgreSQL logs:
```bash
# Docker
docker logs restaurant-db

# Local installation (location varies)
sudo tail -f /var/log/postgresql/postgresql-15-main.log
```

### Migration Errors

If migrations fail:

1. Check migration status:
```bash
npx prisma migrate status
```

2. Resolve conflicts:
```bash
npx prisma migrate resolve --applied "migration_name"
```

3. Reset if needed (WARNING: Deletes all data):
```bash
npm run prisma:reset
```

### Redis Connection Issues

If Redis connection fails:

1. Check if Redis is running:
```bash
redis-cli ping
```

2. Should return `PONG`

3. Check Redis logs:
```bash
# Docker
docker logs restaurant-redis
```

## Production Considerations

For production deployment:

1. **Use strong passwords** for database and Redis
2. **Set proper JWT_SECRET** - use a long random string
3. **Enable SSL** for database connections
4. **Use connection pooling** (Prisma handles this)
5. **Set up database backups**
6. **Monitor database performance**
7. **Use environment-specific configurations**

## Database Schema Overview

The database includes these main entities:

- **Tenant** - Multi-tenant organization
- **User** - System users with roles
- **Menu** - Restaurant menus
- **Category** - Menu categories
- **MenuItem** - Individual menu items
- **Order** - Customer orders
- **OrderItem** - Items in an order
- **Table** - Restaurant tables
- **InventoryItem** - Inventory tracking
- **Supplier** - Inventory suppliers
- **Review** - Customer reviews
- **Payment** - Payment records
- **FeatureFlag** - Feature toggles
- **ApiKey** - API authentication keys

## Multi-Tenancy

The database implements multi-tenancy through:
- `tenantId` foreign key on most tables
- Row-level security (can be enabled in PostgreSQL)
- Tenant isolation in API middleware

## Next Steps

After database setup:

1. Start the API server: `npm run dev`
2. Test API endpoints with Postman or curl
3. Set up the web and mobile clients
4. Configure authentication
5. Deploy to production

## Support

For database-related issues:
- Check Prisma documentation: https://www.prisma.io/docs
- PostgreSQL documentation: https://www.postgresql.org/docs/
- Open an issue in the project repository
