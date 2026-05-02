export function getCasesDb(env) {
  return env?.["CASES-DB"] || env?.CASES_DB || env?.CASESDB || null;
}
