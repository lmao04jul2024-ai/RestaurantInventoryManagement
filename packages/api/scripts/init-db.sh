#!/bin/bash

# Database initialization script for Restaurant Management System

set -e

echo "🚀 Initializing Restaurant Management Database..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Copy .env.example to .env and configure it first."
    exit 1
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
until nc -z ${DATABASE_URL##*@} 5432; do
    sleep 1
done
echo "✅ PostgreSQL is ready!"

# Wait for Redis to be ready
echo "⏳ Waiting for Redis to be ready..."
until nc -z ${REDIS_URL##*@} 6379; do
    sleep 1
done
echo "✅ Redis is ready!"

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Generate Prisma Client
echo "🔧 Generating Prisma Client..."
npm run prisma:generate

# Run migrations
echo "🗄️  Running database migrations..."
npm run prisma:migrate

# Seed database
echo "🌱 Seeding database with demo data..."
npm run prisma:seed

echo "🎉 Database initialization completed successfully!"
echo ""
echo "📋 Demo Credentials:"
echo "   Admin: admin@demo.com / admin123"
echo "   Manager: manager@demo.com / admin123"
echo ""
echo "🚀 Start the API server with: npm run dev"
