export interface SpeakerMaterial {
  id: string;
  session_id: string;
  file_name: string;
  file_url: string;
  file_type: 'pdf' | 'ppt' | 'pptx' | 'png' | 'jpg';
  access_level: 'public' | 'participants_only';
  description?: string;
  created_at: string;
}

export interface MaterialUploadRequest {
  session_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  access_level?: string;
  description?: string;
}
