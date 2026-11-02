import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyPolicyConfig } from '../../public/policy-runtime.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const placeholder = /\[[A-Z][A-Z0-9_]*\]/;
const pages = ['refunds.html', 'terms.html'];

const seller = 'Tixmo Ltd., as ticketing agent for Quincy Enterprises Ltd. (Mighty Quinton Concerts), the event organizer';

const filled = {
    sellerName: seller,
    supportEmail: 'info@tixmo.co',
    hstNumber: '123456789RT0001',
    mailingAddress: "1 Harbour Street, St. John's, NL",
    venuePolicyUrl: 'https://venue.example.test/rules',
};

const readPage = (name) => readFileSync(path.join(root, 'public', name), 'utf8');

const render = (name, config) => {
    const html = readPage(name).replace(/<script[\s\S]*?<\/script>/gi, '');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    applyPolicyConfig(doc, config);
    return doc;
};

const visibleText = (doc) => {
    const parts = [];
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
        let parent = walker.currentNode.parentElement;
        let hidden = false;
        while (parent) {
            if (parent.hidden) {
                hidden = true;
                break;
            }
            parent = parent.parentElement;
        }
        if (!hidden) parts.push(walker.currentNode.textContent);
    }
    return parts.join(' ').replace(/\s+/g, ' ').trim();
};

describe('policy pages', () => {
    it('ships no raw placeholder and no operating-as seller line', () => {
        for (const name of ['refunds.html', 'terms.html', 'privacy.html', 'cancellation.html']) {
            const source = readPage(name);
            expect(source).not.toMatch(placeholder);
            expect(source.toLowerCase()).not.toContain('operating as');
        }
        expect(readPage('terms.html')).toContain('<title>Terms of Sale — Tixmo</title>');
        expect(readPage('terms.html')).toContain('>Terms of Sale<');
    });

    it.each(pages)('renders configured values on %s', (name) => {
        const doc = render(name, filled);
        const text = visibleText(doc);
        const html = doc.body.innerHTML;
        expect(text).toContain(`Sold by: ${seller}`);
        expect(text).toContain("1 Harbour Street, St. John's, NL");
        expect(text).toContain('info@tixmo.co');
        expect(html).toContain('mailto:info@tixmo.co');
        expect(html).not.toMatch(placeholder);
        expect(text).not.toMatch(placeholder);
        expect(html.toLowerCase()).not.toContain('operating as');
        if (name === 'terms.html') {
            expect(text).toContain('HST registration no.: 123456789RT0001');
            expect(text).toContain(`Tickets are sold by ${seller}.`);
            expect(text).toContain(
                'Quincy Enterprises Ltd. (Mighty Quinton Concerts), the event organizer, is responsible for providing the event as described, or refunding you under our policies.'
            );
            expect(text).not.toContain(`${seller} as ticketing agent`);
            expect(doc.querySelector('[data-policy-venue-link]').getAttribute('href')).toBe(
                'https://venue.example.test/rules'
            );
            expect(doc.querySelector('[data-policy-venue-plain]').hidden).toBe(true);
        }
    });

    it.each(pages)('hides unset lines on %s and never renders a placeholder', (name) => {
        const doc = render(name, {
            sellerName: '[LEGAL_ENTITY_NAME]',
            supportEmail: '[SUPPORT_EMAIL]',
            hstNumber: '[HST_REGISTRATION_NUMBER]',
            mailingAddress: '[MAILING_ADDRESS]',
            venuePolicyUrl: '[VENUE_POLICY_URL]',
        });
        const text = visibleText(doc);
        const html = doc.body.innerHTML;
        expect(text).not.toContain('Sold by:');
        expect(text).not.toContain('Questions:');
        expect(text).not.toContain('HST registration');
        expect(text).not.toContain('ticketing agent');
        expect(text).not.toContain('or refunding you under our policies');
        expect(html).not.toMatch(placeholder);
        expect(text).not.toMatch(placeholder);
        expect(text).not.toContain('[X]');
        if (name === 'terms.html') {
            expect(doc.querySelector('[data-policy-venue-link]').hidden).toBe(true);
            expect(doc.querySelector('[data-policy-venue-plain]').hidden).toBe(false);
            expect(text).toContain('venue’s own rules');
        }
        if (name === 'refunds.html') {
            expect(text).toContain('Email us with your order number');
            expect(text).not.toContain('mailto:');
        }
    });

    it('closes the seller sentence once', () => {
        const sentence = (sellerName) =>
            visibleText(render('terms.html', { sellerName })).match(/Tickets are sold by .*?(?= To the extent)/)?.[0];
        expect(sentence('Tixmo Ltd.')).toBe('Tickets are sold by Tixmo Ltd.');
        expect(sentence('Tixmo Ltd!')).toBe('Tickets are sold by Tixmo Ltd!');
        expect(sentence('Tixmo Ltd?')).toBe('Tickets are sold by Tixmo Ltd?');
        expect(sentence('Tixmo Ltd')).toBe('Tickets are sold by Tixmo Ltd.');
        expect(sentence('Harbour Tickets')).toBe('Tickets are sold by Harbour Tickets.');
    });

    it('mentions as ticketing agent at most once in terms section 7', () => {
        const phrase = 'as ticketing agent';
        const section7 = (doc) => {
            const heading = [...doc.querySelectorAll('h2')].find((node) => node.textContent.trim().startsWith('7.'));
            return (heading?.nextElementSibling?.textContent || '').replace(/\s+/g, ' ').trim();
        };
        const count = (text) => text.split(phrase).length - 1;
        const html = readPage('terms.html').replace(/<script[\s\S]*?<\/script>/gi, '');
        const noJs = new DOMParser().parseFromString(html, 'text/html');
        const noJsSection = section7(noJs);
        expect(count(noJsSection)).toBeLessThanOrEqual(1);
        expect(noJsSection).not.toContain(phrase);

        const doc = render('terms.html', filled);
        const section = section7(doc);
        expect(count(section)).toBe(1);
        expect(section).toContain(`Tickets are sold by ${seller}.`);
        expect(section).toContain(
            'Quincy Enterprises Ltd. (Mighty Quinton Concerts), the event organizer, is responsible for providing the event as described, or refunding you under our policies.'
        );
        expect(section).toContain('we aren’t responsible for indirect costs such as travel, accommodation or lost earnings.');
        expect(section).toContain(
            'Nothing in these terms limits rights you have under Newfoundland and Labrador or Canadian consumer protection law.'
        );
    });

    it('keeps organizer terms as an unlinked noindex placeholder', () => {
        const placeholderPage = readPage('organizer-terms.html');
        expect(placeholderPage).toContain('<meta name="robots" content="noindex, nofollow">');
        expect(placeholderPage).toContain('Temporary placeholder for testing.');
        const buyerPages = ['terms.html', 'refunds.html', 'privacy.html', 'cancellation.html'].map(readPage);
        const emailTemplates = readFileSync(
            path.join(root, '../tixmoapi2/src/utils/emailTemplates.ts'),
            'utf8'
        );
        const buyerSources = readdirSync(path.join(root, 'src/pages'))
            .filter((name) => name.endsWith('.jsx'))
            .map((name) => readFileSync(path.join(root, 'src/pages', name), 'utf8'));
        for (const source of [...buyerPages, emailTemplates, ...buyerSources]) {
            expect(source).not.toContain('organizer-terms');
            expect(source).not.toMatch(/href=\{[^}]*organizerTermsUrl/);
        }
    });
});
