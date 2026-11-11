# Clip Loom — user guide

**Version 1.0.0 · PolyForm Noncommercial 1.0.0**

Clean text before you paste it — with programs you can read in full.

A link with eleven tracking parameters. Text pulled out of a PDF with three spaces between every
word. A paragraph going into a field that will not wrap. Clip Loom does those jobs with **twenty
lines of Weft-8 assembly each**, running on a machine that lives in the page.

Open it: <https://drsamonline.github.io/app-clip-loom/>

## The five programs

| Program | What it does | The idea it uses |
|---|---|---|
| **Strip the query string** | cut a URL at the `?` | compare each byte with `0x3F`, stop when it matches |
| **Squeeze runs of spaces** | `a    b` → `a b` | remember the *previous* byte in a register and compare |
| **Wrap at 40 characters** | insert a newline every 40 | count down in a register and refill it — the same code for any length |
| **Strip query and fragment** | cut at `?` and at `#` | two terminators instead of one |
| **One line per sentence** | newline after every `.` | one more comparison in the copy loop |

Every program reads one byte at a time from the `CLIPBOARD` port, decides, and writes. No regular
expressions, no library, nothing you cannot follow with a pencil.

## Why it is built this way

This app does not carry its own computer. `docs/play/weft8.js` is the **Weft-8** from
[Jacquard](https://github.com/drsamonline/app-jacquard) — byte for byte the same engine, the same one
its 102 assertions cover. What this repository adds is a host: a clipboard that hands the machine one
byte at a time and collects what it writes.

The machine is shared; the job is a peripheral. That is the whole design, and it means a fix to the
engine reaches every tool built on it.

## When to use it

- Pasting a link into a document, an email or a chat where the tracking tail is noise.
- Cleaning text out of a PDF before it goes into a field.
- Wrapping a paragraph for somewhere that will not do it for you.

It is a text filter, not a clipboard manager: it cleans what you paste into it.

## Licence

PolyForm Noncommercial 1.0.0. See [LICENSE](../LICENSE).
