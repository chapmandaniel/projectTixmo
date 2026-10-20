from pathlib import Path
import sys
p=Path('tixmoapi2/src/api/payments/service.ts');s=p.read_text();mode=sys.argv[1]
if mode=='a':
 a="const EXPIRED_WEBHOOK_RECOVERY_ENABLED = true;";b="const EXPIRED_WEBHOOK_RECOVERY_ENABLED = false;"
elif mode=='d':
 a="attemptGeneration: { increment: 1 }";b="attemptGeneration: { increment: 0 }"
 s=s.replace('generation: existing.attemptGeneration + 1n','generation: existing.attemptGeneration')
else:
 a="""            id: event.id, attemptGeneration: existing.attemptGeneration,
            OR: [{ status: 'FAILED' }, ...(EXPIRED_WEBHOOK_RECOVERY_ENABLED
              ? [{ status: 'PROCESSING', processingStartedAt: { lte: cutoff } }] : [])],""";b="            id: event.id,"
assert s.count(a)==1
p.write_text(s.replace(a,b))
