// Fast drop-in for csv-reader 1.0.0 (make.fun csv-reader-speed-01-run-20261121).
//
// Same answers as the reference reader, produced by a single-pass scanner:
// plain fields are taken with slice() between delimiters found by indexOf(),
// so the common case never runs a per-character loop. Only quoted fields
// that contain line breaks, doubled quotes, or junk after the closing quote
// take slower paths, and only broken rows allocate extra segments.
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

  // Reads an unquoted field starting at pos, appending onto `value`.
  // Returns {value, ended, added}: ended 0 = comma, 1 = line break,
  // 2 = end of text; added counts the characters kept. A CR not followed
  // by LF is dropped and recorded as stray_cr; the field then goes on.
  function readUnquoted(value) {
    let added = 0;
    let start = pos;
    for (;;) {
      let i = pos;
      let end = -1;
      let kind = 2;
      while (i < len) {
        const c = text.charCodeAt(i);
        if (c === COMMA) { end = i; kind = 0; break; }
        if (c === LF) { end = i; kind = 1; break; }
        if (c === CR) { end = i; kind = 2; break; }
        i++;
      }
      if (end === -1) {
        if (pos < len) {
          const seg = text.slice(pos);
          value = value === '' ? seg : value + seg;
          added += len - pos;
          pos = len;
        }
        return { value, ended: 2, added };
      }
      if (kind === 2 && text.charCodeAt(end + 1) !== LF) {
        // Lone CR: dropped, stray_cr, the field goes on.
        errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
        if (end > start) {
          const seg = text.slice(start, end);
          value = value === '' ? seg : value + seg;
          added += end - start;
        }
        pos = end + 1;
        start = pos;
        continue;
      }
      if (end > start) {
        const seg = text.slice(start, end);
        value = value === '' ? seg : value + seg;
        added += end - start;
      }
      if (kind === 0) {
        pos = end + 1;
        return { value, ended: 0, added };
      }
      pos = end + (kind === 1 ? 1 : 2);
      line += 1;
      return { value, ended: 1, added };
    }
  }

  // Reads a quoted field whose opening quote is at pos.
  // Returns {value, ended} with ended as readUnquoted's.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    let start = pos + 1;
    let parts = null;
    let closedAt = -1;
    for (;;) {
      const q = text.indexOf('"', start);
      if (q === -1) break;
      if (text.charCodeAt(q + 1) === QUOTE) {
        if (parts === null) parts = [];
        parts.push(text.slice(start, q));
        parts.push('"');
        start = q + 2;
        continue;
      }
      closedAt = q;
      break;
    }
    if (closedAt === -1) {
      // The quote never closes: it is a literal character, and the text
      // after it is read again as unquoted.
      pos = open + 1;
      line = openLine;
      errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
      return readUnquoted('"');
    }
    // The interior is [open + 1, closedAt). Fast when it holds no line
    // break: no line to count, no CR to turn into LF.
    const nl = text.indexOf('\n', open + 1);
    const cr = text.indexOf('\r', open + 1);
    const hasBreak = (nl !== -1 && nl < closedAt) || (cr !== -1 && cr < closedAt);
    let value;
    if (!hasBreak) {
      value = parts === null ? text.slice(open + 1, closedAt) : parts.join('') + text.slice(start, closedAt);
    } else {
      // Slow path: rebuild the interior turning CRLF and lone CR into LF,
      // counting one line per line break.
      const inner = parts === null ? text.slice(open + 1, closedAt) : parts.join('') + text.slice(start, closedAt);
      value = '';
      let p = 0;
      const n = inner.length;
      while (p < n) {
        const iCr = inner.indexOf('\r', p);
        const iLf = inner.indexOf('\n', p);
        let k = -1;
        let isCr = false;
        if (iCr !== -1 && (iLf === -1 || iCr < iLf)) {
          k = iCr;
          isCr = true;
        } else if (iLf !== -1) {
          k = iLf;
        }
        if (k === -1) {
          value += inner.slice(p);
          break;
        }
        if (k > p) value += inner.slice(p, k);
        value += '\n';
        line += 1;
        p = isCr && inner.charCodeAt(k + 1) === LF ? k + 2 : k + 1;
      }
    }
    pos = closedAt + 1;
    if (pos >= len) return { value, ended: 2 };
    const c = text.charCodeAt(pos);
    if (c === COMMA) {
      pos += 1;
      return { value, ended: 0 };
    }
    if (c === LF) {
      pos += 1;
      line += 1;
      return { value, ended: 1 };
    }
    if (c === CR && text.charCodeAt(pos + 1) === LF) {
      pos += 2;
      line += 1;
      return { value, ended: 1 };
    }
    // What follows the closing quote is appended as it stands, up to the
    // next comma or line break.
    const junk = readUnquoted(value);
    if (junk.added > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
    return junk;
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
    let field;
    let quoted = false;
    do {
      quoted = text.charCodeAt(pos) === QUOTE;
      field = quoted ? readQuoted() : readUnquoted('');
      fields.push(field.value);
    } while (field.ended === 0);

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
