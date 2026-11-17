export type NameMention = {
  firstName: string;
  lastName?: string;
};

/**
 * Parse @mentions of people by first name, with an optional last name.
 *
 * The dashboard inserts `@First Last ` (or `@First ` when lastName is missing).
 * A following token is treated as a last name only when it starts with an
 * uppercase letter, so sentence text after a first-name mention is not
 * consumed: `@Qat140mnt please see this` mentions Qat140mnt, not lastName
 * "please". `@Sam Lee please confirm` still captures lastName Lee.
 *
 * Handle, email, and id mentions are not parsed; the product only inserts
 * display names.
 */
export function parseNameMentions(content: string): NameMention[] {
  const mentionRegex = /@([A-Za-z0-9]+)(?:\s([A-Z][A-Za-z0-9]+))?/g;
  const mentions: NameMention[] = [];
  let match: RegExpExecArray | null;
  while ((match = mentionRegex.exec(content)) !== null) {
    mentions.push({
      firstName: match[1],
      ...(match[2] ? { lastName: match[2] } : {}),
    });
  }
  return mentions;
}

const nameKey = (firstName: string, lastName?: string | null) =>
  `${firstName.toLowerCase()}\0${(lastName ?? '').toLowerCase()}`;

/**
 * Mentions whose first+last lookup found no one may have treated ordinary
 * sentence text as a last name (e.g. `@Sam Please confirm`). Those fall
 * back to a first-name-only lookup, along with mentions that were
 * first-name-only from the start.
 */
export function mentionsNeedingFirstNameFallback(
  mentions: NameMention[],
  matchedFullNames: Array<{ firstName: string; lastName?: string | null }>
): NameMention[] {
  const matched = new Set(matchedFullNames.map((u) => nameKey(u.firstName, u.lastName)));
  return mentions.filter((mention) => {
    if (!mention.lastName) return true;
    return !matched.has(nameKey(mention.firstName, mention.lastName));
  });
}
