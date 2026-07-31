import React, { useState, useEffect, useCallback } from 'react';
import QRCodeLib from 'qrcode';

// ============================================
// TYPES
// ============================================

interface QRCodeDisplayProps {
  token: string;
  size?: number;
  format?: 'svg' | 'png';
  showDownload?: boolean;
  registrationId?: string;
}

// ============================================
// QR CODE DISPLAY COMPONENT
// ============================================

const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({
  token,
  size = 256,
  format = 'svg',
  showDownload = true,
  registrationId,
}) => {
  const [qrSvg, setQrSvg] = useState<string>('');
  const [qrPngUrl, setQrPngUrl] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const generate = async () => {
      try {
        setError(null);
        if (format === 'svg') {
          const svgStr = await QRCodeLib.toString(token, {
            type: 'svg',
            errorCorrectionLevel: 'M',
            margin: 2,
            width: size,
          });
          setQrSvg(svgStr);
        } else {
          const dataUrl = await QRCodeLib.toDataURL(token, {
            errorCorrectionLevel: 'M',
            margin: 2,
            width: size,
            type: 'image/png',
          });
          setQrPngUrl(dataUrl);
        }
      } catch (err) {
        setError('QRコードの生成に失敗しました');
        console.error(err);
      }
    };
    generate();
  }, [token, size, format]);

  const handleDownload = useCallback(async () => {
    try {
      const pngDataUrl = await QRCodeLib.toDataURL(token, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 512,
        type: 'image/png',
      });
      const link = document.createElement('a');
      link.download = registrationId ? `qr-${registrationId}.png` : 'qr-code.png';
      link.href = pngDataUrl;
      link.click();
    } catch (err) {
      console.error('Download failed:', err);
    }
  }, [token, registrationId]);

  if (error) {
    return (
      <div
        className="flex items-center justify-center p-4 rounded-sm"
        style={{
          border: '1px solid var(--color-border-default)',
          backgroundColor: 'var(--color-surface-elevated)',
          color: 'var(--color-danger)',
        }}
      >
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-center gap-4 p-6 rounded-sm"
      style={{
        backgroundColor: 'var(--color-surface-elevated)',
        border: '1px solid var(--color-border-default)',
      }}
    >
      {/* QR Code */}
      <div
        className="flex items-center justify-center p-4 rounded-sm"
        style={{
          backgroundColor: 'var(--color-surface-base)',
          border: '1px solid var(--color-border-default)',
        }}
      >
        {format === 'svg' && qrSvg ? (
          <div
            style={{ width: size, height: size }}
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
        ) : qrPngUrl ? (
          <img
            src={qrPngUrl}
            alt="QR Code"
            style={{ width: size, height: size }}
          />
        ) : (
          <div
            style={{
              width: size,
              height: size,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text-secondary)',
            }}
          >
            生成中...
          </div>
        )}
      </div>

      {/* Token display */}
      <p
        className="text-xs font-mono text-center break-all"
        style={{ color: 'var(--color-text-secondary)', maxWidth: size + 32 }}
      >
        Token: {token}
      </p>

      {/* Download button */}
      {showDownload && (
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-sm transition-colors"
          style={{
            backgroundColor: 'var(--color-accent-blue)',
            color: 'var(--color-text-on-accent, #fff)',
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLButtonElement).style.opacity = '0.9';
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLButtonElement).style.opacity = '1';
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          QRコードをダウンロード
        </button>
      )}
    </div>
  );
};

export default QRCodeDisplay;
