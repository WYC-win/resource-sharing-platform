/**
 * Batch upload script for 高等数学（上）
 * Uploads all files from the organized folder to the API
 */

const path = require('path');
const fs = require('fs');
const http = require('http');

const BASE_DIR = path.resolve('C:/Users/WYC/Desktop/试卷总结/高等数学（上）');
const COURSE_ID = 7;   // 高等数学（上）
const CATEGORY_TRUE = 8;   // 考试真题
const CATEGORY_REVIEW = 9; // 复习资料

let TOKEN = '';

// Login to get admin token
function login() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ username: 'admin', password: 'admin123456' });
    const req = http.request({
      hostname: 'localhost', port: 3000, method: 'POST', path: '/api/v1/auth/login',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        const r = JSON.parse(body);
        TOKEN = r.data.accessToken;
        console.log('✅ Login success:', r.data.user.username);
        resolve();
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Upload a single file
function uploadFile(filePath, title, categoryId) {
  return new Promise((resolve, reject) => {
    // Read file
    const fileBuffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();

    // Build multipart form-data manually
    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);

    let bodyParts = [];

    // title field
    bodyParts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="title"\r\n\r\n${title}\r\n`
    ));

    // course_id field
    bodyParts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="course_id"\r\n\r\n${COURSE_ID}\r\n`
    ));

    // category_id field
    bodyParts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="category_id"\r\n\r\n${categoryId}\r\n`
    ));

    // file field
    bodyParts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: application/pdf\r\n\r\n`
    ));
    bodyParts.push(fileBuffer);
    bodyParts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

    const body = Buffer.concat(bodyParts);

    const req = http.request({
      hostname: 'localhost', port: 3000, method: 'POST', path: '/api/v1/resources',
      headers: {
        'Authorization': 'Bearer ' + TOKEN,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      }
    }, res => {
      let response = '';
      res.on('data', c => response += c);
      res.on('end', () => {
        try {
          const r = JSON.parse(response);
          if (r.code === 201) {
            console.log(`  ✅ ${title}`);
          } else {
            console.log(`  ❌ ${title}: ${r.message}`);
          }
        } catch {
          console.log(`  ❌ ${title}: Upload failed`);
        }
        resolve();
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  await login();

  // Scan files
  const trueDir = path.join(BASE_DIR, '真题');
  const reviewDir = path.join(BASE_DIR, '复习资料');

  const trueFiles = fs.readdirSync(trueDir).filter(f => f.endsWith('.pdf')).sort();
  const reviewFiles = fs.readdirSync(reviewDir).filter(f => f.endsWith('.pdf')).sort();

  console.log(`\n📂 真题 (${trueFiles.length} files):`);
  for (const file of trueFiles) {
    const title = file.replace('.pdf', '');
    const filePath = path.join(trueDir, file);
    await uploadFile(filePath, title, CATEGORY_TRUE);
  }

  console.log(`\n📂 复习资料 (${reviewFiles.length} files):`);
  for (const file of reviewFiles) {
    const title = file.replace('.pdf', '');
    const filePath = path.join(reviewDir, file);
    await uploadFile(filePath, title, CATEGORY_REVIEW);
  }

  console.log('\n🎉 All files uploaded! They will be visible after admin approval.');
}

main().catch(console.error);
