import { mentionsNeedingFirstNameFallback, parseNameMentions } from '../../src/api/tasks/mentions';

describe('parseNameMentions', () => {
  it('treats a lowercase word after a first-name mention as sentence text', () => {
    expect(parseNameMentions('QA T140 comment @Qat140mnt please see this.')).toEqual([
      { firstName: 'Qat140mnt' },
    ]);
  });

  it('captures an optional capitalized last name and leaves trailing text alone', () => {
    expect(parseNameMentions('@Sam Lee please confirm radios')).toEqual([
      { firstName: 'Sam', lastName: 'Lee' },
    ]);
  });

  it('parses a first-name-only mention with no following word', () => {
    expect(parseNameMentions('ping @Daniel')).toEqual([{ firstName: 'Daniel' }]);
  });

  it('parses multiple mentions in one body', () => {
    expect(parseNameMentions('cc @Alex Rivera and @Sam please')).toEqual([
      { firstName: 'Alex', lastName: 'Rivera' },
      { firstName: 'Sam' },
    ]);
  });
});

describe('mentionsNeedingFirstNameFallback', () => {
  it('falls back when a capitalized next word was not a matching last name', () => {
    const mentions = parseNameMentions('@Sam Please confirm radios');
    expect(mentions).toEqual([{ firstName: 'Sam', lastName: 'Please' }]);
    expect(mentionsNeedingFirstNameFallback(mentions, [])).toEqual(mentions);
  });

  it('does not fall back when the full name already matched a user', () => {
    const mentions = parseNameMentions('@Sam Lee please confirm');
    expect(
      mentionsNeedingFirstNameFallback(mentions, [{ firstName: 'Sam', lastName: 'Lee' }])
    ).toEqual([]);
  });
});
