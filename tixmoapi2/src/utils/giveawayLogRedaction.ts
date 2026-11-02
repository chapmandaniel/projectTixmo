const EVIDENCE_KEY =
  /"(evidencePhones|evidenceEmails|verificationCode|detail)"\s*:\s*("[^"]*"|\[[^\]]*\])/gi;
const EVIDENCE_QUERY = /([?&](?:evidencePhones|evidenceEmails|verificationCode|detail)=)[^&\s]*/gi;
const CHECKER_TOKEN = /\bgwc_[A-Za-z0-9_-]{8,}\b/g;

/** Strip checker evidence, verification codes, and checker tokens from log text. */
export const redactGiveawayLogText = (value: string): string =>
  value
    .replace(CHECKER_TOKEN, 'gwc_[redacted]')
    .replace(EVIDENCE_QUERY, '$1[redacted]')
    .replace(EVIDENCE_KEY, '"$1":"[redacted]"');
