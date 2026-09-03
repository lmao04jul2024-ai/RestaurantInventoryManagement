import { PrismaClient, UserRole, OrderStatus, PaymentStatus, InventoryUnit } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create demo tenant
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Demo Restaurant',
      slug: 'demo-restaurant',
      email: 'demo@restaurant.com',
      phone: '+1234567890',
      address: '123 Restaurant St, Food City',
      theme: {
        primaryColor: '#2563eb',
        secondaryColor: '#3b82f6',
        fontFamily: 'Inter'
      },
      features: {
        customer_ordering: true,
        qr_integration: true,
        table_management: true,
        qappR_connect: false,
        loyalty_program: true,
        advanced_analytics: false,
        customer_reviews: true
      }
    }
  });

  console.log(`✅ Created tenant: ${tenant.name}`);

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.create({
    data: {
      email: 'admin@demo.com',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: UserRole.ADMIN,
      tenantId: tenant.id,
      emailVerified: true
    }
  });

  console.log(`✅ Created admin user: ${admin.email}`);

  // Create manager user
  const manager = await prisma.user.create({
    data: {
      email: 'manager@demo.com',
      password: hashedPassword,
      firstName: 'Manager',
      lastName: 'User',
      role: UserRole.MANAGER,
      tenantId: tenant.id,
      emailVerified: true
    }
  });

  console.log(`✅ Created manager user: ${manager.email}`);

  // Create menu
  const menu = await prisma.menu.create({
    data: {
      name: 'Main Menu',
      description: 'Our delicious offerings',
      tenantId: tenant.id
    }
  });

  console.log(`✅ Created menu: ${menu.name}`);

  // Create categories
  const categories = await Promise.all([
    prisma.category.create({
      data: {
        name: 'Appetizers',
        description: 'Start your meal right',
        icon: '🥗',
        sortOrder: 1,
        menuId: menu.id
      }
    }),
    prisma.category.create({
      data: {
        name: 'Main Course',
        description: 'Hearty dishes',
        icon: '🍽️',
        sortOrder: 2,
        menuId: menu.id
      }
    }),
    prisma.category.create({
      data: {
        name: 'Desserts',
        description: 'Sweet treats',
        icon: '🍰',
        sortOrder: 3,
        menuId: menu.id
      }
    }),
    prisma.category.create({
      data: {
        name: 'Beverages',
        description: 'Drinks and refreshments',
        icon: '🥤',
        sortOrder: 4,
        menuId: menu.id
      }
    })
  ]);

  console.log(`✅ Created ${categories.length} categories`);

  // Create menu items
  const menuItems = await Promise.all([
    // Appetizers
    prisma.menuItem.create({
      data: {
        name: 'Caesar Salad',
        description: 'Fresh romaine lettuce with parmesan cheese and croutons',
        price: 12.99,
        categoryId: categories[0].id,
        preparationTime: 10,
        calories: 350,
        isVegetarian: true,
        protein: 8,
        carbs: 15,
        fat: 22
      }
    }),
    prisma.menuItem.create({
      data: {
        name: 'Garlic Bread',
        description: 'Toasted bread with garlic butter and herbs',
        price: 6.99,
        categoryId: categories[0].id,
        preparationTime: 5,
        calories: 200,
        isVegetarian: true,
        protein: 4,
        carbs: 30,
        fat: 8
      }
    }),
    // Main Course
    prisma.menuItem.create({
      data: {
        name: 'Grilled Salmon',
        description: 'Fresh Atlantic salmon with lemon herb butter',
        price: 24.99,
        categoryId: categories[1].id,
        preparationTime: 20,
        calories: 450,
        protein: 40,
        carbs: 5,
        fat: 25
      }
    }),
    prisma.menuItem.create({
      data: {
        name: 'Ribeye Steak',
        description: '12oz prime ribeye with your choice of sides',
        price: 34.99,
        categoryId: categories[1].id,
        preparationTime: 25,
        calories: 650,
        protein: 50,
        carbs: 2,
        fat: 45
      }
    }),
    // Desserts
    prisma.menuItem.create({
      data: {
        name: 'Chocolate Lava Cake',
        description: 'Warm chocolate cake with molten center',
        price: 9.99,
        categoryId: categories[2].id,
        preparationTime: 15,
        calories: 400,
        isVegetarian: true,
        protein: 5,
        carbs: 50,
        fat: 20
      }
    }),
    // Beverages
    prisma.menuItem.create({
      data: {
        name: 'Fresh Lemonade',
        description: 'Freshly squeezed lemonade with mint',
        price: 4.99,
        categoryId: categories[3].id,
        preparationTime: 3,
        calories: 120,
        isVegetarian: true,
        isVegan: true,
        protein: 0,
        carbs: 32,
        fat: 0
      }
    })
  ]);

  console.log(`✅ Created ${menuItems.length} menu items`);

  // Create tables
  const tables = await Promise.all([
    prisma.table.create({
      data: {
        name: 'Table 1',
        number: '1',
        capacity: 4,
        location: 'Front',
        qrCode: `table-${tenant.id}-1`,
        tenantId: tenant.id
      }
    }),
    prisma.table.create({
      data: {
        name: 'Table 2',
        number: '2',
        capacity: 6,
        location: 'Front',
        qrCode: `table-${tenant.id}-2`,
        tenantId: tenant.id
      }
    }),
    prisma.table.create({
      data: {
        name: 'Table 3',
        number: '3',
        capacity: 2,
        location: 'Window',
        qrCode: `table-${tenant.id}-3`,
        tenantId: tenant.id
      }
    })
  ]);

  console.log(`✅ Created ${tables.length} tables`);

  // Create supplier
  const supplier = await prisma.supplier.create({
    data: {
      name: 'Fresh Foods Supply Co.',
      contactName: 'John Supplier',
      email: 'john@freshfoods.com',
      phone: '+1987654321',
      address: '456 Supply Ave, Vendor City',
      tenantId: tenant.id
    }
  });

  console.log(`✅ Created supplier: ${supplier.name}`);

  // Create inventory items
  const inventoryItems = await Promise.all([
    prisma.inventoryItem.create({
      data: {
        name: 'Salmon Fillet',
        sku: 'FISH-SAL-001',
        currentStock: 50,
        minStock: 10,
        maxStock: 100,
        unit: InventoryUnit.KG,
        costPrice: 15.00,
        sellingPrice: 25.00,
        supplierId: supplier.id,
        tenantId: tenant.id
      }
    }),
    prisma.inventoryItem.create({
      data: {
        name: 'Ribeye Steak',
        sku: 'MEAT-RIB-001',
        currentStock: 30,
        minStock: 5,
        maxStock: 50,
        unit: InventoryUnit.KG,
        costPrice: 20.00,
        sellingPrice: 35.00,
        supplierId: supplier.id,
        tenantId: tenant.id
      }
    }),
    prisma.inventoryItem.create({
      data: {
        name: 'Romaine Lettuce',
        sku: 'VEG-LET-001',
        currentStock: 100,
        minStock: 20,
        maxStock: 200,
        unit: InventoryUnit.UNIT,
        costPrice: 2.00,
        sellingPrice: 4.00,
        tenantId: tenant.id
      }
    })
  ]);

  console.log(`✅ Created ${inventoryItems.length} inventory items`);

  // Create feature flags
  await prisma.featureFlag.createMany({
    data: [
      { name: 'customer_ordering', description: 'Enable customer self-ordering', isEnabled: true },
      { name: 'qr_integration', description: 'Enable QR code ordering', isEnabled: true },
      { name: 'table_management', description: 'Enable table management', isEnabled: true },
      { name: 'loyalty_program', description: 'Enable customer loyalty points', isEnabled: true },
      { name: 'customer_reviews', description: 'Enable customers to rate and review completed orders', isEnabled: true },
      { name: 'advanced_analytics', description: 'Enable advanced analytics dashboard', isEnabled: false }
    ]
  });

  console.log('✅ Created feature flags');

  console.log('🎉 Database seeding completed successfully!');
  console.log('\n📋 Demo Credentials:');
  console.log('   Admin: admin@demo.com / admin123');
  console.log('   Manager: manager@demo.com / admin123');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
