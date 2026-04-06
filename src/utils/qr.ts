/**
 * Generate QR code as PNG buffer or data URL for reservation ticket.
 * Uses dynamic import so optional dependency does not break build if not installed.
 */

export interface QROptions {
  width?: number;
  margin?: number;
}

let qrCodeModule: typeof import('qrcode') | null = null;

async function getQR(): Promise<typeof import('qrcode')> {
  if (qrCodeModule) return qrCodeModule;
  try {
    qrCodeModule = await import('qrcode');
    return qrCodeModule;
  } catch {
    throw new Error('qrcode package not installed. Run: npm install qrcode @types/qrcode');
  }
}

/**
 * Generate QR code as PNG Buffer.
 */
export async function generateQRBuffer(
  data: string,
  options: QROptions = {}
): Promise<Buffer> {
  const QR = await getQR();
  const { width = 256, margin = 2 } = options;
  return QR.toBuffer(data, { type: 'png', width, margin });
}

/**
 * Generate QR code as Data URL (data:image/png;base64,...) for embedding.
 */
export async function generateQRDataURL(
  data: string,
  options: QROptions = {}
): Promise<string> {
  const QR = await getQR();
  const { width = 256, margin = 2 } = options;
  return QR.toDataURL(data, { type: 'image/png', width, margin });
}
