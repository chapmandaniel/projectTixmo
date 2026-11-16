import fs from 'fs';

/** CI clears evidence receipts before Jest. Local consecutive runs do not. */
export function clearStaleLocalReceipt(file: string, ciRunIdEnv: string): void {
  if (process.env[ciRunIdEnv]) return;
  if (fs.existsSync(file)) fs.unlinkSync(file);
}
