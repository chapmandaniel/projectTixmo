"use strict";
// Plain lifetime observers intentionally keep no per-call arguments/results/history.
function replace(module, name, make) {
  const own = Object.getOwnPropertyDescriptor(module, name);
  let owner = module,
    descriptor = own;
  while (!descriptor && (owner = Object.getPrototypeOf(owner)))
    descriptor = Object.getOwnPropertyDescriptor(owner, name);
  if (
    !descriptor ||
    typeof descriptor.value !== "function" ||
    (own && !own.configurable && !own.writable) ||
    (!own && !Object.isExtensible(module))
  )
    throw Error("Soak observer target rejected");
  const wrapped = make(descriptor.value);
  Object.defineProperty(
    module,
    name,
    own
      ? { ...own, value: wrapped }
      : {
          value: wrapped,
          writable: true,
          configurable: true,
          enumerable: descriptor.enumerable,
        },
  );
  return {
    mockRestore() {
      if (Object.getOwnPropertyDescriptor(module, name)?.value !== wrapped)
        throw Error("Soak observer ownership changed");
      if (own) Object.defineProperty(module, name, own);
      else if (!Reflect.deleteProperty(module, name))
        throw Error("Soak observer restore failed");
    },
  };
}
function observeFunction(module, name, track) {
  return replace(
    module,
    name,
    (original) =>
      function (...args) {
        const result = Reflect.apply(original, this, args);
        track(Promise.resolve(result));
        return result;
      },
  );
}
module.exports = { observeFunction };
