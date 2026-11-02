// Make a URL visible without leaving a live address the browser can follow.
export const defangUrl = (value) => String(value ?? '')
    .replace(/https/gi, 'hxxps')
    .replace(/http/gi, 'hxxp')
    .replace(/\./g, '[.]');
