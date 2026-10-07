const keys = new Set(['apiUrl', 'privacyPolicyUrl', 'termsUrl', 'refundPolicyUrl',
  'organizerTermsUrl', 'stripePublishableKey', 'paymentCurrency']);

// Parse only the repository's static data wrappers. Fetched JavaScript is never
// executed, including supposedly isolated VM contexts.
export function parseRuntimeConfig(source) {
  if (typeof source !== 'string' || source.length > 131072) throw new Error('Unsupported runtime configuration');
  let index = 0;
  const fail = () => { throw new Error('Unsupported runtime configuration syntax'); };
  const space = () => { while (/\s/.test(source[index] || '') && index < source.length) index++; };
  const take = (value) => { space(); if (!source.startsWith(value, index)) fail(); index += value.length; };
  const at = (value) => { space(); return source.startsWith(value, index); };
  const string = () => {
    space(); const quote = source[index++]; if (quote !== '"' && quote !== "'") fail();
    let value = '';
    while (index < source.length) {
      let ch = source[index++];
      if (ch === quote) return value;
      if (ch === '\n' || ch === '\r' || ch.charCodeAt(0) < 32) fail();
      if (ch === '\\') {
        ch = source[index++];
        const escapes = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', '\\': '\\', '/': '/', '"': '"', "'": "'" };
        if (Object.hasOwn(escapes, ch)) value += escapes[ch];
        else if (ch === 'u' || ch === 'x') {
          const length = ch === 'u' ? 4 : 2, hex = source.slice(index, index + length);
          if (!new RegExp(`^[a-fA-F0-9]{${length}}$`).test(hex)) fail();
          index += length; value += String.fromCharCode(parseInt(hex, 16));
        } else fail();
      } else value += ch;
      if (value.length > 8192) fail();
    }
    fail();
  };
  const object = () => {
    const entries = [], seen = new Set(); take('{');
    if (at('}')) { take('}'); return {}; }
    while (true) {
      space(); let key;
      if (at('"') || at("'")) key = string();
      else { const match = /^[a-zA-Z_$][a-zA-Z0-9_$]*/.exec(source.slice(index)); if (!match) fail(); key = match[0]; index += key.length; }
      if (!keys.has(key) || seen.has(key)) fail(); seen.add(key);
      take(':'); entries.push([key, string()]);
      if (at('}')) { take('}'); return Object.fromEntries(entries); }
      take(','); if (at('}')) { take('}'); return Object.fromEntries(entries); }
    }
  };
  take('window.__TIXMO_CONFIG__'); take('=');
  let config;
  if (at('Object.assign')) {
    take('Object.assign'); take('('); take('{'); take('}'); take(',');
    take('window.__TIXMO_CONFIG__'); take(','); config = object(); take(')');
  } else if (at('window.__TIXMO_CONFIG__')) {
    take('window.__TIXMO_CONFIG__'); take('||'); take('{'); take('}'); config = {};
  } else config = object();
  if (at(';')) take(';'); space(); if (index !== source.length) fail();
  return config;
}
