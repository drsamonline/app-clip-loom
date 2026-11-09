/* tests/page-smoke.js — the page, driven. jsdom is a test-only dependency.
 * SPDX-FileCopyrightText: 2026 Dr Sohil Momin · PolyForm-Noncommercial-1.0.0 */
"use strict";
const fs = require("fs"), path = require("path");
let JSDOM;
try { ({ JSDOM } = require("jsdom")); } catch (e) { console.log("jsdom missing — npm install"); process.exit(2); }
const dir = path.join(__dirname, "..", "docs", "play");
let html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
for (const k of ["weft8.js", "clip.js"])
  html = html.replace('<script src="' + k + '"></script>', "<script>" + fs.readFileSync(path.join(dir, k), "utf8") + "</script>");
const errors = [];
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true,
  beforeParse(w) { w.addEventListener("error", (e) => errors.push(e.message)); } });
const w = dom.window, d = w.document;
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log("PASS  " + n); } else { fail++; console.log("FAIL  " + n + (x ? "  [" + x + "]" : "")); } };
const click = (id) => d.getElementById(id).dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
const t = (id) => d.getElementById(id).textContent;

ok("the page boots without an error", errors.length === 0, errors.join("; "));
ok("five programs are offered", d.querySelectorAll("#pick button").length === 5);
ok("the program source is shown", /IN  CLIPBOARD/.test(t("src")));

click("run");
ok("running strips the query string", t("output") === "https://example.com/article", t("output"));
ok("the banner reports the result", /characters in/.test(t("banner")), t("banner"));
ok("the stats show steps", /steps/.test(t("stats")), t("stats"));

/* switch program, run again */
d.querySelectorAll("#pick button")[1].dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
d.getElementById("input").value = "a    b";
click("run");
ok("the second program squeezes spaces", t("output") === "a b", t("output"));

/* empty input is handled, not crashed on */
d.getElementById("input").value = "";
click("run");
ok("empty input produces empty output", t("output") === "", JSON.stringify(t("output")));
ok("no error was thrown on empty input", errors.length === 0, errors.join("; "));

console.log("");
console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
