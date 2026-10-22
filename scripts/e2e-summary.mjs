import { readFileSync } from "node:fs";
const r = JSON.parse(readFileSync("test-results/e2e.json", "utf8"));
const out = { pass: 0, fail: 0, skip: 0, failures: [] };
const walk = (suite, trail = []) => {
  for (const s of suite.suites ?? []) walk(s, [...trail, s.title]);
  for (const spec of suite.specs ?? []) {
    for (const t of spec.tests) {
      const res = t.results.at(-1);
      if (t.status === "expected") out.pass++;
      else if (t.status === "skipped") out.skip++;
      else {
        out.fail++;
        const msg = (res?.error?.message ?? "").replace(/\u001b\[[0-9;]*m/g, "").split("\n").filter(Boolean).slice(0, 6).join(" | ");
        out.failures.push(`${trail.join(" > ")} > ${spec.title}\n    ${msg.slice(0, 600)}`);
      }
    }
  }
};
for (const s of r.suites) walk(s, [s.title]);
console.log(`passed ${out.pass}  failed ${out.fail}  skipped ${out.skip}`);
for (const f of out.failures) console.log("\nFAIL " + f);
