// Grev News feed parsers use matchAll patterns whose first three capture groups are required.
// Keep the contract limited to matchAll so existing String.match type guards remain untouched.
type GrevNewsRequiredExec = RegExpExecArray & [string, string, string, string, ...string[]];
interface String {
  matchAll(regexp: RegExp): IterableIterator<GrevNewsRequiredExec>;
}
// JavaScript coerces undefined to a string here; guarded newsroom route captures always provide the value.
declare function decodeURIComponent(encodedURI: string | undefined): string;
