# Task554: conditional zero-new-spend encrypted PG18 recovery packet

2026-10-22; author tixmo-release; baseline395cafb7. **Preparation only; NOT an executable authorization or completed recovery proof.** Authorities: BB231-520-20261022-LOCAL-RECOVERY-PATH and subsequent RECOVERY-CAPABILITY-CHECKS. Parent231 routes this packet to the existing proxy; no new Daniel question. Independent review pending.

## Existing solutions and actual capability evidence

Read target receipts TASK_231_RAILWAY_LIVE_EVIDENCE and TASK_231_WIRING_LEDGER_RECOVERY, backup/rollback runbook, team roles/workflow, task276 harness and independent task278 board evidence. Prefer native PostgreSQL18.6 custom archive and GnuPG, not a new backup service. Do NOT run the276/278 fixture harness on real data: it retains plaintext disk artifacts, starts Redis unnecessarily, and is only synthetic data-shape evidence. Railway reports no backups/schedules; this logical path does not waive the runbook's provider-backup/schedule requirements.

Actual target PG18.6, aggregate10,368,703 bytes;31 applied migration hashes match parent display comparison, sole pending20261021120000_event_sales_pause. Size is not dump size, source-load or RTO proof. No new target/credential/provider call made here.

Bounded read-only local checks:

- Known task57 cache pg_restore help works with its extracted library path. Earlier target receipt establishes pg_dump/restore18.6. Initial direct help failed missing libpq; explicit LD_LIBRARY_PATH repaired only that command, no config mutation.
- Root ext4 directly /dev/nvme0n1p2,160GiB free; task57 runtime0700 ownerdaniel. Neither is encryption/custody proof.
- `/dev/shm` tmpfs7.5GiB; MemAvailable8,677,480kB at check. `/proc/swaps` shows active `/swap.img`, size4,194,300kB, used4,170,844kB. Encryption of swap is UNKNOWN. **tmpfs can swap: do not use it for plaintext recovery on this evidence.** Available RAM is not a reserved allocation, and database aggregate does not bound restore/WAL/temp peak.
- Shell core limit0; core_pattern routes to apport. Execution must set core soft+hard0 and prove inherited limits; this is not evidence that all daemon dump handling is safe.
- gpg/unshare/setpriv/systemd-run/prlimit/timeout installed; bwrap absent per parent. No existing keyring inspected or actual custody reference found in bounded relevant docs. Subsequent explicitly authorized nonsecret throwaway-key mechanics test passed (appendix); it does not prove actual recipient custody or safe storage.
- One non-data probe `unshare --user --map-root-user --net --mount --pid --fork true` FAILED `uid_map: Operation not permitted`; flag unprivileged_userns_clone is1 but not sufficient. Parent then relayed existing432 same-host denials and STOP instruction: **no repeat or alternate/privileged probe performed**. No sockets/daemon control queried. Unix-socket-only Postgres is ingress reduction, NOT SQL process/egress containment.

## Concrete storage, custody, retention and cost contract

Proposed archive: stream custom pg_dump directly to GPG public-key encryption, no raw archive or SQL on disk. Custodian must supply an already-authorized public recipient file and independently verified full fingerprint, identify actual decryption custodian and recovery access path (not private-key material), and acknowledge restricted directory and deletion duties. Use a NEW0700 dedicated archive directory with0600 encrypted file, outside git/cloud-sync/web roots and ordinary backup indexing. Existing ext4 may hold ciphertext only after that directory allocation is approved. Never use current HOME keyring implicitly or auto-fetch keys.

Restore data, WAL, temp files, logs and credential material require an **existing verified encrypted filesystem with approved key custody**, or verified nonswappable bounded RAM allocation. Neither exists in supplied evidence. A new0700 ext4 directory, tmpfs with current swap, GPG on the archive alone, deleting a plaintext file afterward, or a test key are NOT acceptable substitutes. No new mount, swap/config changes or volume provisioning authorized.

Rehearsal-only proposed retention: delete local decrypted cluster/logs immediately after approved sanitized acceptance and exact-owned shutdown; retain encrypted rehearsal archive at most24h from capture, then delete per custodian receipt. Failed partial ciphertext gets no recovery-valid label and same maximum retention. **A pre-migration restore point is separate:** retain through approved rollback window and durable verified successor; owner must name period/legal holds. Never auto-expire the sole restore point by applying the rehearsal24h policy. Encryption key lifetime/recovery must cover authorized retention. Unlink is not guaranteed media erasure on ext4/SSD; rely on verified encryption/key lifecycle, not shred claims.

Railway public pricing fetched2026-10-22: https://docs.railway.com/pricing/plans lists egress$0.05/GB, CPU$20/vCPU-month and RAM$10/GB-month. Thus local execution is NOT inherently zero incremental bill: source scanning and proxy egress are metered. Existing plan/included credits/current utilization/headroom/allocation were NOT inspected here, so zero-new-spend remains UNPROVEN. The10MB catalog aggregate is not a byte or cost cap. Proxy needs an existing-account tariff/remaining-credit/headroom receipt and accountable allocation proving bounded incremental use fits already-paid capacity; otherwise refuse this zero-spend path, not assume a tiny charge is approved. No new paid resources, installs or downloads.

## Exact conditional native command plan (DO NOT RUN under current grant)

All placeholders below require reviewed values/receipts, not inferred consent. Source command runs in a scrubbed, approved credential-injection wrapper: no secrets in argv, stdout, shell history, git, trace, or persistent unencrypted files. Existing wrapper must be independently reviewed before use. `SRC_SERVICE` is a nonsecret libpq service alias whose approved credential source supplies exact target identity, SSL verification/CA, host/database/user, connect_timeout5; never embed a URL. Wrapper must explicitly allowlist environment, unset inherited PG*/database/Redis/cloud vars before injecting approved source configuration, and disable tracing. TLS verify-full is preferred; inability to verify server identity is a stop condition, not permission to weaken TLS.

```bash
# Inside reviewed scrubbed source wrapper; proposed limits require owner approval.
set -euo pipefail
umask 077
ulimit -S -c 0
ulimit -H -c 0
pgroot=/home/daniel/projects/projectTixmo/worktrees/task-57/.local-runtime-57/root
pgbin="$pgroot/usr/lib/postgresql/18/bin"
export LD_LIBRARY_PATH="$pgroot/usr/lib/x86_64-linux-gnu"
# ARCHIVE_DIR: approved NEW0700 allocation; GPG_HOME: NEW0700 empty keyring.
# RECIPIENT_FILE: nonsecret public key; FPR: independently matched full fingerprint.
# Import ONLY reviewed recipient key; no private key generation or network lookup.
gpg --homedir "$GPG_HOME" --batch --no-auto-key-retrieve --import "$RECIPIENT_FILE"
# Independently compare --with-colons --fingerprint output to approved FPR first.
# PARTIAL must be a NEW path; noclobber rejects an existing output.
set -o noclobber
export PGCONNECT_TIMEOUT=5
export PGAPPNAME=tixmo231_recovery_capture
export PGOPTIONS='-c statement_timeout=120000 -c lock_timeout=2000 -c idle_in_transaction_session_timeout=150000 -c default_transaction_read_only=on'
timeout --signal=TERM --kill-after=5s 180s bash -o pipefail -c '
  "$1/pg_dump" --dbname="service=$2" --no-password \
    --format=custom --compress=1 --no-owner --no-privileges \
    --lock-wait-timeout=2s |
  gpg --homedir "$3" --batch --no-auto-key-retrieve --trust-model always \
    --recipient "$4" --encrypt
' _ "$pgbin" "$SRC_SERVICE" "$GPG_HOME" "$FPR" > "$PARTIAL" 2> "$SECURE_LOG"
# ONLY exit0 with nonempty ciphertext and independently confirmed pipeline success
# may be renamed to an equally NEW final path. Capture ciphertext SHA256 + UTC
# start/end/exit status to sanitized receipt; no raw SQL/TOC/error output in git.
```

pg_dump provides its native consistent snapshot, one job/one connection, read-only transaction; this is not a global-role/tablespace backup, PITR or a write freeze. No parallel dump/retries, migration/lock probing or active-source row scans added. Record snapshot/capture interval; source writes after snapshot require separate replay/forward-fix disposition. Before execution owner must accept120s statement/180s wall limits, source baseline/observer and abort thresholds; statement_timeout is per statement, outer timeout bounds pipeline. SQL errors may contain private data: SECURE_LOG must be on verified secure storage, not current ext4. Output size must be supervised with an approved hard cap and free-space budget; until that cap/implementation is reviewed, do not run this template.

**Restore phase is a different process and credential domain, with NO source credentials inherited.** Native NEW cluster using cached18.6 only inside independently approved, already-available containment: no network interfaces/egress, private PID/mount view, no host HOME/credentials, read-only binaries, writable paths ONLY secure run storage, bounded CPU/RAM/PIDs/disk/time and exact-owned lifecycle. Restored SQL can execute functions/programs as its server OS user; socket-only or PG roles alone cannot confine hostile SQL. Current namespace denial blocks this phase. Do not attempt a new namespace/systemd/sudo/daemon path without new authorization and demonstrated existing capability.

The following is the exact PG command sequence **inside that not-yet-available boundary**, NOT a host-shell fallback:

```bash
# Fresh reviewed env-i restore context, approved encrypted RUN, private GPG decrypt
# custody mechanism; no production environment, no app/Redis/HTTP processes.
umask 077
ulimit -S -c 0
ulimit -H -c 0
# RUN is a newly created0700 directory; PGDATA must not already exist.
"$pgbin/initdb" -D "$RUN/pg" -L "$pgroot/usr/share/postgresql/18" \
  --auth-local=trust --auth-host=reject --username=tixmo_recovery \
  --encoding=UTF8 --no-locale > "$RUN/init.log" 2>&1
"$pgbin/pg_ctl" -D "$RUN/pg" -l "$RUN/postgres.log" -w -t 10 \
  -o "-c listen_addresses='' -c unix_socket_directories='$RUN' -c unix_socket_permissions=0700 -c max_connections=5 -c shared_buffers=64MB -c work_mem=4MB -c maintenance_work_mem=64MB -c temp_file_limit=262144 -c log_statement=none -c log_min_error_statement=panic" start
# Assert pid/executable/datadir UID match owned cluster, no TCP listener,
# private namespace identity and socket0700 BEFORE connection. Abort if not.
"$pgbin/createdb" -h "$RUN" -U tixmo_recovery -T template0 tixmo_recovery_231
# createdb must fail on collision: no reusing destination and no drop/clean.
# Assert current_database/user, server_version_num18, empty public schema.
# Custodian decrypts archive through reviewed dedicated key context, pipe ONLY.
# decrypt-approved is a required custody interface, NOT an installed command.
set -o pipefail
timeout --signal=TERM --kill-after=5s 180s bash -o pipefail -c '
  decrypt-approved "$1" |
  "$2/pg_restore" --host="$3" --username=tixmo_recovery \
    --dbname=tixmo_recovery_231 --no-password --exit-on-error \
    --single-transaction --no-owner --no-privileges
' _ "$ARCHIVE" "$pgbin" "$RUN" > "$RUN/restore.log" 2>&1
```

`decrypt-approved` deliberately prevents pretending known key custody; exact approved gpg decryption command/agent interaction remains required before independent execution review. No plaintext archive, --clean, --create, overwrite, disable-triggers or source restore. Set restore PGOPTIONS statement_timeout120s/lock_timeout2s in its isolated context. Cluster init locale/encoding/collation/extensions must match approved source catalog receipt; UTF8/no-locale above is conditional and MUST change if source differs. No downloading extensions or executing unknown restored hooks outside confinement.

## Acceptance, stop, cleanup and owner acknowledgements

Before capture: proxy operational grant explicitly covering real-data transfer/restore, exact IDs from231, start/end window, source observer/load thresholds, byte/resource caps, operator + independent second reviewer, approved encryption recipient/storage/custody, retention, verified containment and existing-cost allocation. tixmo-release acknowledges **preparation availability only**; no human/operator consent or execution acknowledgement is implied.

Stop immediately on identity/TLS mismatch, expired permission/window, lock/statement/wall deadline, source health/load threshold, resource/free-space cap, encryption failure, any unexpected network/listener/host write, incomplete archive, restore error or failed acceptance. No automatic retry; partial ciphertext/cluster remain restricted and non-valid pending exact-owned cleanup. Parent retains existing merge/deploy/migration hold.

After approved restore: validate migration ledger/checksums and schema/columns/indexes/constraints against candidate; bounded aggregate counts/inventory/payment/ticket/session invariants and restore integrity without publishing customer rows/hashes. Source31-ledger vs candidate32 is expected; do NOT migrate restored database merely to make equality. Restore cannot prove old-code compatibility, dashboard origin, delivered login/report/scanner/link smoke, RTO/RPO, post-snapshot write preservation or provider schedule coverage. Those remain separate authorized tests/acceptance gates.

Cleanup trap must be independently reviewed before executable script: on EXIT/INT/TERM stop ONLY PID whose UID/exe/datadir/postmaster.pid match this RUN with `pg_ctl -D "$RUN/pg" -m fast -w -t 10 stop`; owned-only TERM then bounded KILL if necessary, never signal unrelated/reused PID. Verify server absent, socket/listeners gone, no child remains, then remove only exact-owned decrypted cluster/logs under secure RUN under approved deletion policy. No source teardown. On cleanup failure halt the lane and record restrictive leftovers, never mark pass or launch another run. Capture sanitized timings including capture, startup, restore, acceptance and cleanup; no fixture timing extrapolation.

Required packet returns: (1) recipient fingerprint/custodian/recovery/deletion acknowledgements; (2) approved encrypted data+log allocation or truly nonswappable RAM proof; (3) usable existing native containment proof independent of denied user namespaces; (4) source load/byte/resource/window/RTO/RPO accepted limits; (5) existing-account billing/headroom allocation proving zero-new-spend; (6) independent exact-command/wrapper review and explicit operational grant. **All six presently OPEN.** No dump/restore/production-data copy/production-key creation/server start/install/provision/config change/push/merge/deploy performed. Only an explicitly approved throwaway TEST key was generated and immediately cleaned up, as below.

Checks for this documentation: pg_restore help only; bounded RAM/swap/mount/core/tool checks; public pricing fetch; git diff --check. No fixture or application tests appropriate to docs-only packet. Author submits review; this is not a reviewed execution plan until independent reviewer clears an exact commit.


## Follow-up: bounded nonsecret GPG mechanics test

Authority: parent relayed proxy's explicit additional authorization on same554, <=60s, <=64KiB nonsecret input, NEW0700 isolated test-only GNUPGHOME, no existing keyring/network/private outputs; no namespace/server/real data. Exact script below was written, inspected via sed, and Python syntax checked BEFORE execution. Execution command: `timeout --signal=TERM --kill-after=3s 60s python3 /tmp/tixmo554-gpg-mechanics.py`; exit0. GnuPG2.4.8. Actual result: PASS, input64 bytes; nonempty ciphertext; decrypt byte comparison and SHA256 equality true; existing keyring false, real data false; own-home `gpgconf --kill gpg-agent` returned success; test directory absent after cleanup; elapsed0.130s. No key/fingerprint/private output printed; data/cipher/plain comparison stayed in memory. TEST private material existed only in new0700 throwaway directory and was immediately removed. This is mechanics evidence only, not production key custody, approved retention/storage, unswappable memory, independent crypto review or containment acceptance. No test key retained; retention effectively immediate, within24h.

Existing-account billing verification was separately authorized but NOT attempted: inspected current231 wrapper exposes only wiring/catalog queries and lacks a reviewed billing schema/allowlist/account-identity mapping. Do not improvise raw account/config/credential output or claim public tariff establishes headroom. Required existing-account receipt remains: exact billing account/project relationship, current plan/tariff, included usage/remaining credit and reset time, current/projected usage plus incremental source CPU/RAM/egress allocation and authorized resource caps. No billing/provider calls occurred in this follow-up.

Exact inspected nonsecret mechanics script (not a production encryption wrapper):

```python
# Nonsecret mechanics test only. Never read existing HOME/keyring or use network.
import hashlib,json,os,pathlib,shutil,subprocess,tempfile,time
started=time.monotonic()
root=pathlib.Path(tempfile.mkdtemp(prefix='tixmo554-gpg-test-'))
os.chmod(root,0o700)
env={'PATH':'/usr/bin:/bin','HOME':str(root),'GNUPGHOME':str(root),'LC_ALL':'C'}
base=['gpg','--homedir',str(root),'--batch','--no-auto-key-retrieve']
result={'input_bytes':0,'existing_keyring_used':False,'real_data_used':False}
def run(args,**kw):
 left=50-(time.monotonic()-started)
 if left<=0: raise TimeoutError('test bound')
 p=subprocess.run(args,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=min(left,20),**kw)
 if p.returncode: raise RuntimeError('subcommand failed; raw diagnostics suppressed')
 return p.stdout
try:
 run(base+['--pinentry-mode','loopback','--passphrase','','--quick-generate-key','Tixmo554 nonsecret mechanics test','rsa2048','encr','1d'])
 public=run(base+['--with-colons','--list-keys'])
 fpr=next(line.split(b':')[9].decode('ascii') for line in public.splitlines() if line.startswith(b'fpr:'))
 data=b'Tixmo554 synthetic nonsecret GPG roundtrip, no production data.\n'
 assert len(data)<=65536
 cipher=run(base+['--trust-model','always','--recipient',fpr,'--encrypt'],input=data)
 plain=run(base+['--pinentry-mode','loopback','--passphrase','','--decrypt'],input=cipher)
 assert plain==data
 assert hashlib.sha256(plain).digest()==hashlib.sha256(data).digest()
 result.update({'result':'PASS','input_bytes':len(data),'decrypt_byte_compare':True,'sha256_match':True,'ciphertext_nonempty':bool(cipher)})
except Exception:
 result['result']='FAIL_CLOSED'
finally:
 try:
  # Kill ONLY agent addressed by this brand-new GNUPGHOME, never global agent.
  subprocess.run(['gpgconf','--homedir',str(root),'--kill','gpg-agent'],env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=3,check=True)
  result['own_agent_cleanup']=True
 except Exception:
  result['own_agent_cleanup']=False
 shutil.rmtree(root)
 result['test_directory_absent']=not root.exists()
 result['seconds']=round(time.monotonic()-started,3)
 print(json.dumps(result,sort_keys=True))
 if result.get('result')!='PASS' or not result['own_agent_cleanup'] or not result['test_directory_absent']: raise SystemExit(1)
```
