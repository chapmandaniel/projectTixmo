import { schedulerRefundStore, runWithRefundActor } from '../api/payments/refund-actor';
import { logRefundRecoveryTick } from '../api/payments/refund-finalization-log';
import { paymentService } from '../api/payments/service';
import { logger } from '../config/logger';
let timer: ReturnType<typeof setInterval> | null = null;
let running = false;
export function startPaymentRecoveryJob(): void {
  if (timer) return;
  const run = async (subpath: 'startup' | 'interval') => {
    if (running) return;
    running = true;
    const invocation = schedulerRefundStore(subpath);
    try {
      await runWithRefundActor(invocation, () => paymentService.recoverPayments());
    } catch (error) {
      logger.error('Payment recovery failed', error);
    } finally {
      try {
        logRefundRecoveryTick(invocation);
      } catch {
        // Logging must not leave the overlap guard stuck.
      }
      running = false;
    }
  };
  void run('startup');
  timer = setInterval(() => void run('interval'), 60_000);
}
export function stopPaymentRecoveryJob(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
