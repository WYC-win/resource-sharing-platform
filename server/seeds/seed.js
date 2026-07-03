/**
 * Database seed script
 * Creates initial admin account and default categories
 *
 * Usage: node seeds/seed.js
 *   or:  npm run seed
 */

const path = require('path');
const bcrypt = require('bcryptjs');

// Load env before anything else
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { getDb, queryAll, queryOne, execute } = require('../src/config/db');

async function seed() {
  console.log('🌱 Starting database seed...\n');
  await getDb();

  // Check if already seeded
  const adminExists = queryOne("SELECT COUNT(*) as count FROM users WHERE role = 'admin'");
  if (adminExists.count > 0) {
    console.log('⚠️  Admin account already exists, skipping user seed.');
  } else {
    console.log('📋 Creating default admin account...');
    const adminPassword = 'admin123456';
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    execute(
      `INSERT INTO users (username, password_hash, display_name, role)
       VALUES (?, ?, ?, 'admin')`,
      ['admin', passwordHash, '系统管理员']
    );

    console.log(`   ✅ Admin account created:`);
    console.log(`      Username: admin`);
    console.log(`      Password: ${adminPassword}`);
    console.log(`   ⚠️  Please change the password after first login!\n`);
  }

  // Seed default categories
  const categoryCount = queryOne('SELECT COUNT(*) as count FROM categories').count;
  if (categoryCount > 0) {
    console.log('⚠️  Categories already exist, skipping category seed.\n');
  } else {
    console.log('📋 Creating default categories...');
    const defaultCategories = [
      { name: '考试真题', description: '历年考试真题、模拟试卷', sort_order: 1 },
      { name: '复习资料', description: '复习题、练习册、知识总结', sort_order: 2 },
      { name: '其他资料', description: '课件、笔记、参考书等', sort_order: 3 },
    ];

    for (const cat of defaultCategories) {
      execute('INSERT INTO categories (name, description, sort_order) VALUES (?, ?, ?)',
        [cat.name, cat.description, cat.sort_order]);
      console.log(`   ✅ Created category: ${cat.name}`);
    }
    console.log('');
  }

  console.log('✅ Seed completed successfully!');
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
