#!/bin/sh
set -eu

api_url="${VITE_API_URL:-/api/v1}"
privacy_policy_url="${VITE_PRIVACY_POLICY_URL:-}"
terms_url="${VITE_TERMS_URL:-}"
refund_policy_url="${VITE_REFUND_POLICY_URL:-}"
organizer_terms_url="${VITE_ORGANIZER_TERMS_URL:-}"
stripe_publishable_key="${VITE_STRIPE_PUBLISHABLE_KEY:-}"
payment_currency="${VITE_PAYMENT_CURRENCY:-usd}"

escaped_api_url=$(printf '%s' "$api_url" | sed 's/\\/\\\\/g; s/"/\\"/g')
escaped_privacy_policy_url=$(printf '%s' "$privacy_policy_url" | sed 's/\\/\\\\/g; s/"/\\"/g')
escaped_terms_url=$(printf '%s' "$terms_url" | sed 's/\\/\\\\/g; s/"/\\"/g')
escaped_refund_policy_url=$(printf '%s' "$refund_policy_url" | sed 's/\\/\\\\/g; s/"/\\"/g')
escaped_organizer_terms_url=$(printf '%s' "$organizer_terms_url" | sed 's/\\/\\\\/g; s/"/\\"/g')
escaped_stripe_publishable_key=$(printf '%s' "$stripe_publishable_key" | sed 's/\\/\\\\/g; s/"/\\"/g')
escaped_payment_currency=$(printf '%s' "$payment_currency" | sed 's/\\/\\\\/g; s/"/\\"/g')

cat >/usr/share/nginx/html/runtime-config.js <<EOF
window.__TIXMO_CONFIG__ = Object.assign({}, window.__TIXMO_CONFIG__, {
  apiUrl: "${escaped_api_url}",
  privacyPolicyUrl: "${escaped_privacy_policy_url}",
  termsUrl: "${escaped_terms_url}",
  refundPolicyUrl: "${escaped_refund_policy_url}",
  organizerTermsUrl: "${escaped_organizer_terms_url}",
  stripePublishableKey: "${escaped_stripe_publishable_key}",
  paymentCurrency: "${escaped_payment_currency}"
});
EOF
