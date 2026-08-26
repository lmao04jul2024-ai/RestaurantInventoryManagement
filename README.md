# Restaurant Management System

A cross-platform restaurant inventory management and ordering system built with modern technologies.

## 🚀 Features

- **Cross-Platform**: Works as mobile app (React Native) and web app (Next.js PWA)
- **Highly Customizable**: Theme engine and feature flags for multi-client support
- **Modular Architecture**: Add/remove features based on client needs
- **Role-Based Access**: Customer, Server, Kitchen Staff, Manager, Admin
- **QR Integration**: Scan to open mobile app or web app
- **Real-time Updates**: Order tracking and notifications
- **Multi-Tenant**: Support for multiple restaurants/clients

## 🛠️ Tech Stack

- **Frontend Web**: Next.js 14+ with TypeScript
- **Mobile**: React Native with TypeScript
- **Backend**: Node.js with Express/Fastify
- **Database**: PostgreSQL with Prisma ORM
- **Caching**: Redis
- **Styling**: Tailwind CSS
- **State Management**: Zustand / React Query
- **Authentication**: JWT with refresh tokens

## 📦 Project Structure

```
restaurant-management-system/
├── packages/
│   ├── api/           # Backend API
│   ├── web/           # Next.js web app
│   ├── mobile/        # React Native mobile app
│   └── shared/        # Shared types and utilities
├── docker-compose.yml # Development environment
├── Dockerfile         # Production builds
└── tasks/             # Implementation tasks
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm 9+
- Docker & Docker Compose (for containerized development)
- PostgreSQL 15+ (for local development without Docker)
- Redis 7+ (for local development without Docker)

### Quick Start with Docker

1. Clone the repository:
```bash
git clone <repository-url>
cd restaurant-management-system
```

2. Start all services:
```bash
docker-compose up -d
```

3. Access the applications:
- Web App: http://localhost:3000
- API: http://localhost:3001
- PostgreSQL: localhost:5432
- Redis: localhost:6379

### Local Development (without Docker)

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your local database and Redis connections
```

3. Start PostgreSQL and Redis services

4. Run database migrations:
```bash
npm run migrate --workspace=@restaurant/api
```

5. Start development servers:
```bash
# Terminal 1: API
npm run dev --workspace=@restaurant/api

# Terminal 2: Web
npm run dev --workspace=@restaurant/web

# Terminal 3: Mobile (requires React Native environment)
cd packages/mobile
npm start
```

## 📋 Implementation Progress

See [tasks/00_PROJECT_TASKS.md](./tasks/00_PROJECT_TASKS.md) for detailed task breakdown.

### Phase 1: Foundation & Core Infrastructure (Weeks 1-6) ✅ IN PROGRESS
- [x] Project setup and monorepo structure
- [x] TypeScript configuration
- [x] ESLint and Prettier setup
- [x] Docker configuration
- [ ] Database schema and migrations
- [ ] Authentication and RBAC
- [ ] Basic CRUD operations

### Phase 2: Core Features & Integrations (Weeks 7-12)
### Phase 3: Customization & Multi-Tenancy (Weeks 13-18)
### Phase 4: Advanced Features & Optimization (Weeks 19-24)

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests for specific package
npm test --workspace=@restaurant/api
npm test --workspace=@restaurant/web
```

## 📝 Documentation

- [Project Plan](./Replanned/README.md) - Comprehensive project documentation
- [API Documentation](./packages/api/README.md) - API endpoints and usage
- [Web App Documentation](./packages/web/README.md) - Frontend setup and components
- [Mobile App Documentation](./packages/mobile/README.md) - Mobile setup and navigation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 📞 Support

For support, email support@restaurant-management.com or open an issue in the repository.
