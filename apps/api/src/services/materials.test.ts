import { describe, it, expect, vi } from 'vitest';
import {
  uploadMaterial,
  getMaterialsByEvent,
  getMaterialsBySession,
  deleteMaterial,
  getMaterialById,
} from './materials.js';

const createMockSupabase = () => {
  const chain: Record<string, any> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn();
  chain.maybeSingle = vi.fn();
  return chain;
};

// ============================================
// uploadMaterial
// ============================================

describe('uploadMaterial', () => {
  it('should upload a material and return it', async () => {
    const mockMaterial = {
      id: 'mat-1',
      session_id: 'sess-1',
      file_name: 'slides.pdf',
      file_url: '/api/uploads/slides-123.pdf',
      file_type: 'pdf',
      access_level: 'public',
      description: 'Presentation slides',
      created_at: '2026-07-31T00:00:00Z',
    };

    const supabase = createMockSupabase();
    supabase.single.mockResolvedValue({ data: mockMaterial, error: null });

    const result = await uploadMaterial(
      {
        session_id: 'sess-1',
        file_name: 'slides.pdf',
        file_url: '/api/uploads/slides-123.pdf',
        file_type: 'pdf',
        access_level: 'public',
        description: 'Presentation slides',
      },
      supabase as any
    );

    expect(result).toEqual(mockMaterial);
    expect(supabase.from).toHaveBeenCalledWith('speaker_materials');
    expect(supabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        session_id: 'sess-1',
        file_name: 'slides.pdf',
        file_type: 'pdf',
        access_level: 'public',
      })
    );
  });

  it('should default access_level to public when not provided', async () => {
    const mockMaterial = {
      id: 'mat-2',
      session_id: 'sess-1',
      file_name: 'notes.pdf',
      file_url: '/api/uploads/notes.pdf',
      file_type: 'pdf',
      access_level: 'public',
      created_at: '2026-07-31T00:00:00Z',
    };

    const supabase = createMockSupabase();
    supabase.single.mockResolvedValue({ data: mockMaterial, error: null });

    await uploadMaterial(
      {
        session_id: 'sess-1',
        file_name: 'notes.pdf',
        file_url: '/api/uploads/notes.pdf',
        file_type: 'pdf',
      },
      supabase as any
    );

    expect(supabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({ access_level: 'public' })
    );
  });

  it('should throw when insert fails', async () => {
    const supabase = createMockSupabase();
    supabase.single.mockResolvedValue({
      data: null,
      error: { message: 'storage quota exceeded' },
    });

    await expect(
      uploadMaterial(
        {
          session_id: 'sess-1',
          file_name: 'big.pptx',
          file_url: '/api/uploads/big.pptx',
          file_type: 'pptx',
        },
        supabase as any
      )
    ).rejects.toThrow('Failed to upload material');
  });
});

// ============================================
// getMaterialsByEvent
// ============================================

describe('getMaterialsByEvent', () => {
  it('should return materials for a given event', async () => {
    const mockMaterials = [
      { id: 'mat-1', session_id: 'sess-1', file_name: 'slides.pdf', sessions: { event_id: 'evt-1' } },
      { id: 'mat-2', session_id: 'sess-2', file_name: 'notes.pdf', sessions: { event_id: 'evt-1' } },
    ];

    const supabase = createMockSupabase();
    supabase.order.mockResolvedValue({ data: mockMaterials, error: null });

    const result = await getMaterialsByEvent('evt-1', supabase as any);

    expect(result).toHaveLength(2);
    expect(result[0].file_name).toBe('slides.pdf');
  });

  it('should return empty array when no materials exist', async () => {
    const supabase = createMockSupabase();
    supabase.order.mockResolvedValue({ data: [], error: null });

    const result = await getMaterialsByEvent('evt-no-materials', supabase as any);
    expect(result).toEqual([]);
  });

  it('should throw on database error', async () => {
    const supabase = createMockSupabase();
    supabase.order.mockResolvedValue({ data: null, error: { message: 'relation does not exist' } });

    await expect(getMaterialsByEvent('evt-1', supabase as any)).rejects.toThrow('Failed to fetch materials');
  });
});

// ============================================
// getMaterialsBySession
// ============================================

describe('getMaterialsBySession', () => {
  it('should return materials filtered by session_id', async () => {
    const mockMaterials = [
      { id: 'mat-1', session_id: 'sess-1', file_name: 'slides.pdf' },
    ];

    const supabase = createMockSupabase();
    supabase.order.mockResolvedValue({ data: mockMaterials, error: null });

    const result = await getMaterialsBySession('sess-1', supabase as any);

    expect(result).toHaveLength(1);
    expect(result[0].session_id).toBe('sess-1');
  });

  it('should throw on database error', async () => {
    const supabase = createMockSupabase();
    supabase.order.mockResolvedValue({ data: null, error: { message: 'DB error' } });

    await expect(getMaterialsBySession('sess-1', supabase as any)).rejects.toThrow('Failed to fetch materials');
  });
});

// ============================================
// getMaterialById
// ============================================

describe('getMaterialById', () => {
  it('should return a material when found', async () => {
    const mockMaterial = { id: 'mat-1', file_name: 'slides.pdf', session_id: 'sess-1' };
    const supabase = createMockSupabase();
    supabase.single.mockResolvedValue({ data: mockMaterial, error: null });

    const result = await getMaterialById('mat-1', supabase as any);
    expect(result).toEqual(mockMaterial);
  });

  it('should return null when not found', async () => {
    const supabase = createMockSupabase();
    supabase.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });

    const result = await getMaterialById('mat-x', supabase as any);
    expect(result).toBeNull();
  });
});

// ============================================
// deleteMaterial
// ============================================

describe('deleteMaterial', () => {
  it('should delete a material by id', async () => {
    const supabase = createMockSupabase();
    supabase.eq.mockResolvedValue({ data: null, error: null });

    await deleteMaterial('mat-1', supabase as any);

    expect(supabase.from).toHaveBeenCalledWith('speaker_materials');
    expect(supabase.delete).toHaveBeenCalled();
    expect(supabase.eq).toHaveBeenCalledWith('id', 'mat-1');
  });

  it('should throw when delete fails', async () => {
    const supabase = createMockSupabase();
    supabase.eq.mockResolvedValue({ data: null, error: { message: 'not found' } });

    await expect(deleteMaterial('mat-x', supabase as any)).rejects.toThrow('Failed to delete material');
  });
});
