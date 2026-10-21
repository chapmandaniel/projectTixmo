'use strict';
async function cleanupSteps(steps, timeoutMs = 3000) {
  const results = [];
  for (const [name, work] of steps) {
    let timer;
    try {
      await Promise.race([Promise.resolve().then(work), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Cleanup deadline: ' + name)), timeoutMs); })]);
      results.push({ name, ok: true });
    } catch (error) { results.push({ name, ok: false, error: String(error) }); }
    finally { clearTimeout(timer); }
  }
  return results;
}
module.exports = { cleanupSteps };
