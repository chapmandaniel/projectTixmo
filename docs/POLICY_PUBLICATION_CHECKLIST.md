# Tixmo Policy Publication Checklist

Use this checklist to turn the policy drafts in `docs/policies/` into website, checkout, and onboarding copy. These drafts are not legal signoff.

## Drafts Created

- `docs/policies/PRIVACY_POLICY_DRAFT.md`
- `docs/policies/TERMS_OF_SERVICE_DRAFT.md`
- `docs/policies/REFUND_POLICY_DRAFT.md`
- `docs/policies/ORGANIZER_TERMS_DRAFT.md`
- `docs/policies/DATA_RETENTION_NOTES.md`

## Required Review

- [ ] Legal entity, address, support email, privacy email, and legal email are final.
- [ ] Counsel reviews and approves privacy, terms, refund, organizer, data retention, liability, indemnity, dispute, and governing-law language.
- [ ] Payment owner approves refund, fee, tax, payout, chargeback, and currency language.
- [ ] Support owner approves refund intake and manual repair process.
- [ ] Security owner approves data retention, token handling, public-link handling, scanner-key language, and backup retention language.
- [ ] Product owner confirms V1 beta scope matches actual dashboard behavior.
- [ ] Public pages are created and linked from footer, checkout, organizer onboarding, account settings, and support templates.
- [ ] Dashboard runtime config includes `privacyPolicyUrl`, `termsUrl`, and `refundPolicyUrl` before live checkout.
- [ ] `/checkout/:eventSlug` shows Terms, Refund Policy, and Privacy Policy before order/payment actions.
- [ ] Event creation flow captures organizer refund/cancellation terms before publication.
- [ ] Checkout displays refund policy before purchase.
- [ ] Privacy request intake mailbox or form is live.
- [ ] Support team has a customer-safe explanation for refunds, cancellations, duplicate scans, and payment failures.

## Compliance Sources Consulted

- FTC privacy and security business guidance: https://www.ftc.gov/business-guidance/privacy-security
- FTC personal-information protection guidance: https://www.ftc.gov/business-guidance/resources/protecting-personal-information-guide-business
- California DOJ CCPA overview: https://www.oag.ca.gov/privacy/ccpa
- ICO privacy notice guidance: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/what-privacy-information-should-we-provide/

## Publish Locations

- Website footer: Privacy Policy, Terms, Refund Policy.
- Checkout: Refund Policy and Terms acknowledgement.
- Organizer onboarding: Terms, Organizer Terms, Privacy Policy, Refund Policy setup prompt.
- Dashboard settings: Privacy Policy, Terms, support contact.
- Support macros: refund policy, privacy request, chargeback explanation, duplicate scan escalation.
