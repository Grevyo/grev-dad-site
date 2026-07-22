// Grev News feed parsers only use regular expressions whose first three capture groups are required by the pattern.
// This keeps noUncheckedIndexedAccess enabled project-wide while accurately typing those parser captures.
interface String {
  match(regexp: RegExp): [string, string, string, string, ...string[]] | null;
  matchAll(regexp: RegExp): IterableIterator<[string, string, string, string, ...string[]]>;
}
