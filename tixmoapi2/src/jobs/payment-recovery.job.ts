import { paymentService } from '../api/payments/service';
import { logger } from '../config/logger';
let timer: ReturnType<typeof setInterval> | null = null;
let running = false;
export function startPaymentRecoveryJob(): void {
  if (timer) return;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await paymentService.recoverPayments();
    } catch (error) {
      logger.error('Payment recovery failed', error);
    } finally {
      running = false;
    }
  };
  void run();
  timer = setInterval(() => void run(), 60_000);
}
export function stopPaymentRecoveryJob(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
