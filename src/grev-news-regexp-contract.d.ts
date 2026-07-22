// Grev News feed parsers only use regular expressions whose first three capture groups are required by the pattern.
// Preserve the native match metadata while keeping noUncheckedIndexedAccess enabled project-wide.
type GrevNewsRequiredMatch = RegExpMatchArray & [string, string, string, string, ...string[]];
type GrevNewsRequiredExec = RegExpExecArray & [string, string, string, string, ...string[]];
interface String {
  match(regexp: RegExp): GrevNewsRequiredMatch | null;
  matchAll(regexp: RegExp): IterableIterator<GrevNewsRequiredExec>;
}
