#!/usr/bin/env python3
"""Import only missing branch refs from the pinned, verified local-history bundle."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess

ARCHIVE = Path('docs/development-archive/2026-10-25')
MANIFEST_HASH = '763069c4e3cb27ce8b5b05c46f5a37425088c36d00d82bdeb814bec8b469e4d6'
BUNDLE_HASH = 'dc0a8377db99a1146d05a800fb677166cccd09d5bd876a9e661f0b43423f587b'
REPOSITORY = 'chapmandaniel/projectTixmo'
CONTROL_REF = 'refs/heads/codex/import-local-development-20261025'
PREFIX = 'refs/heads/archive/local-20261025/'
SHA = re.compile(r'[0-9a-f]{40}')


def git(*args, check=True):
    return subprocess.run(['git', '-c', 'core.hooksPath=/dev/null', *args],
                          check=check, capture_output=True, text=True, timeout=180,
                          env={**os.environ, 'GIT_TERMINAL_PROMPT': '0'})


def remote_heads(remote):
    rows = git('ls-remote', '--heads', remote).stdout.splitlines()
    result = {}
    for line in rows:
        sha, ref = line.split()
        if not SHA.fullmatch(sha) or not ref.startswith('refs/heads/') or ref in result:
            raise ValueError('Unexpected remote ref response')
        result[ref] = sha
    return result


def make_plan(manifest, existing):
    if existing.get('refs/heads/main') != manifest['main']:
        raise ValueError('Remote main changed; refusing to import against a stale snapshot')
    wanted = {}
    entries = []
    for item in manifest['branches']:
        ref, sha = item['ref'], item['sha']
        if not ref.startswith('refs/heads/') or not SHA.fullmatch(sha):
            raise ValueError('Invalid manifest ref')
        git('check-ref-format', ref)
        if ref in wanted:
            raise ValueError('Duplicate manifest ref')
        wanted[ref] = sha
        if existing.get(ref) == sha:
            entries.append({'source': ref, 'destination': ref, 'sha': sha, 'action': 'already_present'})
            continue
        if ref == 'refs/heads/main':
            raise ValueError('Main must never be created or updated by this import')
        destination = ref if ref not in existing else PREFIX + ref.removeprefix('refs/heads/')
        git('check-ref-format', destination)
        if destination in existing and existing[destination] != sha:
            raise ValueError('Historical destination already contains different work')
        entries.append({'source': ref, 'destination': destination, 'sha': sha,
                        'action': 'already_present' if destination in existing else 'create'})
    if len(entries) != manifest['branch_count']:
        raise ValueError('Manifest branch count mismatch')
    destinations = [e['destination'] for e in entries]
    if len(set(destinations)) != len(destinations):
        raise ValueError('Import destination collision')
    return entries


def run(remote, apply):
    if remote != 'origin' and not (Path(remote).is_absolute() and Path(remote).is_dir()):
        raise ValueError('Only origin or an existing local test repository is supported')
    if os.environ.get('GITHUB_ACTIONS') == 'true':
        if (os.environ.get('GITHUB_REPOSITORY') != REPOSITORY
                or os.environ.get('GITHUB_REF') != CONTROL_REF or remote != 'origin'):
            raise ValueError('Unexpected workflow repository, ref, or remote')
        url = git('remote', 'get-url', 'origin').stdout.strip()
        if url not in ('https://github.com/' + REPOSITORY,
                       'https://github.com/' + REPOSITORY + '.git'):
            raise ValueError('Unexpected origin URL')
    raw = (ARCHIVE / 'manifest.json').read_bytes()
    if hashlib.sha256(raw).hexdigest() != MANIFEST_HASH:
        raise ValueError('Manifest checksum mismatch')
    manifest = json.loads(raw)
    bundle = ARCHIVE / 'unpublished-development.bundle'
    if hashlib.sha256(bundle.read_bytes()).hexdigest() != BUNDLE_HASH:
        raise ValueError('Bundle checksum mismatch')
    git('bundle', 'verify', str(bundle))
    before = remote_heads(remote)
    plan = make_plan(manifest, before)
    pending = [e for e in plan if e['action'] == 'create']
    pending.sort(key=lambda e: e['sha'] != manifest['main'])
    print(json.dumps({'phase': 'plan', 'snapshotBranches': len(plan),
                      'alreadyPresent': len(plan) - len(pending),
                      'createOnly': len(pending),
                      'historicalAliases': sum(e['destination'].startswith(PREFIX) for e in plan)}), flush=True)
    if not apply:
        return
    git('fetch', '--no-tags', str(bundle), 'refs/heads/*:refs/remotes/local-history/*')
    for e in plan:
        if git('rev-parse', e['sha'] + '^{commit}').stdout.strip() != e['sha']:
            raise ValueError('Source commit unavailable')
    if pending:
        # Start with one ref, then bounded batches. A 521-ref bulk GitHub push
        # exceeded 180 seconds before publishing any refs. Each batch has its
        # own timeout and is checked against the server before moving on.
        batches = [pending[:1]] + [pending[i:i + 25] for i in range(1, len(pending), 25)]
        for number, batch in enumerate(batches, 1):
            # Empty expected values make these create-only leases. Even a
            # concurrent fast-forwardable ref creation cannot be overwritten.
            leases = ['--force-with-lease=' + e['destination'] + ':' for e in batch]
            specs = [e['sha'] + ':' + e['destination'] for e in batch]
            try:
                pushed = git('push', '--porcelain', *leases, remote, *specs, check=False)
                reason = 'accepted' if pushed.returncode == 0 else 'server_refusal'
                if 'workflow' in pushed.stderr.lower() and 'permission' in pushed.stderr.lower():
                    reason = 'workflow_permission_required'
                if pushed.returncode:
                    # GitHub masks its job token too; additionally remove URLs,
                    # authorization lines and long credential-shaped strings.
                    diagnostic = re.sub(r'(?im)^.*authorization.*$', '[authorization redacted]', pushed.stderr)
                    diagnostic = re.sub(r'https?://\S+', '[url]', diagnostic)
                    diagnostic = re.sub(r'[A-Za-z0-9_/+=.\-]{32,}', '[long identifier]', diagnostic)
                    print(json.dumps({'phase': 'push-diagnostic',
                                      'message': diagnostic[-2000:]}), flush=True)
            except subprocess.TimeoutExpired:
                reason = 'push_timeout'
            observed = remote_heads(remote)
            matches = sum(observed.get(e['destination']) == e['sha'] for e in batch)
            print(json.dumps({'phase': 'push-batch', 'batch': number,
                              'attempted': len(batch), 'verified': matches,
                              'result': reason}), flush=True)
            if matches != len(batch):
                break
    after = remote_heads(remote)
    for ref, sha in before.items():
        if after.get(ref) != sha:
            raise ValueError('Pre-existing remote ref changed during import: ' + ref)
    missing = [e for e in plan if after.get(e['destination']) != e['sha']]
    summary = {'phase': 'verified', 'snapshotBranches': len(plan),
               'exactDestinations': len(plan) - len(missing), 'missing': len(missing),
               'existingRefsPreserved': len(before), 'created': len(pending) - len(missing)}
    Path('local-development-import-result.json').write_text(
        json.dumps({'summary': summary, 'branches': plan, 'missing': missing}, indent=2) + '\n')
    print(json.dumps(summary), flush=True)
    if missing:
        print(json.dumps({'missingDestinations': [e['destination'] for e in missing]}), flush=True)
        raise RuntimeError('Some branch creations were refused; result records the exact remaining refs')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--remote', default='origin')
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    run(args.remote, args.apply)
