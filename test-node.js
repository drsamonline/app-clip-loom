/* test-node.js — the proof for Clip Loom.
 *
 * The machine is the Loom's Weft-8 (unchanged). What is asserted here is that
 * every clipboard program does what its pitch says — on the examples it ships,
 * on the edges, and on text long enough to exercise a counter.
 *
 * Run: node test-node.js
 *
 * SPDX-FileCopyrightText: 2026 Dr Sohil Momin
 * SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
 */
"use strict";

const W = require("./docs/play/weft8.js");
const Clip = require("./docs/play/clip.js");

let pass = 0;
const failures = [];
const ok = (c, n) => { if (c) { pass++; return; } failures.push(n); console.log("  FAIL  " + n); };
const eq = (g, w, n) => ok(JSON.stringify(g) === JSON.stringify(w),
  n + "  (got " + JSON.stringify(g) + ", want " + JSON.stringify(w) + ")");

/* ------------------------------------------------------------- the machine */
console.log("the machine — the Loom's Weft-8, unchanged");
{
  const a = W.assemble("LDI 0x2A\nMOV R3, R0\nHLT");
  eq(a.all, [0x00, 0x2A, 0x01, 0x30, 0x1A, 0x00], "the encoding is still two bytes, opcode first");
  eq(Object.keys(W.OPCODES).length, 27, "the instruction set is still 27 opcodes");
}

/* ------------------------------------------------------------- the programs */
console.log("the programs — every shipped example, on the real machine");

Clip.PROGRAMS.forEach(function (p) {
  const a = W.assemble(p.source);
  eq(a.errors, [], p.id + ": assembles");
  ok(a.all.length <= 128, p.id + ": fits the 128-byte ROM (" + a.all.length + " bytes)");
  ok(p.examples.length >= 3, p.id + ": ships at least three examples");
  p.examples.forEach(function (ex, i) {
    const r = Clip.run(p, ex.in);
    eq(r.errors, [], p.id + " example " + (i + 1) + ": no assemble errors");
    eq(r.output, ex.out, p.id + " example " + (i + 1) + " — " + JSON.stringify(ex.in));
    ok(r.halted, p.id + " example " + (i + 1) + ": the program reaches HLT");
  });
});

/* ------------------------------------------------------------------ the edges */
console.log("the edges — empty text, no terminator, long text");

{
  const r = Clip.run(Clip.programById("strip-query"), "");
  eq(r.output, "", "an empty clipboard produces an empty result");
  eq(r.steps > 0, true, "and the machine still ran (it read the end-of-text byte)");
}
{
  const r = Clip.run(Clip.programById("strip-query"), "no-question-mark-here");
  eq(r.output, "no-question-mark-here", "text with no ? passes through untouched");
}
{
  const long = "x".repeat(120);
  const r = Clip.run(Clip.programById("wrap-40"), long);
  eq(r.output.split("\n").length, 4, "120 characters wrapped at 40 gives 3 newlines (4 lines)");
  eq(r.output.replace(/\n/g, ""), long, "and no character is lost");
  ok(r.steps < 20000, "it finishes well inside the step limit (" + r.steps + " steps)");
}
{
  const r = Clip.run(Clip.programById("squeeze-spaces"), "     ");
  eq(r.output, " ", "a run of five spaces becomes one");
}
{
  const r = Clip.run(Clip.programById("drop-after-hash"), "a?b#c");
  eq(r.output, "a", "the strict stripper cuts at the first terminator it meets");
}

/* ------------------------------------------------------------ the programs bite */
console.log("the programs bite — a broken one is caught");

{
  /* remove the ? comparison from strip-query: the query must survive, so the
   * example that says it should not must fail. */
  const broken = Clip.programById("strip-query").source.replace(/LDI 0x3F[^\n]*\n/, "LDI 0x00\n");
  const r = Clip.run({ source: broken }, "https://example.com/page?utm_source=mail");
  ok(r.output.indexOf("?") >= 0, "with the '?' test removed the query survives — so the example really tests it");
}
{
  /* a program that never reads the clipboard produces nothing */
  const r = Clip.run({ source: "LDI 65\nOUT CLIPBOARD\nHLT" }, "abc");
  eq(r.output, "A", "a program that ignores the input writes only what it is told");
}

/* ------------------------------------------------------------------- summary */

/* the family — every page links back to the Loom, and the Loom to every page */
{
  const fsm = require("fs");
  const landing = fsm.readFileSync("./docs/index.html", "utf8");
  ok(landing.indexOf('id="family"') > 0, "the landing page carries the family strip");
  ok(landing.indexOf("you are here") > 0, "and marks this page as the one you are on");
  ['app-jacquard', 'app-weft-puzzles', 'weft8-hardware', 'weft8-kit', 'weft8-classroom', 'weft8-compare'].forEach(function (slug) {
    ok(landing.indexOf("https://drsamonline.github.io/" + slug + "/") > 0, "it links to " + slug);
  });
  const readme = fsm.readFileSync("./README.md", "utf8");
  ok(readme.indexOf("The Weft-8 family") > 0, "the README carries the family table too");
  ok(readme.indexOf("you are here") > 0, "and marks this repository in it");
}


/* the copy counts what the data holds — so a new level cannot leave the page lying */
{
  const fsc = require("fs");
  const land = fsc.readFileSync("./docs/index.html", "utf8");
  ok(land.indexOf("five programs") >= 0, "the landing page states the right count: five programs");
  ok(Clip.PROGRAMS.length === 5, "and the data really has that many");
}

console.log("");
console.log(pass + " passed, " + failures.length + " failed");
if (failures.length) { failures.forEach(f => console.log("  - " + f)); process.exit(1); }
