import { createClient } from './client';

type BucketName = 'book-images' | 'post-thumbnails' | 'custom-content';

/**
 * Upload a file to Supabase Storage and return its public URL.
 */
export async function uploadFile(
  bucket: BucketName,
  path: string,
  file: File
): Promise<string> {
  const supabase = createClient();
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
  });
  if (error) throw error;
  return getPublicUrl(bucket, path);
}

/**
 * Get the public URL for a file in a public bucket.
 */
export function getPublicUrl(bucket: BucketName, path: string): string {
  const supabase = createClient();
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Delete a file from Supabase Storage.
 */
export async function deleteFile(bucket: BucketName, path: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw error;
}

/**
 * Generate a unique storage path for an uploaded file.
 */
export function generatePath(prefix: string, fileName: string): string {
  const timestamp = Date.now();
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${prefix}/${timestamp}_${sanitized}`;
}
