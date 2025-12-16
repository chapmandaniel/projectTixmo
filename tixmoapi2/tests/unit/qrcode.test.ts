import {
  generateQRCode,
  generateTicketQRData,
  parseTicketQRData,
  isValidTicketQRData,
} from '../../src/utils/qrcode';

describe('QR Code Utilities', () => {
  describe('generateQRCode', () => {
    it('should generate a QR code data URL', async () => {
      const data = 'TEST:12345:BARCODE:EVENT123';
      const qrCode = await generateQRCode(data);

      expect(qrCode).toBeDefined();
      expect(qrCode).toContain('data:image/png;base64');
    });

    it('should generate QR code with custom options', async () => {
      const data = 'TEST:12345:BARCODE:EVENT123';
      const qrCode = await generateQRCode(data, {
        errorCorrectionLevel: 'L',
        width: 200,
        margin: 3,
      });

      expect(qrCode).toBeDefined();
      expect(qrCode).toContain('data:image/png;base64');
    });
  });

  describe('generateTicketQRData', () => {
    it('should generate ticket QR data in correct format', () => {
      const ticketId = '123e4567-e89b-12d3-a456-426614174000';
      const barcode = 'TIX-1234567890-ABC';
      const eventId = '987e6543-e21b-98d7-a654-321987654321';

      const qrData = generateTicketQRData(ticketId, barcode, eventId);

      expect(qrData).toBe(
        'TICKET:123e4567-e89b-12d3-a456-426614174000:TIX-1234567890-ABC:987e6543-e21b-98d7-a654-321987654321'
      );
    });
  });

  describe('parseTicketQRData', () => {
    it('should parse valid ticket QR data', () => {
      const qrData =
        'TICKET:123e4567-e89b-12d3-a456-426614174000:TIX-1234567890-ABC:987e6543-e21b-98d7-a654-321987654321';

      const parsed = parseTicketQRData(qrData);

      expect(parsed).toEqual({
        ticketId: '123e4567-e89b-12d3-a456-426614174000',
        barcode: 'TIX-1234567890-ABC',
        eventId: '987e6543-e21b-98d7-a654-321987654321',
      });
    });

    it('should return null for invalid QR data format', () => {
      const invalidData = 'INVALID:DATA:FORMAT';

      const parsed = parseTicketQRData(invalidData);

      expect(parsed).toBeNull();
    });

    it('should return null for wrong prefix', () => {
      const invalidData = 'ORDER:123:BARCODE:EVENT';

      const parsed = parseTicketQRData(invalidData);

      expect(parsed).toBeNull();
    });

    it('should return null for incomplete data', () => {
      const invalidData = 'TICKET:123:BARCODE';

      const parsed = parseTicketQRData(invalidData);

      expect(parsed).toBeNull();
    });
  });

  describe('isValidTicketQRData', () => {
    it('should return true for valid ticket QR data', () => {
      const qrData = 'TICKET:123:BARCODE:EVENT';

      expect(isValidTicketQRData(qrData)).toBe(true);
    });

    it('should return false for invalid ticket QR data', () => {
      const invalidData = 'INVALID:DATA';

      expect(isValidTicketQRData(invalidData)).toBe(false);
    });
  });
});
