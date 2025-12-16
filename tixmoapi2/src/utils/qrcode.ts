import QRCode from 'qrcode';
import { ApiError } from './ApiError';

export interface QRCodeOptions {
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  type?: 'image/png' | 'image/jpeg' | 'image/webp';
  quality?: number;
  margin?: number;
  width?: number;
  color?: {
    dark?: string;
    light?: string;
  };
}

/**
 * Generate QR code as a data URL
 */
export async function generateQRCode(data: string, options?: QRCodeOptions): Promise<string> {
  try {
    const qrOptions = {
      errorCorrectionLevel: options?.errorCorrectionLevel || 'H',
      type: options?.type || 'image/png',
      quality: options?.quality || 0.92,
      margin: options?.margin || 1,
      width: options?.width || 300,
      color: {
        dark: options?.color?.dark || '#000000',
        light: options?.color?.light || '#FFFFFF',
      },
    };

    const dataUrl = await QRCode.toDataURL(data, qrOptions);
    return dataUrl;
  } catch (error) {
    throw ApiError.internal(
      `Failed to generate QR code: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Generate QR code as a buffer (for file storage)
 */
export async function generateQRCodeBuffer(data: string, options?: QRCodeOptions): Promise<Buffer> {
  try {
    const qrOptions = {
      errorCorrectionLevel: options?.errorCorrectionLevel || 'H',
      margin: options?.margin || 1,
      width: options?.width || 300,
      color: {
        dark: options?.color?.dark || '#000000',
        light: options?.color?.light || '#FFFFFF',
      },
    };

    const buffer = await QRCode.toBuffer(data, qrOptions);
    return buffer;
  } catch (error) {
    throw ApiError.internal(
      `Failed to generate QR code buffer: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Generate ticket QR code data string
 * Format: TICKET:{ticketId}:{barcode}:{eventId}
 */
export function generateTicketQRData(ticketId: string, barcode: string, eventId: string): string {
  return `TICKET:${ticketId}:${barcode}:${eventId}`;
}

/**
 * Parse ticket QR code data
 */
export function parseTicketQRData(qrData: string): {
  ticketId: string;
  barcode: string;
  eventId: string;
} | null {
  const parts = qrData.split(':');

  if (parts.length !== 4 || parts[0] !== 'TICKET') {
    return null;
  }

  return {
    ticketId: parts[1],
    barcode: parts[2],
    eventId: parts[3],
  };
}

/**
 * Validate QR code data format
 */
export function isValidTicketQRData(qrData: string): boolean {
  return parseTicketQRData(qrData) !== null;
}
