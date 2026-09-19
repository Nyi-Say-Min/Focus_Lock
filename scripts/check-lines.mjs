import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
const base = "a9c968910c088c0dac3c05eeea552273b0714c29";
const git = (...args) => execFileSync("git", args, { encoding: "utf8" });
const included = (path) =>
  !/(^|\/)(out|dist|node_modules)\/|package-lock\.json$|\.config\.\d+\.mjs$/.test(path) &&
  (/\.(?:[cm]?[jt]sx?|json|ya?ml|css|html)$/.test(path) || /(^|\/)\.(gitignore|prettierignore)$/.test(path));
let lines = 0,
  selected = false;
for (const line of git("diff", "--no-ext-diff", "--unified=0", base, "--", ".").split(/\r?\n/)) {
  if (line.startsWith("+++ b/")) selected = included(line.slice(6));
  else if (line.startsWith("+++ ")) selected = false;
  else if (selected && line.startsWith("+") && line.slice(1).trim()) lines++;
}
for (const path of git("ls-files", "--others", "--exclude-standard", "-z").split("\0").filter(Boolean)) {
  if (included(path))
    lines += readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter((line) => line.trim()).length;
}
console.log(`Phase 2 additions: ${lines}/400 nonblank lines (baseline ${base.slice(0, 7)})`);
if (lines > 400) process.exitCode = 1;
