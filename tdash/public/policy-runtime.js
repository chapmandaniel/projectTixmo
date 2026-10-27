const placeholder = /\[[A-Z][A-Z0-9_]*\]/;

const clean = (value) => {
    const text = String(value ?? '').trim();
    if (!text || placeholder.test(text)) return '';
    return text;
};

const httpsUrl = (value) => {
    try {
        const url = new URL(value);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
        if (url.username || url.password) return '';
        return url.toString();
    } catch {
        return '';
    }
};

export const policyValues = (config = {}) => {
    const sellerName = clean(config.sellerName);
    const supportEmail = clean(config.supportEmail);
    const mailingAddress = clean(config.mailingAddress);
    const hst = clean(config.hstNumber).replace(/[\s-]/g, '').toUpperCase();
    const venue = clean(config.venuePolicyUrl);
    return {
        sellerName,
        supportEmail: /^[^\s@<>"']+@[^\s@<>"']+$/.test(supportEmail) ? supportEmail : '',
        mailingAddress,
        hstNumber: /^[0-9]{9}RT[0-9]{4}$/.test(hst) ? hst : '',
        venuePolicyUrl: venue ? httpsUrl(venue) : '',
    };
};

const show = (element, visible) => {
    element.hidden = !visible;
};

export const applyPolicyConfig = (root, config = {}) => {
    const values = policyValues(config);
    root.querySelectorAll('[data-policy-field]').forEach((element) => {
        const key = element.getAttribute('data-policy-field');
        const value = values[key] || '';
        element.textContent = value;
        if (element.tagName === 'A' && key === 'supportEmail') {
            element.setAttribute('href', value ? `mailto:${value}` : '');
        }
    });
    root.querySelectorAll('[data-policy-when]').forEach((element) => {
        const key = element.getAttribute('data-policy-when');
        show(element, Boolean(values[key]));
    });
    root.querySelectorAll('[data-policy-when-missing]').forEach((element) => {
        const key = element.getAttribute('data-policy-when-missing');
        show(element, !values[key]);
    });
    const responsible = root.querySelector('[data-policy-sentence="responsible"]');
    if (responsible) {
        if (values.sellerName) {
            responsible.hidden = false;
            responsible.textContent = `Tickets are sold by ${values.sellerName} as ticketing agent for the event organizer. The organizer is responsible for the event itself, including delivery, changes, cancellations, and venue rules. `;
        } else {
            responsible.hidden = true;
            responsible.textContent = '';
        }
    }
    const venueLink = root.querySelector('[data-policy-venue-link]');
    const venuePlain = root.querySelector('[data-policy-venue-plain]');
    if (venueLink && venuePlain) {
        const visible = Boolean(values.venuePolicyUrl);
        venueLink.hidden = !visible;
        venuePlain.hidden = visible;
        venueLink.setAttribute('href', visible ? values.venuePolicyUrl : '');
    }
    root.querySelectorAll('[data-policy-footer]').forEach((element) => {
        element.replaceChildren();
        const parts = [];
        if (values.sellerName) parts.push({ text: values.sellerName });
        if (values.mailingAddress) parts.push({ text: values.mailingAddress });
        if (values.supportEmail) parts.push({ email: values.supportEmail });
        if (!parts.length) {
            element.hidden = true;
            return;
        }
        element.hidden = false;
        parts.forEach((part, index) => {
            if (index > 0) element.append(' · ');
            if (part.email) {
                const link = root.createElement ? root.createElement('a') : document.createElement('a');
                link.href = `mailto:${part.email}`;
                link.textContent = part.email;
                element.append(link);
                return;
            }
            element.append(part.text);
        });
    });
};

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
    const boot = () => applyPolicyConfig(document, window.__TIXMO_CONFIG__ || {});
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
}
