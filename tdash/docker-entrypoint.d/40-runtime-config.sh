#!/bin/sh
set -eu

api_url="${VITE_API_URL:-/api/v1}"
privacy_policy_url="${VITE_PRIVACY_POLICY_URL:-}"
terms_url="${VITE_TERMS_URL:-}"
refund_policy_url="${VITE_REFUND_POLICY_URL:-}"
organizer_terms_url="${VITE_ORGANIZER_TERMS_URL:-}"
stripe_publishable_key="${VITE_STRIPE_PUBLISHABLE_KEY:-}"
seller_name="${TIXMO_SELLER_NAME:-}"
support_email="${SUPPORT_EMAIL:-}"
hst_number="${TIXMO_HST_NUMBER:-}"
mailing_address="${TIXMO_MAILING_ADDRESS:-}"
venue_policy_url="${VENUE_POLICY_URL:-}"
if [ -z "${VITE_PAYMENT_CURRENCY:-}" ]; then
  printf '%s\n' 'VITE_PAYMENT_CURRENCY is not set; using cad. Refusing the database default of usd.' >&2
fi
payment_currency=$(printf '%s' "${VITE_PAYMENT_CURRENCY:-cad}" | tr '[:upper:]' '[:lower:]')

escaped_api_url=$(printf '%s' "$api_url" | sed 's/\\/\\\\/g; s/"/\\"/g')
escaped_privacy_policy_url=$(printf '%s' "$privacy_policy_url" | sed 's/\\/\\\\/g; s/"/\\"/g')
escaped_terms_url=$(printf '%s' "$terms_url" | sed 's/\\/\\\\/g; s/"/\\"/g')
escaped_refund_policy_url=$(printf '%s' "$refund_policy_url" | sed 's/\\/\\\\/g; s/"/\\"/g')
escaped_organizer_terms_url=$(printf '%s' "$organizer_terms_url" | sed 's/\\/\\\\/g; s/"/\\"/g')
escaped_stripe_publishable_key=$(printf '%s' "$stripe_publishable_key" | sed 's/\\/\\\\/g; s/"/\\"/g')
escaped_payment_currency=$(printf '%s' "$payment_currency" | sed 's/\\/\\\\/g; s/"/\\"/g')
escaped_seller_name=$(printf '%s' "$seller_name" | sed 's/\\/\\\\/g; s/"/\\"/g')
escaped_support_email=$(printf '%s' "$support_email" | sed 's/\\/\\\\/g; s/"/\\"/g')
escaped_hst_number=$(printf '%s' "$hst_number" | sed 's/\\/\\\\/g; s/"/\\"/g')
escaped_mailing_address=$(printf '%s' "$mailing_address" | sed 's/\\/\\\\/g; s/"/\\"/g')
escaped_venue_policy_url=$(printf '%s' "$venue_policy_url" | sed 's/\\/\\\\/g; s/"/\\"/g')

cat >/usr/share/nginx/html/runtime-config.js <<EOF
window.__TIXMO_CONFIG__ = Object.assign({}, window.__TIXMO_CONFIG__, {
  apiUrl: "${escaped_api_url}",
  privacyPolicyUrl: "${escaped_privacy_policy_url}",
  termsUrl: "${escaped_terms_url}",
  refundPolicyUrl: "${escaped_refund_policy_url}",
  organizerTermsUrl: "${escaped_organizer_terms_url}",
  stripePublishableKey: "${escaped_stripe_publishable_key}",
  paymentCurrency: "${escaped_payment_currency}",
  sellerName: "${escaped_seller_name}",
  supportEmail: "${escaped_support_email}",
  hstNumber: "${escaped_hst_number}",
  mailingAddress: "${escaped_mailing_address}",
  venuePolicyUrl: "${escaped_venue_policy_url}"
});
EOF
