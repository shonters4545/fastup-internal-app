/**
 * FAST-UP Data Migration: Firestore → Supabase
 *
 * Prerequisites:
 *   1. Place Firebase service account key at scripts/firebase-service-account.json
 *      (Firebase Console → Project Settings → Service accounts → Generate new private key)
 *   2. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 *   3. Run: npx tsx scripts/migrate-firestore-to-supabase.ts
 *
 * This script:
 *   - Reads all collections from Firestore
 *   - Maps Firestore document IDs to new Supabase UUIDs
 *   - Inserts data into Supabase tables with correct foreign key references
 *   - Handles subcollections (users/{uid}/progress, customBooks, customTasks)
 *   - Downloads Firebase Storage files and uploads to Supabase Storage
 */

import * as admin from 'firebase-admin';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

// --- Config ---
const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'firebase-service-account.json');

// Load env from .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env: Record<string, string> = {};
envContent.split('\n').forEach(line => {
  const [key, ...rest] = line.split('=');
  if (key && rest.length) env[key.trim()] = rest.join('=').trim();
});

const SUPABASE_URL = env['NEXT_PUBLIC_SUPABASE_URL'];
const SUPABASE_SERVICE_KEY = env['SUPABASE_SERVICE_ROLE_KEY'];

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

// --- Initialize ---
const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf-8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'fast-up-daycamp.firebasestorage.app',
});

const firestore = admin.firestore();
const storage = admin.storage().bucket();
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// --- ID Mapping ---
// Maps old Firestore document IDs to new Supabase UUIDs
const idMap: Record<string, Record<string, string>> = {};

function setId(collection: string, oldId: string, newId: string) {
  if (!idMap[collection]) idMap[collection] = {};
  idMap[collection][oldId] = newId;
}

function getId(collection: string, oldId: string): string | null {
  return idMap[collection]?.[oldId] || null;
}

// --- Helpers ---
function toISOString(val: any): string | null {
  if (!val) return null;
  if (val.toDate) return val.toDate().toISOString(); // Firestore Timestamp
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'string') return val;
  return null;
}

async function fetchCollection(name: string) {
  const snapshot = await firestore.collection(name).get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function fetchSubcollection(parentPath: string, subName: string) {
  const snapshot = await firestore.collection(`${parentPath}/${subName}`).get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

function downloadFile(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadFile(res.headers.location!).then(resolve).catch(reject);
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// --- Migration Functions ---

async function migrateSubjects() {
  console.log('--- Migrating subjects ---');
  const docs = await fetchCollection('subjects');
  for (const doc of docs) {
    const d = doc as any;
    const { data, error } = await supabase.from('subjects').insert({
      name: d.name,
      display_order: d.sequence || d.displayOrder || 0,
    }).select('id').single();
    if (error) { console.error('  Error:', d.name, error.message); continue; }
    setId('subjects', doc.id, data.id);
    console.log(`  subjects: ${d.name} → ${data.id}`);
  }
}

async function migrateDivisions() {
  console.log('--- Migrating divisions ---');
  const docs = await fetchCollection('divisions');
  for (const doc of docs) {
    const d = doc as any;
    const subjectId = getId('subjects', d.subjectId);
    if (!subjectId) { console.warn(`  Skipping division ${d.name}: no subject mapping for ${d.subjectId}`); continue; }
    const { data, error } = await supabase.from('divisions').insert({
      subject_id: subjectId,
      name: d.name,
      display_order: d.sequence || d.displayOrder || 0,
    }).select('id').single();
    if (error) { console.error('  Error:', d.name, error.message); continue; }
    setId('divisions', doc.id, data.id);
    console.log(`  divisions: ${d.name} → ${data.id}`);
  }
}

async function migrateBooks() {
  console.log('--- Migrating books ---');
  const docs = await fetchCollection('books');
  for (const doc of docs) {
    const d = doc as any;
    const divisionId = getId('divisions', d.divisionId);
    if (!divisionId) { console.warn(`  Skipping book ${d.name}: no division mapping for ${d.divisionId}`); continue; }
    // Derive subject_id from division
    const division = (await fetchCollection('divisions')).find((div: any) => div.id === d.divisionId) as any;
    const subjectId = division ? getId('subjects', division.subjectId) : null;
    if (!subjectId) { console.warn(`  Skipping book ${d.name}: no subject mapping`); continue; }

    // Handle image URL - download from Firebase Storage and upload to Supabase
    let imageUrl = d.imageUrl || null;
    if (imageUrl && imageUrl.startsWith('gs://')) {
      try {
        const filePath = imageUrl.replace(/^gs:\/\/[^/]+\//, '');
        const [signedUrl] = await storage.file(filePath).getSignedUrl({
          action: 'read',
          expires: Date.now() + 15 * 60 * 1000,
        });
        const buffer = await downloadFile(signedUrl);
        const ext = path.extname(filePath) || '.jpg';
        const storagePath = `books/${doc.id}${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('book-images')
          .upload(storagePath, buffer, { contentType: `image/${ext.replace('.', '')}`, upsert: true });
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from('book-images').getPublicUrl(storagePath);
          imageUrl = urlData.publicUrl;
        } else {
          console.warn(`  Image upload failed for ${d.name}: ${uploadErr.message}`);
          imageUrl = null;
        }
      } catch (e: any) {
        console.warn(`  Image migration failed for ${d.name}: ${e.message}`);
        imageUrl = null;
      }
    }

    const { data, error } = await supabase.from('books').insert({
      division_id: divisionId,
      subject_id: subjectId,
      name: d.name,
      image_url: imageUrl,
      display_order: d.sequence || 0,
      max_laps: d.maxLaps || 1,
      is_custom: false,
      drive_url: d.driveUrl || null,
      remarks: d.remarks || null,
    }).select('id').single();
    if (error) { console.error('  Error:', d.name, error.message); continue; }
    setId('books', doc.id, data.id);
    console.log(`  books: ${d.name} → ${data.id}`);
  }
}

async function migrateTasks() {
  console.log('--- Migrating tasks ---');
  const docs = await fetchCollection('tasks');
  for (const doc of docs) {
    const d = doc as any;
    const bookId = getId('books', d.bookId);
    if (!bookId) { console.warn(`  Skipping task ${d.name}: no book mapping for ${d.bookId}`); continue; }
    const { data, error } = await supabase.from('tasks').insert({
      book_id: bookId,
      name: d.name,
      display_order: d.sequence || 0,
    }).select('id').single();
    if (error) { console.error('  Error:', d.name, error.message); continue; }
    setId('tasks', doc.id, data.id);
    console.log(`  tasks: ${d.name} → ${data.id}`);
  }
}

async function migrateCategories() {
  console.log('--- Migrating categories ---');
  const docs = await fetchCollection('categories');
  for (const doc of docs) {
    const d = doc as any;
    const { data, error } = await supabase.from('categories').insert({
      name: d.name,
      display_order: d.displayOrder || 0,
    }).select('id').single();
    if (error) { console.error('  Error:', d.name, error.message); continue; }
    setId('categories', doc.id, data.id);
    console.log(`  categories: ${d.name} → ${data.id}`);
  }
}

async function migrateUsers() {
  console.log('--- Migrating users ---');
  const docs = await fetchCollection('users');
  for (const doc of docs) {
    const d = doc as any;
    const { data, error } = await supabase.from('users').insert({
      auth_id: doc.id, // Firebase uid
      display_name: d.displayName || d.nickname || 'Unknown',
      nickname: d.nickname || null,
      email: d.email || '',
      photo_url: d.photoURL || null,
      role: d.role || 'student',
      target_college: d.targetCollege || null,
      grade: d.grade || null,
      target_time: d.targetTime || null,
      phone_number: d.phoneNumber || null,
      high_school: d.highSchool || null,
      learning_location: d.learningLocation || 'classroom',
      profile_completed: d.profileCompleted ?? false,
    }).select('id').single();
    if (error) { console.error('  Error:', d.email, error.message); continue; }
    setId('users', doc.id, data.id);
    console.log(`  users: ${d.email} → ${data.id}`);

    // Migrate user_subjects
    const subjects = d.subjects || [];
    for (const subjectFireId of subjects) {
      const subjectId = getId('subjects', subjectFireId);
      if (!subjectId) continue;
      await supabase.from('user_subjects').insert({
        user_id: data.id,
        subject_id: subjectId,
      });
    }
  }
}

async function migrateContracts() {
  console.log('--- Migrating contracts ---');
  const docs = await fetchCollection('contracts');
  for (const doc of docs) {
    const d = doc as any;
    const userId = getId('users', d.userId);
    if (!userId) { console.warn(`  Skipping contract: no user mapping for ${d.userId}`); continue; }
    const { data, error } = await supabase.from('contracts').insert({
      user_id: userId,
      parent_email: d.parentEmail || null,
      payment_method: d.paymentMethod || null,
      status: d.status || 'active',
      current_period_start: toISOString(d.current_period_start) || new Date().toISOString(),
      current_period_end: toISOString(d.current_period_end) || new Date().toISOString(),
      cancel_at_period_end: d.cancel_at_period_end ?? false,
    }).select('id').single();
    if (error) { console.error('  Error:', error.message); continue; }
    setId('contracts', doc.id, data.id);
    console.log(`  contracts: ${doc.id} → ${data.id}`);
  }
}

async function migrateInvites() {
  console.log('--- Migrating invites ---');
  const docs = await fetchCollection('invites');
  for (const doc of docs) {
    const d = doc as any;
    // Map subject IDs in the invite
    const mappedSubjects = (d.subjects || []).map((sid: string) => getId('subjects', sid)).filter(Boolean);
    const mappedLevels: Record<string, any> = {};
    if (d.levels) {
      for (const [oldSubId, level] of Object.entries(d.levels)) {
        const newSubId = getId('subjects', oldSubId);
        if (newSubId) mappedLevels[newSubId] = level;
      }
    }
    const { data, error } = await supabase.from('invites').insert({
      email: d.email,
      name: d.name,
      role: d.role || 'student',
      status: d.status || 'pending',
      target_college: d.targetCollege || null,
      grade: d.grade || null,
      target_time: d.targetTime || null,
      phone_number: d.phoneNumber || null,
      high_school: d.highSchool || null,
      learning_location: d.learningLocation || null,
      subjects: mappedSubjects,
      levels: Object.keys(mappedLevels).length > 0 ? mappedLevels : null,
      parent_email: d.parentEmail || null,
      payment_method: d.paymentMethod || null,
      contract_start_date: toISOString(d.contractStartDate),
      contract_end_date: toISOString(d.contractEndDate),
    }).select('id').single();
    if (error) { console.error('  Error:', d.email, error.message); continue; }
    setId('invites', doc.id, data.id);
    console.log(`  invites: ${d.email} → ${data.id}`);
  }
}

async function migrateLevels() {
  console.log('--- Migrating levels ---');
  const docs = await fetchCollection('levels');
  for (const doc of docs) {
    const d = doc as any;
    const userId = getId('users', d.userId);
    const subjectId = getId('subjects', d.subjectId);
    if (!userId || !subjectId) continue;
    const { data, error } = await supabase.from('levels').insert({
      user_id: userId,
      subject_id: subjectId,
      level: d.level,
    }).select('id').single();
    if (error) { console.error('  Error:', error.message); continue; }
    setId('levels', doc.id, data.id);
  }
  console.log(`  levels: ${docs.length} migrated`);
}

async function migrateLevelRules() {
  console.log('--- Migrating levelRules ---');
  const docs = await fetchCollection('levelRules');
  for (const doc of docs) {
    const d = doc as any;
    const subjectId = getId('subjects', d.subjectId);
    if (!subjectId) continue;
    // startPoints is a map of divisionId → sequence
    // We need to resolve to book IDs
    if (d.startPoints && typeof d.startPoints === 'object') {
      for (const [divFireId, seq] of Object.entries(d.startPoints)) {
        const divId = getId('divisions', divFireId);
        if (!divId) continue;
        // Find book by division and sequence
        // We'll just store the rule with a placeholder - actual book resolution happens at runtime
      }
    }
    // Simplified: store one rule per level if bookId is directly available
    if (d.bookId) {
      const bookId = getId('books', d.bookId);
      if (!bookId) continue;
      await supabase.from('level_rules').insert({
        subject_id: subjectId,
        level: d.level,
        book_id: bookId,
      });
    }
  }
  console.log(`  levelRules: processed ${docs.length}`);
}

async function migrateClasses() {
  console.log('--- Migrating classes ---');
  const docs = await fetchCollection('classes');
  for (const doc of docs) {
    const d = doc as any;
    const { data, error } = await supabase.from('classes').insert({
      title: d.title || 'Untitled',
      start_time: toISOString(d.startTime) || new Date().toISOString(),
      end_time: toISOString(d.endTime) || new Date().toISOString(),
      survey_sent: d.surveySent ?? false,
      passcode: d.passcode || null,
      instructor_name: d.instructorName || null,
    }).select('id').single();
    if (error) { console.error('  Error:', error.message); continue; }
    setId('classes', doc.id, data.id);
  }
  console.log(`  classes: ${docs.length} migrated`);
}

async function migrateAttendanceRecords() {
  console.log('--- Migrating attendanceRecords ---');
  const docs = await fetchCollection('attendanceRecords');
  for (const doc of docs) {
    const d = doc as any;
    const classId = getId('classes', d.classId);
    const userId = getId('users', d.userId);
    if (!classId || !userId) continue;
    await supabase.from('attendance_records').insert({
      class_id: classId,
      user_id: userId,
      status: 'present',
      instructor_name: d.instructorName || null,
      student_name: d.studentName || null,
      study_material: d.studyMaterial || null,
      attended_at: toISOString(d.attendedAt) || toISOString(d.createdAt),
    });
  }
  console.log(`  attendanceRecords: ${docs.length} migrated`);
}

async function migrateAttendancePlans() {
  console.log('--- Migrating attendance_plans ---');
  const docs = await fetchCollection('attendance_plans');
  for (const doc of docs) {
    const d = doc as any;
    const userId = getId('users', d.userId);
    if (!userId) continue;
    const dateStr = d.date || toISOString(d.date);
    if (!dateStr) continue;
    await supabase.from('attendance_plans').insert({
      user_id: userId,
      date: typeof dateStr === 'string' ? dateStr.slice(0, 10) : dateStr,
      planned: d.planned ?? true,
    });
  }
  console.log(`  attendance_plans: ${docs.length} migrated`);
}

async function migrateSurveyModels() {
  console.log('--- Migrating surveymodels ---');
  const docs = await fetchCollection('surveymodels');
  for (const doc of docs) {
    const d = doc as any;
    const { data, error } = await supabase.from('survey_models').insert({
      title: d.title || 'Untitled',
      type: d.type || 'practice',
      form_fields: d.formFields || d.form_fields || [],
      delivery_status: d.deliveryStatus || null,
      delivery_time: toISOString(d.deliveryTime),
    }).select('id').single();
    if (error) { console.error('  Error:', error.message); continue; }
    setId('surveymodels', doc.id, data.id);
  }
  console.log(`  surveymodels: ${docs.length} migrated`);
}

async function migrateSurveyRequests() {
  console.log('--- Migrating survey_requests ---');
  const docs = await fetchCollection('survey_requests');
  for (const doc of docs) {
    const d = doc as any;
    const userId = getId('users', d.userId);
    const surveyModelId = getId('surveymodels', d.surveyModelId);
    const classId = d.classId ? getId('classes', d.classId) : null;
    if (!userId || !surveyModelId) continue;
    const { data, error } = await supabase.from('survey_requests').insert({
      user_id: userId,
      class_id: classId,
      survey_model_id: surveyModelId,
      type: d.type || 'practice',
      status: d.status || 'pending',
      requested_at: toISOString(d.requestedAt) || toISOString(d.createdAt),
    }).select('id').single();
    if (error) { console.error('  Error:', error.message); continue; }
    setId('survey_requests', doc.id, data.id);
  }
  console.log(`  survey_requests: ${docs.length} migrated`);
}

async function migrateSurveyResponses() {
  console.log('--- Migrating survey_responses ---');
  const docs = await fetchCollection('survey_responses');
  for (const doc of docs) {
    const d = doc as any;
    const userId = getId('users', d.userId);
    const surveyModelId = getId('surveymodels', d.surveyModelId);
    const requestId = getId('survey_requests', d.requestId);
    const classId = d.classId ? getId('classes', d.classId) : null;
    if (!userId || !surveyModelId || !requestId) continue;
    await supabase.from('survey_responses').insert({
      user_id: userId,
      class_id: classId,
      survey_model_id: surveyModelId,
      request_id: requestId,
      type: d.type || 'practice',
      responses: d.responses || {},
      submitted_at: toISOString(d.submittedAt) || toISOString(d.createdAt),
    });
  }
  console.log(`  survey_responses: ${docs.length} migrated`);
}

async function migrateTimelinePosts() {
  console.log('--- Migrating timelinePosts ---');
  const docs = await fetchCollection('timelinePosts');
  for (const doc of docs) {
    const d = doc as any;
    const authorId = d.userId ? getId('users', d.userId) : null;
    const categoryId = d.categoryId ? getId('categories', d.categoryId) : null;
    if (!authorId) { console.warn(`  Skipping post ${d.title}: no author mapping`); continue; }
    const { data, error } = await supabase.from('timeline_posts').insert({
      title: d.title || 'Untitled',
      content: d.content || '',
      thumbnail_url: d.thumbnailUrl || null,
      category_id: categoryId,
      author_id: authorId,
      published: d.published ?? true,
    }).select('id').single();
    if (error) { console.error('  Error:', d.title, error.message); continue; }
    setId('timelinePosts', doc.id, data.id);
  }
  console.log(`  timelinePosts: ${docs.length} migrated`);
}

async function migrateSpecials() {
  console.log('--- Migrating specials ---');
  const docs = await fetchCollection('specials');
  for (const doc of docs) {
    const d = doc as any;
    const { data, error } = await supabase.from('specials').insert({
      title: d.title || 'Untitled',
      description: d.description || null,
      start_date: toISOString(d.startDate) || new Date().toISOString(),
      end_date: toISOString(d.endDate) || new Date().toISOString(),
      capacity: d.capacity || null,
    }).select('id').single();
    if (error) { console.error('  Error:', d.title, error.message); continue; }
    setId('specials', doc.id, data.id);
  }
  console.log(`  specials: ${docs.length} migrated`);
}

async function migrateEntries() {
  console.log('--- Migrating entries ---');
  const docs = await fetchCollection('entries');
  for (const doc of docs) {
    const d = doc as any;
    const specialId = getId('specials', d.specialId);
    const userId = getId('users', d.userId);
    if (!specialId || !userId) continue;
    await supabase.from('entries').insert({
      special_id: specialId,
      user_id: userId,
      status: d.status || 'applied',
    });
  }
  console.log(`  entries: ${docs.length} migrated`);
}

async function migratePersonalEntries() {
  console.log('--- Migrating personalEntries ---');
  const docs = await fetchCollection('personalEntries');
  for (const doc of docs) {
    const d = doc as any;
    const userId = getId('users', d.userId);
    if (!userId) continue;
    await supabase.from('personal_entries').insert({
      user_id: userId,
      subject: d.subject || '',
      preferred_date: toISOString(d.preferredDate) || new Date().toISOString(),
      notes: d.notes || null,
      status: d.status || 'pending',
    });
  }
  console.log(`  personalEntries: ${docs.length} migrated`);
}

async function migrateMemos() {
  console.log('--- Migrating memos ---');
  const docs = await fetchCollection('memos');
  for (const doc of docs) {
    const d = doc as any;
    const userId = getId('users', d.userId);
    const authorId = getId('users', d.author_uid || d.authorId);
    if (!userId || !authorId) continue;
    await supabase.from('memos').insert({
      user_id: userId,
      author_id: authorId,
      content: d.content || '',
    });
  }
  console.log(`  memos: ${docs.length} migrated`);
}

async function migrateUserSubcollections() {
  console.log('--- Migrating user subcollections (progress, customBooks, customTasks) ---');
  const users = await fetchCollection('users');

  for (const user of users) {
    const userId = getId('users', user.id);
    if (!userId) continue;

    // 1. Custom Books → books table (is_custom=true)
    const customBooks = await fetchSubcollection(`users/${user.id}`, 'customBooks');
    for (const cb of customBooks) {
      const d = cb as any;
      const divisionId = getId('divisions', d.divisionId);
      if (!divisionId) continue;
      // Get subject from division
      const divDocs = await fetchCollection('divisions');
      const divDoc = divDocs.find((div: any) => div.id === d.divisionId) as any;
      const subjectId = divDoc ? getId('subjects', divDoc.subjectId) : null;
      if (!subjectId) continue;

      const { data, error } = await supabase.from('books').insert({
        division_id: divisionId,
        subject_id: subjectId,
        name: d.name,
        image_url: d.imageUrl || null,
        display_order: d.sequence || 9999,
        max_laps: d.maxLaps || 1,
        is_custom: true,
        remarks: d.remarks || null,
        user_id: userId,
      }).select('id').single();
      if (error) continue;
      // Map with user-scoped key to avoid collisions
      setId('customBooks', `${user.id}_${cb.id}`, data.id);
    }

    // 2. Custom Tasks → tasks table
    const customTasks = await fetchSubcollection(`users/${user.id}`, 'customTasks');
    for (const ct of customTasks) {
      const d = ct as any;
      const bookId = getId('customBooks', `${user.id}_${d.bookId}`);
      if (!bookId) continue;
      const { data, error } = await supabase.from('tasks').insert({
        book_id: bookId,
        name: d.name,
        display_order: d.sequence || 0,
      }).select('id').single();
      if (error) continue;
      setId('customTasks', `${user.id}_${ct.id}`, data.id);
    }

    // 3. Progress → progress table
    const progressDocs = await fetchSubcollection(`users/${user.id}`, 'progress');
    for (const p of progressDocs) {
      const d = p as any;
      const taskId = getId('tasks', d.taskId) || getId('customTasks', `${user.id}_${d.taskId}`);
      const bookId = d.bookId ? (getId('books', d.bookId) || getId('customBooks', `${user.id}_${d.bookId}`)) : null;
      if (!taskId) continue;
      await supabase.from('progress').insert({
        user_id: userId,
        task_id: taskId,
        book_id: bookId,
        lap: d.lap || 1,
        status: d.isCompleted ? 'completed' : 'not_started',
        score: d.score ?? null,
      });
    }

    console.log(`  User ${(user as any).email}: ${customBooks.length} customBooks, ${customTasks.length} customTasks, ${progressDocs.length} progress`);
  }
}

// --- Main ---
async function main() {
  console.log('=== FAST-UP Data Migration: Firestore → Supabase ===\n');
  console.log('Supabase URL:', SUPABASE_URL);
  console.log('');

  try {
    // Phase 1: Master data (no dependencies)
    await migrateSubjects();
    await migrateCategories();

    // Phase 2: Data depending on subjects
    await migrateDivisions();

    // Phase 3: Data depending on divisions
    await migrateBooks();

    // Phase 4: Data depending on books
    await migrateTasks();

    // Phase 5: Users
    await migrateUsers();

    // Phase 6: Data depending on users
    await migrateContracts();
    await migrateInvites();
    await migrateLevels();
    await migrateLevelRules();

    // Phase 7: Classes and related
    await migrateClasses();
    await migrateAttendanceRecords();
    await migrateAttendancePlans();

    // Phase 8: Surveys
    await migrateSurveyModels();
    await migrateSurveyRequests();
    await migrateSurveyResponses();

    // Phase 9: Content
    await migrateTimelinePosts();
    await migrateSpecials();
    await migrateEntries();
    await migratePersonalEntries();
    await migrateMemos();

    // Phase 10: User subcollections (customBooks, customTasks, progress)
    await migrateUserSubcollections();

    // Save ID mapping for reference
    const mapPath = path.join(__dirname, 'id-mapping.json');
    fs.writeFileSync(mapPath, JSON.stringify(idMap, null, 2));
    console.log(`\n=== Migration complete! ID mapping saved to ${mapPath} ===`);

  } catch (error) {
    console.error('\n!!! Migration failed:', error);
    // Still save partial mapping
    const mapPath = path.join(__dirname, 'id-mapping-partial.json');
    fs.writeFileSync(mapPath, JSON.stringify(idMap, null, 2));
    console.log(`Partial ID mapping saved to ${mapPath}`);
    process.exit(1);
  }
}

main();
