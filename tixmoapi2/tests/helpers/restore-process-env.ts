export function snapshotProcessEnv(): NodeJS.ProcessEnv {
  return { ...process.env };
}

export function restoreProcessEnv(snapshot: NodeJS.ProcessEnv): void {
  for (const key of Object.keys(process.env)) {
    if (!Object.prototype.hasOwnProperty.call(snapshot, key)) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, snapshot);
}
