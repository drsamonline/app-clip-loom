/* clip.js — clipboard programs for Clip Loom.
 *
 * The machine is the Weft-8 from Jacquard (the Loom) — docs/play/weft8.js, byte
 * for byte the same engine. This file gives it the two ports a text filter needs:
 *
 *   CLIPBOARD (0xC6, the Loom's own port)  read = next byte, 0 = end of text
 *                                          write = append a byte
 *   CLOCK     (0xC0, the Loom's own port)  read = the hour
 *
 * So a clipboard program is a real program: it reads one byte at a time, decides,
 * and writes. Nothing is regex, nothing is hidden in a framework.
 *
 * SPDX-FileCopyrightText: 2026 Dr Sohil Momin
 * SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./weft8.js"));
  else root.Clip = factory(root.Weft8);
})(typeof self !== "undefined" ? self : this, function (Weft8) {
  "use strict";

  var QMARK = 0x3F, HASH = 0x23, SPACE = 0x20, NEWLINE = 0x0A;

  /* ------------------------------------------------------------- the programs
   * Each carries its own source, a plain-English claim, and examples. The test
   * suite runs every example through the real machine.
   */
  var PROGRAMS = [
    {
      id: "strip-query",
      name: "Strip the query string",
      pitch: "Cut a URL at the ? — tracking parameters gone before you paste it anywhere.",
      note: "Everything from the first ? onwards is dropped. A # fragment is kept, because it is part of the page you meant.",
      source: [
        "; copy bytes until a '?' appears, then stop",
        "loop:   IN  CLIPBOARD",
        "        JZ  done             ; 0 = end of the text",
        "        MOV R1, R0",
        "        LDI 0x3F             ; '?'",
        "        MOV R2, R0",
        "        CMP R1, R2",
        "        JZ  done             ; from here on, drop it",
        "        MOV R0, R1",
        "        OUT CLIPBOARD",
        "        JMP loop",
        "done:   HLT"
      ].join("\n"),
      examples: [
        { in: "https://example.com/page?utm_source=mail&utm_campaign=x", out: "https://example.com/page" },
        { in: "https://example.com/page", out: "https://example.com/page" },
        { in: "https://example.com/a?b=1#section", out: "https://example.com/a" },
        { in: "", out: "" }
      ]
    },
    {
      id: "squeeze-spaces",
      name: "Squeeze runs of spaces",
      pitch: "Text pasted out of a PDF is full of double and triple spaces. Make them one.",
      note: "A space is dropped when the byte before it was also a space. Tabs and newlines are left alone.",
      source: [
        "; drop a space when the previous byte written was a space",
        "        LDI 0",
        "        MOV R3, R0           ; R3 = the previous byte (0 = nothing yet)",
        "loop:   IN  CLIPBOARD",
        "        JZ  done",
        "        MOV R1, R0           ; R1 = this byte",
        "        LDI 0x20             ; ' '",
        "        MOV R2, R0",
        "        CMP R1, R2",
        "        JNZ keep             ; not a space -> write it",
        "        CMP R3, R2           ; was the last one a space too?",
        "        JZ  skip             ; yes -> drop this one",
        "keep:   MOV R0, R1",
        "        OUT CLIPBOARD",
        "        MOV R3, R1           ; remember what we wrote",
        "        JMP loop",
        "skip:   JMP loop",
        "done:   HLT"
      ].join("\n"),
      examples: [
        { in: "a    b", out: "a b" },
        { in: "one  two   three", out: "one two three" },
        { in: "no-runs-here", out: "no-runs-here" },
        { in: "  leading stays one", out: " leading stays one" }
      ]
    },
    {
      id: "wrap-40",
      name: "Wrap at 40 characters",
      pitch: "Paste into a field that has no wrapping of its own — a textarea, a comment box, a form.",
      note: "A newline is inserted every 40 characters. The counter counts down and refills, so the program is the same three instructions however long the text is.",
      source: [
        "; every 40 characters, write a newline",
        "        LDI 40",
        "        MOV R3, R0           ; R3 = the countdown",
        "loop:   IN  CLIPBOARD",
        "        JZ  done",
        "        OUT CLIPBOARD",
        "        LDI 1",
        "        MOV R5, R0",
        "        SUB R3, R5           ; R3 = R3 - 1",
        "        JNZ loop             ; not zero yet",
        "        LDI 0x0A             ; newline",
        "        OUT CLIPBOARD",
        "        LDI 40",
        "        MOV R3, R0           ; refill",
        "        JMP loop",
        "done:   HLT"
      ].join("\n"),
      examples: [
        { in: "1234567890123456789012345678901234567890X", out: "1234567890123456789012345678901234567890\nX" },
        { in: "short", out: "short" },
        { in: "", out: "" }
      ]
    },
    {
      id: "drop-after-hash",
      name: "Strip the query and the fragment",
      pitch: "The strict version: cut at the ? and at the #, so only the path survives.",
      note: "Two terminators instead of one. Useful when you want the page, not the section of the page.",
      source: [
        "; stop at '?' or '#'",
        "loop:   IN  CLIPBOARD",
        "        JZ  done",
        "        MOV R1, R0",
        "        LDI 0x3F",
        "        MOV R2, R0",
        "        CMP R1, R2",
        "        JZ  done",
        "        LDI 0x23             ; '#'",
        "        MOV R2, R0",
        "        CMP R1, R2",
        "        JZ  done",
        "        MOV R0, R1",
        "        OUT CLIPBOARD",
        "        JMP loop",
        "done:   HLT"
      ].join("\n"),
      examples: [
        { in: "https://example.com/a?b=1#section", out: "https://example.com/a" },
        { in: "https://example.com/a#section", out: "https://example.com/a" },
        { in: "https://example.com/a", out: "https://example.com/a" }
      ]
    },
    {
      id: "break-at-stops",
      name: "One line per sentence",
      pitch: "Long paragraphs read better when every full stop starts a new line.",
      note: "A newline is written after every '.' — and only after a '.', so abbreviations are not special-cased. It is a five-instruction change to the copy loop.",
      source: [
        "; write a newline after every full stop",
        "loop:   IN  CLIPBOARD",
        "        JZ  done",
        "        MOV R1, R0",
        "        OUT CLIPBOARD",
        "        LDI 0x2E             ; '.'",
        "        MOV R2, R0",
        "        CMP R1, R2",
        "        JNZ loop",
        "        LDI 0x0A             ; newline",
        "        OUT CLIPBOARD",
        "        JMP loop",
        "done:   HLT"
      ].join("\n"),
      examples: [
        { in: "One. Two. Three.", out: "One.\n Two.\n Three.\n" },
        { in: "no full stop here", out: "no full stop here" },
        { in: "", out: "" }
      ]
    }
  ];

  function programById(id) {
    for (var i = 0; i < PROGRAMS.length; i++) if (PROGRAMS[i].id === id) return PROGRAMS[i];
    return null;
  }

  /* ------------------------------------------------------------------- the host */
  function host(text) {
    var input = String(text == null ? "" : text);
    var at = 0;
    var out = "";
    return {
      output: out,
      written: function () { return out; },
      reads: 0,
      "in": function (port, name) {
        if (name === "CLIPBOARD") {
          this.reads++;
          if (at >= input.length) return 0;
          return input.charCodeAt(at++) & 0xFF;
        }
        if (name === "CLOCK") return 9;
        return 0;
      },
      out: function (port, value, name) {
        if (name === "CLIPBOARD") { out += String.fromCharCode(value & 0xFF); this.output = out; }
      }
    };
  }

  /* run(program, text, maxSteps) -> what the UI and the tests both need */
  function run(program, text, maxSteps) {
    var a = Weft8.assemble(program.source);
    if (a.errors.length) return { errors: a.errors, output: "", steps: 0, halted: false };
    var h = host(text);
    var vm = new Weft8.VM({ rom: a.bytes, peripherals: h });
    vm.run(maxSteps === undefined ? 20000 : maxSteps);
    return {
      errors: [], output: h.written(), steps: vm.steps, halted: vm.halted,
      error: vm.error, bytes: a.all, reads: h.reads
    };
  }

  return { PROGRAMS: PROGRAMS, programById: programById, host: host, run: run };
});
