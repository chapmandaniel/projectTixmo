"""Inert source contract checks only: never imports app or opens a DB."""
from pathlib import Path
import unittest
ROOT = Path(__file__).resolve().parents[4]
read = lambda p: (ROOT / p).read_text()
S = read('tixmoapi2/src/api/events/service.ts')
C = S[S.index('  async setSalesPause('):S.index('  async updateEvent(')]
O = read('tixmoapi2/src/api/orders/service.ts')
class SourceContract(unittest.TestCase):
    def test_locked_scope_before_replay(self):
        self.assertLess(C.index('FOR UPDATE'), C.index('assertOrganizationAccess'))
        self.assertLess(C.index('assertOrganizationAccess'), C.index('eventSalesControl.findUnique'))
    def test_atomic_evidence_and_flag(self):
        self.assertIn('return prisma.$transaction', C)
        self.assertIn('await tx.eventSalesControl.create', C)
        self.assertIn('await tx.event.update', C)
        self.assertNotIn('catch', C)
    def test_conflicting_replay_and_noop(self):
        for guard in ['prior.actorId !== actor.userId', 'prior.reason !== input.reason', 'prior.afterPaused !== input.paused', 'prior || await', 'beforePaused: event.salesPaused']:
            self.assertIn(guard, C)
    def test_new_order_only(self):
        self.assertEqual(O.count('event.salesPaused'), 1)
        self.assertLess(O.index('FOR UPDATE'), O.index('event.salesPaused'))
        self.assertLess(O.index('event.salesPaused'), O.index('tx.order.create'))
        self.assertIn("{ code: 'SALES_PAUSED' }", O)
        self.assertIn("['PUBLISHED', 'ON_SALE']", O)
    def test_stale_lifecycle_not_written(self):
        U=S[S.index('  async updateEvent('):S.index('  async deleteEvent(')]
        self.assertNotIn('updateData.status =', U)
        self.assertIn('FOR UPDATE', U)
        P=S[S.index('  async publishEvent('):S.index('  async cancelEvent(')]
        self.assertLess(P.index('FOR UPDATE'), P.index('db.event.findUnique'))
    def test_retention_and_no_public_audit(self):
        schema=read('tixmoapi2/prisma/schema.prisma')
        self.assertIn('onDelete: Restrict', schema[schema.index('model EventSalesControl'):])
        self.assertNotIn('salesControls', read('tixmoapi2/src/api/events/public.routes.ts'))
        self.assertIn('salesPaused Boolean @default(false)', schema)
if __name__ == '__main__': unittest.main()
