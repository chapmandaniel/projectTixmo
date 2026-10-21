// Source-only lifecycle bridge. No native admission/provider is installed here.
// Injected callbacks are trusted code, NOT proof that native enforcement exists.
import { boundaries, snapshot } from './market-composition.mjs';
import { localStageSession } from './market-local-session.mjs';

export function localPhaseOpener({ root, capture = snapshot, acquire, spawn } = {}) {
  return async function openLocal(contract, identity) {
    if (JSON.stringify(contract) !== JSON.stringify(boundaries.local)) throw Error('Unexpected local contract');
    // Never provision a runtime when no separately reviewed provider is present.
    if (typeof acquire !== 'function') throw Error('Native admission and runtime provenance provider unavailable');
    const expected = structuredClone(identity);
    const unchanged = () => {
      if (JSON.stringify(capture(root)) !== JSON.stringify(expected)) throw Error('Local source changed');
    };
    unchanged();
    // Provider must own rollback if acquisition itself rejects before returning.
    const runtime = await acquire({ root, identity: structuredClone(expected) });
    let executor, cleanup;
    const close = () => cleanup ??= Promise.resolve().then(() => runtime.close());
    try {
      if (!runtime || typeof runtime.close !== 'function') throw Error('Owned runtime cleanup unavailable');
      // Boolean claims are deliberately insufficient. The provider must perform
      // native admission/provenance checks now AND before every stage.
      if (typeof runtime.assertNativeAdmission !== 'function' || typeof runtime.assertProvenance !== 'function' ||
          typeof runtime.assertOwnedRuntime !== 'function' || !runtime.env || typeof runtime.env !== 'object')
        throw Error('Native admission, provenance and owned-runtime verifiers required');
      const check = async () => {
        await runtime.assertNativeAdmission();
        await runtime.assertProvenance();
        await runtime.assertOwnedRuntime();
      };
      await check();
      unchanged();
      executor = localStageSession({ root, identity: expected, env: runtime.env, capture,
        ...(spawn ? { spawn } : {}), assertOwnedRuntime: check, closeOwnedRuntime: close });
      return { contract: structuredClone(contract), run: step => executor.run(step), close: () => executor.close() };
    } catch (error) {
      if (runtime && typeof runtime.close === 'function') {
        try { await close(); } catch (cleanupError) { cleanupError.admissionFailure = error; throw cleanupError; }
      }
      throw error;
    }
  };
}
