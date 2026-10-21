import { connect } from 'node:net';
export const ORDER_ID = '00000000-0000-4000-8000-000000000280';
export const RECOVERY_PATH = `/orders/${ORDER_ID}/recovery`;
export const recovery = { id: ORDER_ID, status: 'PAID', paymentStatus: 'SUCCEEDED' };
export function recoveryFixture(path, token) {
    if (path !== RECOVERY_PATH) throw Error(`Unexpected recovery route: ${path}`);
    return token === 'Bearer synthetic-A' ? { status: 200, data: recovery } : { status: 403, data: {} };
}
export const deadline = (promise, ms, label) => {
    let timer;
    return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error(`${label} timeout`)), ms); })]).finally(() => clearTimeout(timer));
};
export function createCDP(socket, ms = 5000) {
    let sequence = 0; const pending = new Map();
    const rejectAll = () => { for (const p of pending.values()) p.reject(Error('CDP closed')); pending.clear(); };
    socket.addEventListener('close', rejectAll); socket.addEventListener('error', rejectAll);
    socket.addEventListener('message', event => {
        const m = JSON.parse(event.data); if (!m.id) return;
        const p = pending.get(m.id); if (!p) return; pending.delete(m.id);
        m.error ? p.reject(Error(JSON.stringify(m.error))) : p.resolve(m.result);
    });
    return (method, params = {}) => {
        const id = ++sequence;
        return deadline(new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); try { socket.send(JSON.stringify({ id, method, params })); } catch (e) { pending.delete(id); reject(e); } }), ms, `CDP ${method}`).finally(() => pending.delete(id));
    };
}
export async function stopOwnedChild(child, ms = 1000) {
    if (!child?.pid) return { pid: null, stopped: true };
    const exited = () => child.exitCode !== null || child.signalCode !== null;
    const waitExit = () => exited() ? Promise.resolve() : new Promise(resolve => child.once('exit', resolve));
    if (!exited()) { child.kill('SIGTERM'); try { await deadline(waitExit(), ms, 'SIGTERM'); } catch { child.kill('SIGKILL'); await deadline(waitExit(), ms, 'SIGKILL'); } }
    try { process.kill(child.pid, 0); throw Error(`Owned PID ${child.pid} still exists`); } catch (e) { if (e.code !== 'ESRCH') throw e; }
    return { pid: child.pid, stopped: true, exitCode: child.exitCode, signalCode: child.signalCode };
}
export const assertListenerClosed = port => deadline(new Promise((resolve, reject) => {
    const socket = connect({ host: '127.0.0.1', port });
    socket.once('connect', () => { socket.destroy(); reject(Error(`Owned listener ${port} still open`)); });
    socket.once('error', error => error.code === 'ECONNREFUSED' ? resolve({ port, closed: true }) : reject(error));
}), 1500, 'listener verification');
export async function cleanupOwned({ child, server, profile, remove }) {
    const proof = {}; const errors = [];
    try { proof.browser = await stopOwnedChild(child); } catch (e) { errors.push(e); }
    try { const port = server?.httpServer?.address()?.port; if (server) await deadline(server.close(), 3000, 'frontend close'); if (port) proof.listener = await assertListenerClosed(port); } catch (e) { errors.push(e); }
    try { await remove(profile, { recursive: true, force: true }); proof.profileRemoved = true; } catch (e) { errors.push(e); }
    if (errors.length) throw new AggregateError(errors, `Cleanup incomplete: ${JSON.stringify(proof)}`);
    return proof;
}
