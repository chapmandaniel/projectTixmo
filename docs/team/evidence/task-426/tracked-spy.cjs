'use strict';
// Capture native once, before spyOn. Phase delegates receive native, never spy.
function trackedSpy(mocking, object, name, work) {
  const native = object[name].bind(object);
  let phase;
  const spy = mocking.spyOn(object, name).mockImplementation((...args) =>
    work.run(() => phase ? phase(native, ...args) : native(...args)));
  return { spy, setPhase(delegate) { phase = delegate; }, resetPhase() { phase = undefined; } };
}
module.exports = { trackedSpy };
