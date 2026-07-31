import type { SupabaseClient } from '@supabase/supabase-js';
import type { SpeakerMaterial } from '@event-platform/shared';
export const uploadMaterial = async (
  data: { session_id: string; file_name: string; file_url: string; file_type: string; access_level?: string; description?: string },
  supabase: SupabaseClient
): Promise<SpeakerMaterial> => {
  const { data: material, error } = await supabase
    .from('speaker_materials')
    .insert({
      session_id: data.session_id,
      file_name: data.file_name,
      file_url: data.file_url,
      file_type: data.file_type,
      access_level: data.access_level || 'public',
      description: data.description || null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to upload material: ${error.message}`);
  return material as SpeakerMaterial;
};

export const getMaterialsByEvent = async (
  eventId: string,
  supabase: SupabaseClient
): Promise<SpeakerMaterial[]> => {
  const { data, error } = await supabase
    .from('speaker_materials')
    .select('*, sessions!inner(event_id)')
    .eq('sessions.event_id', eventId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch materials: ${error.message}`);
  return (data ?? []).map((d: any) => ({ ...d, session_id: d.session_id })) as SpeakerMaterial[];
};

export const getMaterialsBySession = async (
  sessionId: string,
  supabase: SupabaseClient
): Promise<SpeakerMaterial[]> => {
  const { data, error } = await supabase
    .from('speaker_materials')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch materials: ${error.message}`);
  return (data ?? []) as SpeakerMaterial[];
};

export const deleteMaterial = async (
  id: string,
  supabase: SupabaseClient
): Promise<void> => {
  const { error } = await supabase.from('speaker_materials').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete material: ${error.message}`);
};

export const getMaterialById = async (
  id: string,
  supabase: SupabaseClient
): Promise<SpeakerMaterial | null> => {
  const { data, error } = await supabase
    .from('speaker_materials')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;
  return data as SpeakerMaterial;
};

// ============================================
// GET DOWNLOAD URL (R2 signed URL)
// ============================================

export const getDownloadUrl = async (
  materialId: string,
  supabase: SupabaseClient,
  storage: R2Bucket
): Promise<{ url: string; file_name: string }> => {
  const material = await getMaterialById(materialId, supabase);
  if (!material) {
    throw new Error('Material not found');
  }

  // Extract R2 key from file_url (format: /api/uploads/<key> or direct key)
  const fileUrl = material.file_url;
  const key = fileUrl.startsWith('/api/uploads/')
    ? fileUrl.replace('/api/uploads/', '')
    : fileUrl;

  // Use R2 head+get approach: return a proxy URL that streams from R2
  // In production, use @aws-sdk/s3-request-presigner for true pre-signed URLs
  const object = await storage.get(key);
  if (!object) {
    throw new Error('File not found in storage');
  }

  // Return the direct URL — for R2 public bucket or use a signed proxy
  // For private files, generate a temporary signed URL via the download endpoint
  return {
    url: `/api/materials/${materialId}/file`,
    file_name: material.file_name,
  };
};

// ============================================
// STREAM FILE FROM R2
// ============================================

export const streamMaterialFile = async (
  materialId: string,
  supabase: SupabaseClient,
  storage: R2Bucket
): Promise<{ body: ReadableStream; contentType: string; fileName: string } | null> => {
  const material = await getMaterialById(materialId, supabase);
  if (!material) return null;

  const fileUrl = material.file_url;
  const key = fileUrl.startsWith('/api/uploads/')
    ? fileUrl.replace('/api/uploads/', '')
    : fileUrl;

  const object = await storage.get(key);
  if (!object) return null;

  const contentTypeMap: Record<string, string> = {
    pdf: 'application/pdf',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    png: 'image/png',
    jpg: 'image/jpeg',
  };

  return {
    body: object.body,
    contentType: contentTypeMap[material.file_type] || 'application/octet-stream',
    fileName: material.file_name,
  };
};
