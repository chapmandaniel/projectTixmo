// Concrete exact-ten local stage executor for a separately admitted owned runtime.
// NOT an openLocal admission adapter: callers must not claim native enforcement.
import { spawnSync } from 'node:child_process';
import { steps } from './market-stages.mjs';
import { snapshot } from './market-composition.mjs';

export function localStageSession({ root, identity, env, capture = snapshot,
  spawn = spawnSync, assertOwnedRuntime, closeOwnedRuntime }) {
  if (typeof assertOwnedRuntime !== 'function' || typeof closeOwnedRuntime !== 'function')
    throw Error('Independent owned-runtime admission and cleanup required');
  const frozenIdentity = structuredClone(identity);
  const childEnv = { ...env };
  let next = 2, stopped = false, busy = false, closing;
  const unchanged = () => {
    if (JSON.stringify(capture(root)) !== JSON.stringify(frozenIdentity)) throw Error('Local source changed');
  };
  return {
    // No contract booleans: this executor cannot satisfy compose.openLocal alone.
    async run(step) {
      if (busy || stopped || next >= steps.length || JSON.stringify(step) !== JSON.stringify(steps[next]))
        throw Error('Out-of-order or noncanonical local command');
      busy = true;
      try {
      unchanged();
      // A missing/failed authority check never reaches the child executor.
      await assertOwnedRuntime();
      unchanged();
      let result;
      try {
        result = spawn(step.command, [...step.args], { cwd: root,
          env: { ...childEnv, ...step.environment }, encoding: 'utf8', stdio: 'pipe',
          shell: false, maxBuffer: 64 * 1024 * 1024 });
      } catch (error) {
        stopped = true;
        return { status: -1, signal: null, error: error.message, stdout: '', stderr: '' };
      }
      next++;
      stopped = result.status !== 0 || !!result.signal || !!result.error;
      return { status: result.status ?? -1, signal: result.signal ?? null,
        error: result.error?.message ?? null, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
      } catch (error) { stopped = true; throw error; }
      finally { busy = false; }
    },
    async close() {
      if (busy) throw Error('Cannot close while a stage is active');
      stopped = true;
      closing ??= Promise.resolve().then(() => closeOwnedRuntime());
      return closing;
    },
  };
}
