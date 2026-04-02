/**
 * Google Sheets → Supabase カリキュラム同期スクリプト
 *
 * 使い方:
 *   npx tsx scripts/sync-curriculum.ts
 *   (SUPABASE_SERVICE_ROLE_KEY は .env.local から自動読み込み)
 *
 * 処理フロー（UPSERT方式 - progressを一切壊さない）:
 *   1. Google Drive APIでデータベースフォルダ内のスプレッドシート一覧を取得
 *   2. Google Sheets APIで各シートのデータを取得
 *   3. バックアップ (scripts/backup_YYYYMMDD_HHmmss.json)
 *   4. divisions UPSERT
 *   5. books UPSERT（名前+subject_idで既存マッチ → UPDATE / なければINSERT）
 *   6. tasks UPSERT（book_id+display_orderで既存マッチ → UPDATE / なければINSERT）
 *   7. CSVにないbooksを削除（そのbookにprogressがなければ）
 *   8. 余分なtasksを削除（display_order > 総Unit数 かつ progressがなければ）
 *   9. 空 divisions 削除
 *
 * ★ progressは絶対に削除・NULL化しない
 *
 * Google Drive:
 *   カリキュラムルート: https://drive.google.com/drive/u/0/folders/1bTsj0ycmC7Y6iA-fD2PnoYyzaYcXF-S0
 *   データベース: https://drive.google.com/drive/u/0/folders/1GhL0ZmwPPt6BlXnLEq3IzoMJB7CpyV10
 */

import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// .env.local から環境変数を読み込み
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// ── Config ──────────────────────────────────────────
const SUPABASE_URL = 'https://ytunykqlsqulrgfmkkmo.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY not found in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const SERVICE_ACCOUNT_KEY = path.join(__dirname, 'firebase-service-account.json');
const DATABASE_FOLDER_ID = '1GhL0ZmwPPt6BlXnLEq3IzoMJB7CpyV10';
const DEFAULT_UNIT_LABEL = 'Unit';

// ── Google API Setup ────────────────────────────────
function getGoogleAuth() {
  return new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_KEY,
    scopes: [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/spreadsheets.readonly',
    ],
  });
}

// ── Fetch Spreadsheets from Drive ───────────────────
async function fetchSpreadsheetList(): Promise<{ id: string; name: string }[]> {
  const auth = getGoogleAuth();
  const drive = google.drive({ version: 'v3', auth });

  const res = await drive.files.list({
    q: `'${DATABASE_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.spreadsheet'`,
    fields: 'files(id, name)',
    pageSize: 50,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  return (res.data.files || []).map(f => ({ id: f.id!, name: f.name! }));
}

// ── Fetch Sheet Data ────────────────────────────────
async function fetchSheetData(spreadsheetId: string): Promise<Record<string, string>[]> {
  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'A:Z',
  });

  const rows = res.data.values;
  if (!rows || rows.length < 2) return [];

  const headers = rows[0] as string[];
  return rows.slice(1)
    .filter(row => row.some((cell: string) => cell?.trim()))
    .map(row => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { if (h) obj[h] = (row[i] as string) || ''; });
      return obj;
    });
}

// ── Helpers ─────────────────────────────────────────
function getSubjectName(filename: string): string {
  const idx = filename.indexOf('_');
  return idx >= 0 ? filename.substring(idx + 1) : filename;
}

function getSheetPrefix(filename: string): string {
  const idx = filename.indexOf('_');
  return idx >= 0 ? filename.substring(0, idx) : filename;
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

// ── Main Sync (UPSERT方式) ─────────────────────────
async function main() {
  console.log('=== カリキュラム同期スクリプト (Google Sheets API + UPSERT方式) ===\n');

  // ── Step 0: Fetch spreadsheets from Google Drive ──
  console.log('Fetching spreadsheet list from Google Drive...');
  const spreadsheets = await fetchSpreadsheetList();
  if (spreadsheets.length === 0) {
    console.error('No spreadsheets found in database folder.');
    process.exit(1);
  }
  console.log(`Found ${spreadsheets.length} spreadsheets:\n`);

  // ── Step 1: Fetch data from each sheet ──
  const sheets: { filename: string; subjectName: string; sheetPrefix: string; rows: Record<string, string>[] }[] = [];

  for (const ss of spreadsheets) {
    const rows = await fetchSheetData(ss.id);
    const validRows = rows.filter(r => r['教材ID']?.trim());
    sheets.push({
      filename: ss.name,
      subjectName: getSubjectName(ss.name),
      sheetPrefix: getSheetPrefix(ss.name),
      rows: validRows,
    });
    console.log(`  ${ss.name}: ${validRows.length} materials`);
  }
  console.log('');

  // ── Step 2: Backup ──
  await backup();

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

  // ── Step 4: UPSERT divisions, books, tasks ──
  let updatedBooks = 0;
  let insertedBooks = 0;
  let updatedTasks = 0;
  let insertedTasks = 0;
  let deletedTasks = 0;

  const sheetBookNames = new Map<string, Set<string>>();

  for (const sheet of sheets) {
    const subjectId = subjectMap.get(sheet.subjectName)!;
    console.log(`-- ${sheet.subjectName} --`);

    if (!sheetBookNames.has(subjectId)) sheetBookNames.set(subjectId, new Set());

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

    // UPSERT books
    for (const row of sheet.rows) {
      const divisionId = divisionMap.get(row['分野']);
      if (!divisionId) continue;

      const bookName = row['教材名'];
      const displayOrder = parseInt(row['学習順序']) || 0;
      const maxLaps = parseInt(row['推奨周回数']) || 1;
      const driveUrl = row['driveUrl'] || null;
      const remarks = row['備考'] || null;
      const unitLabel = row['単位名称'] || DEFAULT_UNIT_LABEL;
      const totalUnits = parseInt(row['総Unit数']) || 0;
      const level = row['レベル']?.trim() || null;

      sheetBookNames.get(subjectId)!.add(bookName);

      // Check if book already exists
      const { data: existingBook } = await supabase
        .from('books')
        .select('id')
        .eq('subject_id', subjectId)
        .eq('name', bookName)
        .eq('is_custom', false)
        .maybeSingle();

      let bookId: string;

      if (existingBook) {
        const { error: updateErr } = await supabase
          .from('books')
          .update({
            division_id: divisionId,
            display_order: displayOrder,
            max_laps: maxLaps,
            drive_url: driveUrl,
            remarks: remarks,
            level: level,
          })
          .eq('id', existingBook.id);

        if (updateErr) {
          console.error(`  Error updating book "${bookName}":`, updateErr.message);
          continue;
        }
        bookId = existingBook.id;
        updatedBooks++;
        console.log(`  UPDATE ${bookName} [${level || '-'}]`);
      } else {
        const { data: newBook, error: insertErr } = await supabase
          .from('books')
          .insert({
            division_id: divisionId,
            subject_id: subjectId,
            name: bookName,
            display_order: displayOrder,
            max_laps: maxLaps,
            drive_url: driveUrl,
            remarks: remarks,
            is_custom: false,
            level: level,
          })
          .select('id')
          .single();

        if (insertErr) {
          console.error(`  Error inserting book "${bookName}":`, insertErr.message);
          continue;
        }
        bookId = newBook.id;
        insertedBooks++;
        console.log(`  INSERT ${bookName} [${level || '-'}]`);
      }

      // UPSERT tasks
      if (totalUnits > 0) {
        const { data: existingTasks } = await supabase
          .from('tasks')
          .select('id, display_order, name')
          .eq('book_id', bookId)
          .order('display_order');

        const existingTaskMap = new Map<number, { id: string; name: string }>();
        existingTasks?.forEach(t => existingTaskMap.set(t.display_order, { id: t.id, name: t.name }));

        for (let i = 1; i <= totalUnits; i++) {
          const taskName = `${unitLabel}${i}`;
          const existing = existingTaskMap.get(i);

          if (existing) {
            if (existing.name !== taskName) {
              await supabase.from('tasks').update({ name: taskName }).eq('id', existing.id);
            }
            updatedTasks++;
          } else {
            const { error: taskErr } = await supabase.from('tasks').insert({
              book_id: bookId,
              name: taskName,
              display_order: i,
            });
            if (taskErr) {
              console.error(`  Error inserting task "${taskName}" for "${bookName}":`, taskErr.message);
            }
            insertedTasks++;
          }
        }

        // Delete excess tasks only if no progress
        const excessTasks = (existingTasks || []).filter(t => t.display_order > totalUnits);
        for (const task of excessTasks) {
          const { count: progressCount } = await supabase
            .from('progress')
            .select('id', { count: 'exact', head: true })
            .eq('task_id', task.id);

          if (progressCount === 0) {
            await supabase.from('tasks').delete().eq('id', task.id);
            deletedTasks++;
          } else {
            console.log(`  SKIP delete task ${task.name} (${progressCount} progress records)`);
          }
        }
      }
    }
    console.log('');
  }

  // ── Step 5: Delete books no longer in sheets (only if no progress) ──
  let deletedBooks = 0;
  let skippedBooks = 0;

  for (const subjectId of targetSubjectIds) {
    const { data: dbBooks } = await supabase
      .from('books')
      .select('id, name')
      .eq('subject_id', subjectId)
      .eq('is_custom', false);

    const names = sheetBookNames.get(subjectId) || new Set();

    for (const book of dbBooks || []) {
      if (!names.has(book.name)) {
        const { count: progressCount } = await supabase
          .from('progress')
          .select('id', { count: 'exact', head: true })
          .eq('book_id', book.id);

        if (progressCount === 0) {
          await supabase.from('books').delete().eq('id', book.id);
          deletedBooks++;
          console.log(`  Deleted obsolete book: ${book.name}`);
        } else {
          skippedBooks++;
          console.log(`  SKIP delete book "${book.name}" (${progressCount} progress records)`);
        }
      }
    }
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

  // ── Summary ──
  console.log('\n=== 同期完了 ===');
  console.log(`  Books: ${updatedBooks} updated, ${insertedBooks} inserted, ${deletedBooks} deleted, ${skippedBooks} skipped (has progress)`);
  console.log(`  Tasks: ${updatedTasks} updated, ${insertedTasks} inserted, ${deletedTasks} deleted`);

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
  const { count: nullBookProgress } = await supabase
    .from('progress')
    .select('id', { count: 'exact', head: true })
    .is('book_id', null);
  const { count: nullTaskProgress } = await supabase
    .from('progress')
    .select('id', { count: 'exact', head: true })
    .is('task_id', null);

  console.log(`  DB total: ${bookCount} master books, ${taskCount} tasks, ${progressCount} progress`);
  console.log(`  Progress integrity: ${nullBookProgress} null book_id, ${nullTaskProgress} null task_id`);

  if ((nullBookProgress || 0) > 0 || (nullTaskProgress || 0) > 0) {
    console.error('  ⚠ WARNING: Some progress records have NULL references!');
  } else {
    console.log('  ✓ All progress references intact');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
