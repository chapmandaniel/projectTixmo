// A bounded observer for the reviewed Vite document, never a JavaScript executor.
function attributes(source) {
  const result = new Map();
  let rest = source;
  while (rest.trim()) {
    const match = /^\s+([a-zA-Z][a-zA-Z0-9:_-]*)(?:\s*=\s*(?:"([^"<>]*)"|'([^'<>]*)'|([^\s"'=<>`]+)))?/.exec(rest);
    if (!match) return null;
    const name = match[1].toLowerCase();
    if (result.has(name)) return null;
    result.set(name, match[2] ?? match[3] ?? match[4] ?? '');
    rest = rest.slice(match[0].length);
  }
  return result;
}
export function observeResetDocument(body, headers) {
  const clean = body.replace(/<!--[\s\S]*?-->/g, '');
  // Unexpected/inert document structures fail closed rather than count their text as scripts.
  const supported = !/<!--|<(?:template|noscript|textarea|iframe|xmp|plaintext)\b/i.test(clean) &&
    /^\s*<!doctype\s+html>\s*<html\b[^>]*>\s*<head\s*>/i.test(clean);
  const document = clean.replace(/<(title|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  const scripts = [...document.matchAll(/<script\b((?:[^"'<>]|"[^"<>]*"|'[^'<>]*')*)>([\s\S]*?)<\/script\s*>/gi)]
    .map(match => ({ attrs: attributes(match[1]), body: match[2], index: match.index }));
  const first = scripts[0];
  const prefix = /^\s*<!doctype\s+html>\s*<html\b[^>]*>\s*<head\s*>/i.exec(document);
  const firstHeadContent = Boolean(prefix && first && !document.slice(prefix[0].length, first.index).trim());
  const moduleIndex = scripts.findIndex(script => script.attrs?.get('type') === 'module' &&
    /^\/app-assets\/[a-zA-Z0-9_.-]+\.js$/.test(script.attrs.get('src') || '') && !script.body.trim());
  const csp = headers.get('content-security-policy') || '';
  const directives = csp.split(';').map(part => part.trim());
  const scriptPolicy = directives.find(part => /^script-src\s/i.test(part)) || '';
  const override = directives.some(part => /^(?:script-src-elem|sandbox)(?:\s|$)/i.test(part));
  return {
    bootstrapFirst: supported && firstHeadContent && first?.attrs?.size === 1 && first.attrs.get('src') === '/buyer-reset-intent.js' &&
      !first.body.trim() && moduleIndex > 0,
    scriptCsp: !csp.includes(',') && !override && /(?:^|\s)'self'(?:\s|$)/.test(scriptPolicy) &&
      !scriptPolicy.includes("'unsafe-inline'"),
  };
}
