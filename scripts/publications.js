// Renders the Publications table from data/references.bib so the list can be
// updated by editing that one file instead of this page's HTML.
// Requires the page to be served over http(s) -- `fetch` of a local file
// does not work when index.html is opened directly via file://.

(function () {
  const SELF_FAMILY = 'kenia';
  const SELF_GIVEN = 'roshan';

  function parseBibtex(text) {
    const entries = [];
    let i = 0;
    while (true) {
      const at = text.indexOf('@', i);
      if (at === -1) break;
      const braceStart = text.indexOf('{', at);
      if (braceStart === -1) break;
      const type = text.slice(at + 1, braceStart).trim().toLowerCase();
      let depth = 1;
      let j = braceStart + 1;
      while (depth > 0 && j < text.length) {
        if (text[j] === '{') depth++;
        else if (text[j] === '}') depth--;
        j++;
      }
      entries.push({ type: type, body: text.slice(braceStart + 1, j - 1) });
      i = j;
    }
    return entries.map(parseEntryBody).filter(Boolean);
  }

  function parseEntryBody(entry) {
    if (!entry.type || entry.type.startsWith('comment')) return null;
    const body = entry.body;
    const commaIdx = body.indexOf(',');
    if (commaIdx === -1) return null;
    const key = body.slice(0, commaIdx).trim();
    const rest = body.slice(commaIdx + 1);
    const fields = {};
    let k = 0;
    while (k < rest.length) {
      while (k < rest.length && /[\s,]/.test(rest[k])) k++;
      if (k >= rest.length) break;
      const eq = rest.indexOf('=', k);
      if (eq === -1) break;
      const fieldName = rest.slice(k, eq).trim().toLowerCase();
      let v = eq + 1;
      while (v < rest.length && /\s/.test(rest[v])) v++;
      let value = '';
      let p;
      if (rest[v] === '{') {
        let depth = 1;
        const start = v + 1;
        p = v + 1;
        while (depth > 0 && p < rest.length) {
          if (rest[p] === '{') depth++;
          else if (rest[p] === '}') depth--;
          if (depth > 0) p++;
        }
        value = rest.slice(start, p);
        p = p + 1;
      } else {
        const start = v;
        p = v;
        while (p < rest.length && rest[p] !== ',') p++;
        value = rest.slice(start, p).trim();
      }
      fields[fieldName] = unescapeLatex(value.trim());
      k = p;
    }
    return { type: entry.type, key: key, fields: fields };
  }

  function unescapeLatex(s) {
    return s
      .replace(/\\&/g, '&')
      .replace(/[{}]/g, '')
      .replace(/--/g, '–');
  }

  function formatAuthors(authorField) {
    if (!authorField) return '';
    return authorField
      .split(' and ')
      .map(function (a) {
        a = a.trim();
        if (a.toLowerCase() === 'others') return 'et al.';
        let full = a;
        let family = a;
        let given = '';
        if (a.indexOf(',') !== -1) {
          const parts = a.split(',');
          family = parts[0].trim();
          given = parts[1].trim();
          full = given + ' ' + family;
        }
        const isSelf =
          family.toLowerCase() === SELF_FAMILY &&
          given.toLowerCase().indexOf(SELF_GIVEN) !== -1;
        return isSelf ? '<strong>' + full + '</strong>' : full;
      })
      .join(', ');
  }

  function buildLinks(fields, titleTarget) {
    const links = [];
    if (fields.project) links.push('<a href="' + fields.project + '">project page</a>');
    // Only show arXiv as its own link if it isn't already the title's target
    // (i.e. a `url` was present and took priority for the title link).
    if (fields.arxiv && fields.arxiv !== titleTarget) {
      links.push('<a href="' + fields.arxiv + '">arXiv</a>');
    }
    if (fields.code) links.push('<a href="' + fields.code + '">code</a>');
    return links.join(' /\n    ');
  }

  function renderEntry(entry) {
    const f = entry.fields;
    const venue = f.booktitle || f.journal || f.organization || '';
    const titleTarget = f.url || f.arxiv;
    const titleHtml = titleTarget
      ? '<a href="' + titleTarget + '"><span class="papertitle">' + f.title + '</span></a>'
      : '<span class="papertitle">' + f.title + '</span>';
    const links = buildLinks(f, titleTarget);
    const bgcolor = f.highlight === 'true' ? ' bgcolor="#ffffd0"' : '';

    const textCell =
      titleHtml +
      '\n    <br>\n    ' +
      formatAuthors(f.author) +
      '\n    <br>\n    <em>' +
      venue +
      '</em>' +
      (f.year ? ', ' + f.year : '') +
      (links ? '\n    <br>\n    ' + links : '') +
      (f.note ? '\n    <p></p>\n    <p>\n    ' + f.note + '\n    </p>' : '');

    if (f.image) {
      return (
        '<tr' + bgcolor + '>\n' +
        '  <td style="padding:16px;width:20%;vertical-align:middle">\n' +
        '    <img src="images/' + f.image + '" width="160" height="160">\n' +
        '  </td>\n' +
        '  <td style="padding:8px;width:80%;vertical-align:middle">\n    ' +
        textCell +
        '\n  </td>\n' +
        '</tr>'
      );
    }
    return (
      '<tr' + bgcolor + '>\n' +
      '  <td style="padding:16px;width:100%;vertical-align:middle">\n    ' +
      textCell +
      '\n  </td>\n' +
      '</tr>'
    );
  }

  function render(entries) {
    entries.sort(function (a, b) {
      return (parseInt(b.fields.year, 10) || 0) - (parseInt(a.fields.year, 10) || 0);
    });
    const container = document.getElementById('pub-rows');
    if (!container) return;
    container.innerHTML = entries.map(renderEntry).join('\n\n');
  }

  const container = document.getElementById('pub-rows');
  if (!container) return;

  fetch('data/references.bib')
    .then(function (res) {
      if (!res.ok) throw new Error('Could not load data/references.bib (' + res.status + ')');
      return res.text();
    })
    .then(function (text) {
      render(parseBibtex(text));
    })
    .catch(function (err) {
      container.innerHTML =
        '<tr><td style="padding:16px;color:#900;">Could not load publications: ' +
        err.message +
        ' (note: this list only loads when the page is served over http/https, not opened directly as a file).</td></tr>';
    });
})();
