/**
 * スプレッドシート(CSV) → Supabase カリキュラム同期スクリプト
 *
 * 使い方:
 *   1. scripts/curriculum-csv/ に最新CSVを配置
 *   2. scripts/curriculum-images/ に新規画像を配置（任意）
 *   3. npx tsx scripts/sync-curriculum.ts
 *
 * 処理フロー:
 *   1. バックアップ (scripts/backup_YYYYMMDD_HHmmss.json)
 *   2. 画像アップロード (curriculum-images/ → Supabase Storage)
 *   3. master books 削除 (CASCADE: tasks, user_curriculum / SET NULL: progress, attendance_records)
 *   4. 空 divisions 削除
 *   5. divisions UPSERT
 *   6. books INSERT
 *   7. tasks 自動生成
 *
 * progressは一切削除しない:
 *   - FK制約が SET NULL のため、books/tasks削除時にprogress.book_id/task_idがNULLになるだけ
 *   - 孤立したprogressはUIに表示されないが、データは保持される
 *
 * 画像の命名規則:
 *   Storage上: {sheetPrefix}_{教材ID}.jpg (例: english_VOC_01.jpg)
 *   curriculum-images/ にも同じ名前で配置する
 *
 * Google Drive:
 *   スプレッドシート: https://drive.google.com/drive/u/0/folders/1KF0tSucUewtztJz8mK337piU09b5vN51
 *   画像: https://drive.google.com/drive/u/0/folders/1jz7QcHJaEllEL3kz9iDtA-A0gbX4frEJ
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// ── Config ──────────────────────────────────────────
const SUPABASE_URL = 'https://ytunykqlsqulrgfmkkmo.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY env var is required.');
  console.error('Run with: SUPABASE_SERVICE_ROLE_KEY=<key> npx tsx scripts/sync-curriculum.ts');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const CSV_DIR = path.join(__dirname, 'curriculum-csv');
const IMAGE_DIR = path.join(__dirname, 'curriculum-images');
const STORAGE_BUCKET = 'book-images';
const STORAGE_PATH = 'books';
const IMAGE_BASE = `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${STORAGE_PATH}`;
const DEFAULT_UNIT_LABEL = 'Unit';

// ── CSV Parser ──────────────────────────────────────
function parseCSV(csv: string): Record<string, string>[] {
  const lines = csv.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  const parseRow = (line: string): string[] => {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          fields.push(current);
          current = '';
        } else {
          current += ch;
        }
      }
    }
    fields.push(current);
    return fields;
  };

  const headers = parseRow(lines[0]);
  return lines.slice(1).map(line => {
    const values = parseRow(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      if (h) row[h] = values[i] || '';
    });
    return row;
  });
}

// ── Helpers ─────────────────────────────────────────
function getSubjectName(filename: string): string {
  const base = path.basename(filename, '.csv');
  const idx = base.indexOf('_');
  return idx >= 0 ? base.substring(idx + 1) : base;
}

function getSheetPrefix(filename: string): string {
  const base = path.basename(filename, '.csv');
  const idx = base.indexOf('_');
  return idx >= 0 ? base.substring(0, idx) : base;
}

function storageFileName(sheetPrefix: string, materialId: string): string {
  return `${sheetPrefix}_${materialId}.jpg`;
}

function buildImageUrl(sheetPrefix: string, materialId: string): string {
  return `${IMAGE_BASE}/${storageFileName(sheetPrefix, materialId)}`;
}

// ── Image Upload ────────────────────────────────────
async function uploadImages(
  sheets: { sheetPrefix: string; rows: Record<string, string>[] }[]
): Promise<Set<string>> {
  console.log('Checking images...');

  if (!fs.existsSync(IMAGE_DIR)) {
    fs.mkdirSync(IMAGE_DIR, { recursive: true });
    console.log(`  Created ${IMAGE_DIR} (place images here for upload)\n`);
    return new Set();
  }

  const localFiles = fs.readdirSync(IMAGE_DIR).filter(f =>
    /\.(jpg|jpeg|png|webp)$/i.test(f)
  );

  if (localFiles.length === 0) {
    console.log('  No local images found in curriculum-images/. Skipping upload.\n');
    return new Set();
  }

  const expectedFiles = new Map<string, string>();
  for (const sheet of sheets) {
    for (const row of sheet.rows) {
      if (row['imageUrl']) {
        const sfn = storageFileName(sheet.sheetPrefix, row['教材ID']);
        const exactMatch = localFiles.find(f => f === sfn);
        const csvMatch = localFiles.find(f => f === row['imageUrl']);
        const match = exactMatch || csvMatch;
        if (match) {
          expectedFiles.set(sfn, path.join(IMAGE_DIR, match));
        }
      }
    }
  }

  if (expectedFiles.size === 0) {
    console.log('  No matching images found for CSV entries. Skipping upload.\n');
    return new Set();
  }

  const uploaded = new Set<string>();
  let uploadCount = 0;
  let skipCount = 0;

  for (const [sfn, localPath] of expectedFiles) {
    const storagePath = `${STORAGE_PATH}/${sfn}`;
    const { data: existing } = await supabase.storage
      .from(STORAGE_BUCKET)
      .list(STORAGE_PATH, { search: sfn });

    if (existing?.some(f => f.name === sfn)) {
      skipCount++;
      uploaded.add(sfn);
      continue;
    }

    const fileBuffer = fs.readFileSync(localPath);
    const contentType = sfn.endsWith('.png') ? 'image/png' : 'image/jpeg';
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileBuffer, { contentType, upsert: true });

    if (error) {
      console.error(`  Error uploading ${sfn}:`, error.message);
    } else {
      uploadCount++;
      uploaded.add(sfn);
      console.log(`  Uploaded: ${sfn}`);
    }
  }

  console.log(`  Images: ${uploadCount} uploaded, ${skipCount} already existed\n`);
  return uploaded;
}

// ── Backup ──────────────────────────────────────────
async function backup() {
  console.log('Backing up current data...');
  const tables = ['subjects', 'divisions', 'books', 'tasks', 'progress'];
  const data: Record<string, any[]> = {};

  for (const table of tables) {
    const { data: rows, error } = await supabase.from(table).select('*');
    if (error) {
      console.error(`  Backup error for ${table}:`, error.message);
      data[table] = [];
    } else {
      data[table] = rows || [];
      console.log(`  ${table}: ${rows?.length || 0} rows`);
    }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '').substring(0, 15);
  const backupPath = path.join(__dirname, `backup_${timestamp}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(data, null, 2));
  console.log(`  Saved to: ${backupPath}\n`);
}

// ── Main Sync ───────────────────────────────────────
async function main() {
  console.log('=== カリキュラム同期スクリプト ===\n');

  // ── Step 0: Read CSV files ──
  const csvFiles = fs.readdirSync(CSV_DIR).filter(f => f.endsWith('.csv'));
  if (csvFiles.length === 0) {
    console.error('No CSV files found in', CSV_DIR);
    process.exit(1);
  }
  console.log(`Found ${csvFiles.length} CSV files: ${csvFiles.join(', ')}\n`);

  const sheets: { filename: string; subjectName: string; sheetPrefix: string; rows: Record<string, string>[] }[] = [];
  for (const file of csvFiles) {
    const csv = fs.readFileSync(path.join(CSV_DIR, file), 'utf-8');
    const rows = parseCSV(csv);
    sheets.push({
      filename: file,
      subjectName: getSubjectName(file),
      sheetPrefix: getSheetPrefix(file),
      rows,
    });
    console.log(`  ${file}: ${rows.length} materials`);
  }
  console.log('');

  // ── Step 1: Backup ──
  await backup();

  // ── Step 2: Upload images ──
  const uploadedImages = await uploadImages(sheets);

  // ── Step 3: Get existing subjects ──
  const { data: allSubjects } = await supabase.from('subjects').select('*');
  const subjectMap = new Map<string, string>();
  allSubjects?.forEach(s => subjectMap.set(s.name, s.id));

  const targetSubjectIds: string[] = [];
  for (const sheet of sheets) {
    const sid = subjectMap.get(sheet.subjectName);
    if (!sid) {
      console.error(`Subject not found: ${sheet.subjectName}`);
      process.exit(1);
    }
    targetSubjectIds.push(sid);
    console.log(`  Subject: ${sheet.subjectName} → ${sid}`);
  }
  console.log('');

  // ── Step 4: Save existing image URLs before deletion ──
  const { data: existingBooks } = await supabase
    .from('books')
    .select('id, name, image_url, subject_id')
    .eq('is_custom', false)
    .in('subject_id', targetSubjectIds);

  const masterBookCount = existingBooks?.length || 0;
  const existingImageMap = new Map<string, string>();
  existingBooks?.forEach(b => {
    if (b.image_url) existingImageMap.set(b.name, b.image_url);
  });

  // ── Step 5: Delete master books ──
  // CASCADE: tasks, user_curriculum
  // SET NULL: progress.task_id, progress.book_id, attendance_records.book_id
  // → progressは一切消えない
  console.log(`  Existing master books to replace: ${masterBookCount}`);

  if (masterBookCount > 0) {
    const { error: delErr, count: delCount } = await supabase
      .from('books')
      .delete({ count: 'exact' })
      .eq('is_custom', false)
      .in('subject_id', targetSubjectIds);
    console.log(`  Deleted master books: ${delCount ?? 0} ${delErr ? '(ERROR: ' + delErr.message + ')' : ''}`);
  }

  // ── Step 6: Clean up empty divisions ──
  const { data: allDivisions } = await supabase
    .from('divisions')
    .select('id, name, subject_id')
    .in('subject_id', targetSubjectIds);

  if (allDivisions) {
    for (const div of allDivisions) {
      const { count } = await supabase
        .from('books')
        .select('id', { count: 'exact', head: true })
        .eq('division_id', div.id);
      if (count === 0) {
        await supabase.from('divisions').delete().eq('id', div.id);
        console.log(`  Deleted empty division: ${div.name}`);
      }
    }
  }
  console.log('');

  // ── Step 7: Upsert divisions & Insert books & tasks ──
  let totalBooks = 0;
  let totalTasks = 0;

  for (const sheet of sheets) {
    const subjectId = subjectMap.get(sheet.subjectName)!;
    console.log(`-- ${sheet.subjectName} --`);

    // Ensure divisions exist
    const divisionNames = [...new Set(sheet.rows.map(r => r['分野']))];
    const divisionMap = new Map<string, string>();

    for (const divName of divisionNames) {
      const { data: existing } = await supabase
        .from('divisions')
        .select('id')
        .eq('subject_id', subjectId)
        .eq('name', divName)
        .maybeSingle();

      if (existing) {
        divisionMap.set(divName, existing.id);
      } else {
        const { data: newDiv, error } = await supabase
          .from('divisions')
          .insert({ subject_id: subjectId, name: divName, display_order: 0 })
          .select('id')
          .single();
        if (error) {
          console.error(`  Error creating division ${divName}:`, error.message);
          continue;
        }
        divisionMap.set(divName, newDiv.id);
        console.log(`  Created division: ${divName}`);
      }
    }

    // Insert books
    for (const row of sheet.rows) {
      const divisionId = divisionMap.get(row['分野']);
      if (!divisionId) continue;

      const materialId = row['教材ID'];
      const bookName = row['教材名'];
      const displayOrder = parseInt(row['学習順序']) || 0;
      const maxLaps = parseInt(row['推奨周回数']) || 1;
      const driveUrl = row['driveUrl'] || null;
      const remarks = row['備考'] || null;
      const unitLabel = row['単位名称'] || DEFAULT_UNIT_LABEL;
      const totalUnits = parseInt(row['総Unit数']) || 0;

      // Image URL: reuse existing, or construct if CSV has imageUrl
      let imageUrl: string | null = existingImageMap.get(bookName) || null;
      if (!imageUrl && row['imageUrl']) {
        imageUrl = buildImageUrl(sheet.sheetPrefix, materialId);
      }

      const { data: newBook, error: bookErr } = await supabase
        .from('books')
        .insert({
          division_id: divisionId,
          subject_id: subjectId,
          name: bookName,
          display_order: displayOrder,
          max_laps: maxLaps,
          drive_url: driveUrl,
          image_url: imageUrl,
          remarks: remarks,
          is_custom: false,
        })
        .select('id')
        .single();

      if (bookErr) {
        console.error(`  Error inserting book "${bookName}":`, bookErr.message);
        continue;
      }

      totalBooks++;

      // Generate tasks
      if (totalUnits > 0 && newBook) {
        const tasks = [];
        for (let i = 1; i <= totalUnits; i++) {
          tasks.push({
            book_id: newBook.id,
            name: `${unitLabel}${i}`,
            display_order: i,
          });
        }

        for (let i = 0; i < tasks.length; i += 500) {
          const batch = tasks.slice(i, i + 500);
          const { error: taskErr } = await supabase.from('tasks').insert(batch);
          if (taskErr) {
            console.error(`  Error inserting tasks for "${bookName}":`, taskErr.message);
          }
        }
        totalTasks += totalUnits;
      }

      console.log(`  OK ${bookName} (${totalUnits} ${unitLabel})`);
    }
    console.log('');
  }

  // ── Summary ──
  console.log('=== 同期完了 ===');
  console.log(`  Books: ${totalBooks} inserted`);
  console.log(`  Tasks: ${totalTasks} generated`);
  console.log(`  Images: ${uploadedImages.size} in storage`);

  const { count: bookCount } = await supabase
    .from('books')
    .select('id', { count: 'exact', head: true })
    .eq('is_custom', false);
  const { count: taskCount } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true });
  const { count: progressCount } = await supabase
    .from('progress')
    .select('id', { count: 'exact', head: true });
  console.log(`  DB total: ${bookCount} master books, ${taskCount} tasks, ${progressCount} progress (preserved)`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
