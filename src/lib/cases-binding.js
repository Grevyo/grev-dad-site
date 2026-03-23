export function getCasesDb(env) {
  return env?.["CASES-DB"] ?? null;
}
