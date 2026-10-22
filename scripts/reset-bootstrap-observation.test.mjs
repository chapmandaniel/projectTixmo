import assert from 'node:assert/strict';
import test from 'node:test';
import { observeResetDocument } from './reset-bootstrap-observation.mjs';
const bootstrap = '<script src="/buyer-reset-intent.js"></script>';
const module = '<script type="module" crossorigin src="/app-assets/index-reviewed.js"></script>';
const html = `<!doctype html><html lang="en"><head>${bootstrap}${module}</head><body></body></html>`;
const headers = csp => new Headers({ 'content-security-policy': csp });
const csp = "default-src 'self'; script-src 'self' https://js.stripe.com; style-src 'self' 'unsafe-inline'";
test('reviewed executable bootstrap precedes the built module under the script policy', () => {
  assert.deepEqual(observeResetDocument(html, headers(csp)), { bootstrapFirst: true, scriptCsp: true });
});
for (const [name, altered] of [
  ['commented bootstrap', html.replace(bootstrap, `<!-- ${bootstrap} -->`)],
  ['non-executable spaced type', html.replace('<script src=', '<script type = "application/json" src=')],
  ['duplicate src attributes', html.replace('<script src=', '<script src="/other.js" src=')],
  ['deferred bootstrap', html.replace('<script src=', '<script defer src=')],
  ['nomodule bootstrap', html.replace('<script src=', '<script nomodule src=')],
  ['inert template', html.replace(bootstrap, `<template>${bootstrap}</template>`)],
  ['bootstrap inside an attribute', html.replace(bootstrap, `<div data-code='${bootstrap}'></div>`)],
  ['module in noembed', html.replace(module, `<noembed>${module}</noembed>`)],
  ['module in noframes', html.replace(module, `<noframes>${module}</noframes>`)],
  ['module in foreign namespace', html.replace(module, `<svg>${module}</svg>`)],
  ['no built module', html.replace(module, '')],
  ['script text inside JSON', html.replace(module, `<script type="application/json">${module}</script>`)],
]) test(name, () => assert.equal(observeResetDocument(altered, headers(csp)).bootstrapFirst, false));
for (const [name, policy] of [
  ['element directive blocks scripts', `${csp}; script-src-elem 'none'`],
  ['sandbox blocks execution', `${csp}; sandbox`],
  ['multiple policies unsupported', `${csp}, script-src 'none'`],
  ['strict dynamic rejects nonce-less bootstrap', `${csp}; script-src-elem 'nonce-synthetic' 'strict-dynamic'`],
  ['nonce strict dynamic policy', "script-src 'self' 'nonce-synthetic' 'strict-dynamic'"],
  ['unknown hash policy', "script-src 'self' 'sha256-synthetic'"],
  ['inline scripts allowed', "script-src 'self' 'unsafe-inline'"],
  ['no self source', "script-src https://js.stripe.com"],
]) test(name, () => assert.equal(observeResetDocument(html, headers(policy)).scriptCsp, false));
