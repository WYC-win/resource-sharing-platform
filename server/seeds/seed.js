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

  // Seed default announcement
  const announcementCount = queryOne('SELECT COUNT(*) as count FROM announcements').count;
  if (announcementCount > 0) {
    console.log('⚠️  Announcements already exist, skipping announcement seed.\n');
  } else {
    console.log('📋 Creating default announcement...');
    const admin = queryOne("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    if (admin) {
      execute(
        `INSERT INTO announcements (title, content, status, is_pinned, created_by, published_at)
         VALUES (?, ?, 'published', 1, ?, datetime('now', 'localtime'))`,
        ['欢迎使用北地书阁', '这里是北地书阁 —— 中国地质大学（北京）的学习资源共享平台。\n\n请同学们遵守使用规范，仅用于校内学习交流。如有问题请联系管理员。', admin.id]
      );
      console.log('   ✅ Created welcome announcement.\n');
    }
  }

  console.log('✅ Seed completed successfully!');
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
