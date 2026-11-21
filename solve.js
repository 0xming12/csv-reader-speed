// Fast drop-in for csv-reader 1.0.0 (make.fun csv-reader-speed-01-run-20261121).
//
// Slice plain fields directly from the input. Scan quoted fields up to their
// closing quote, counting line breaks and rebuilding only transformed text.
//
// Semantics (csv-reader 1.0.0's written broken-row policy):
// - U+FEFF at the very start is dropped; a record ends at LF or CRLF; a line
//   left with no characters is no record.
// - Outside quotes a CR not followed by LF is dropped (stray_cr).
// - A field opening with a quote runs to the next quote that is not doubled
//   ("" is one quote); CRLF and lone CR inside it read as LF; what follows
//   its closing quote up to the next comma or line break is appended as it
//   stands (quote_junk); a quote that never closes is a literal character
//   and the text after it is re-read as unquoted (unterminated_quote).
// - A quote inside an unquoted field is a literal character; fields stay
//   strings, never trimmed or converted.
// - Short rows are padded with "" (short_row, with fields: its count), long
//   rows are cut (long_row, with extra: the cut fields); every error is
//   {code, line, row} with the line the record starts on (1-based) and the
//   row its index in rows (null for the header).

const LF = 10;
const CR = 13;
const COMMA = 44;
const QUOTE = 34;

/** csv-reader 1.0.0's answer for one case's input, {text, header}. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const len = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = 0;
  let line = 1;
  if (len !== 0 && text.charCodeAt(0) === 0xFEFF) pos = 1;

  // The record being read: the line it starts on and its index in rows.
  let recordLine = 1;
  let recordRow = null;

  // Commit the position and physical line count only after finding a
  // closing quote. An unterminated field is then reread as unquoted.
  function readQuoted() {
    let close = text.indexOf('"', pos + 1);
    while (close !== -1) {
      if (text.charCodeAt(close + 1) !== QUOTE) {
        const interior = text.slice(pos + 1, close);
        pos = close + 1;
        return interior.replace(/""|\r\n?|\n/g, (special) => {
          if (special === '""') return '"';
          line++;
          return '\n';
        });
      }
      close = text.indexOf('"', close + 2);
    }
    return undefined;
  }

  while (true) {
    // Lines with no characters are no records.
    while (pos < len) {
      const c = text.charCodeAt(pos);
      if (c === LF) {
        pos += 1;
        line += 1;
      } else if (c === CR && text.charCodeAt(pos + 1) === LF) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= len) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let delimiter;
    let quoted;
    do {
      quoted = text.charCodeAt(pos) === QUOTE;
      let value = '';
      let closedQuote = false;
      if (quoted) {
        const interior = readQuoted();
        if (interior === undefined) {
          errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
          value = '"';
          pos++;
        } else {
          value = interior;
          closedQuote = true;
        }
      }

      let start = pos;
      let end = pos;
      let hasSuffix = false;
      for (;;) {
        while (end < len) {
          delimiter = text.charCodeAt(end);
          if (delimiter === COMMA || delimiter === LF || delimiter === CR) break;
          end++;
        }
        if (end > start) {
          value += text.slice(start, end);
          hasSuffix = true;
        }
        if (end === len) {
          delimiter = undefined;
          pos = len;
          break;
        }
        if (delimiter === CR && text.charCodeAt(end + 1) !== LF) {
          errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
          end++;
          start = end;
          continue;
        }
        pos = end + (delimiter === CR ? 2 : 1);
        if (delimiter !== COMMA) line++;
        break;
      }
      if (closedQuote && hasSuffix) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
      fields.push(value);
    } while (delimiter === COMMA);

    // A line that held only stray CRs is left with no characters: no record
    // (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
