import { supabase } from './supabase'

export const GUIDELINES_BUCKET = 'guidelines'

export async function uploadGuidelineFile(
  userId: string,
  file: File,
): Promise<{ path: string }> {
  const ext = file.name.split('.').pop() ?? 'pdf'
  const path = `${userId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage
    .from(GUIDELINES_BUCKET)
    .upload(path, file, {
      contentType: file.type || 'application/pdf',
      upsert: false,
    })
  if (error) throw error
  return { path }
}

export async function deleteGuidelineFile(path: string): Promise<void> {
  const { error } = await supabase.storage
    .from(GUIDELINES_BUCKET)
    .remove([path])
  if (error) throw error
}

export async function getGuidelineSignedUrl(
  path: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(GUIDELINES_BUCKET)
    .createSignedUrl(path, expiresInSeconds)
  if (error) throw error
  return data.signedUrl
}
