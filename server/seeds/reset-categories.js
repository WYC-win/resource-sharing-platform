/**
 * Quick script to reset categories
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const config = require(path.resolve(__dirname, '../src/config/index'));

const fs = require('fs');

async function reset() {
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();

  // Load existing database
  const buffer = fs.readFileSync(config.db.path);
  const db = new SQL.Database(buffer);

  // Delete all categories
  db.run('DELETE FROM categories');

  // Re-insert proper categories
  const insert = db.prepare('INSERT INTO categories (name, description, sort_order) VALUES (?, ?, ?)');
  insert.run(['考试真题', '历年考试真题、模拟试卷', 1]);
  insert.run(['复习资料', '复习题、练习册、知识总结', 2]);
  insert.run(['其他资料', '课件、笔记、参考书等', 3]);

  // Save back to disk
  const data = db.export();
  const buffer2 = Buffer.from(data);
  fs.writeFileSync(config.db.path, buffer2);

  // Verify
  const newDb = new SQL.Database(fs.readFileSync(config.db.path));
  const result = newDb.exec('SELECT id, name, sort_order FROM categories ORDER BY sort_order');
  console.log('Categories updated:');
  if (result.length > 0) {
    result[0].values.forEach(row => console.log(`  [${row[0]}] ${row[1]} (order:${row[2]})`));
  }
  newDb.close();
  db.close();
  console.log('Done!');
}

reset().catch(e => { console.error(e); process.exit(1); });
