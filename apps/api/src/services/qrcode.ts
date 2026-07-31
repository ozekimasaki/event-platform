import QRCode from 'qrcode';
import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================
// GENERATE QR CODE SVG
// ============================================

export const generateQRCodeSVG = async (token: string): Promise<string> => {
  return QRCode.toString(token, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 256,
  });
};

// ============================================
// GENERATE QR CODE PNG
// ============================================

export const generateQRCodePNG = async (token: string): Promise<Buffer> => {
  return QRCode.toBuffer(token, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 256,
    type: 'png',
  });
};

// ============================================
// GET QR CODE FOR REGISTRATION
// ============================================

export interface QRCodeResult {
  token: string;
  svg?: string;
  png?: Buffer;
}

export const getQRCodeForRegistration = async (
  registrationId: string,
  supabase: SupabaseClient,
  format: 'svg' | 'png' = 'svg'
): Promise<QRCodeResult> => {
  // 1. Get registration's qr_code_token
  const { data: registration, error } = await supabase
    .from('registrations')
    .select('qr_token')
    .eq('id', registrationId)
    .single();

  if (error || !registration) {
    throw new Error('Registration not found');
  }

  const token = registration.qr_token;

  // 2. Generate QR code in requested format
  if (format === 'svg') {
    const svg = await generateQRCodeSVG(token);
    return { token, svg };
  } else {
    const png = await generateQRCodePNG(token);
    return { token, png };
  }
};
