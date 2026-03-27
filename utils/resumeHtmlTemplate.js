/**
 * Professional resume HTML for print/PDF (ATS-friendly: real text, simple structure).
 * @param {import('./resumeStructured').StructuredResume} structured
 * @returns {string} full HTML document
 */
const buildStructuredResumeHtml = (structured) => {
  const esc = (s) => {
    if (s == null || s === '') return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

  const c = structured.contact || {};
  const contactBits = [c.email, c.phone, c.location, c.linkedin, c.github, c.website].filter(
    (x) => x && String(x).trim()
  );

  const experienceHtml = (structured.experience || [])
    .map((ex) => {
      const has =
        ex.title ||
        ex.company ||
        (ex.bullets && ex.bullets.length) ||
        ex.dates ||
        ex.location;
      if (!has) return '';
      const headline = [ex.title, ex.company].filter(Boolean).join(' — ');
      const meta = [ex.location, ex.dates].filter(Boolean).join(' · ');
      const bullets = (ex.bullets || [])
        .filter((b) => b && String(b).trim())
        .map((b) => `<li>${esc(String(b).trim())}</li>`)
        .join('');
      return `
        <article class="exp-block">
          <div class="exp-head">
            <div class="exp-title">${esc(headline)}</div>
            ${meta ? `<div class="exp-meta">${esc(meta)}</div>` : ''}
          </div>
          ${bullets ? `<ul class="bullets">${bullets}</ul>` : ''}
        </article>`;
    })
    .join('');

  const educationHtml = (structured.education || [])
    .map((ed) => {
      const top = [ed.degree, ed.school].filter(Boolean).join(' — ');
      const meta = [ed.location, ed.dates].filter(Boolean).join(' · ');
      if (!top && !ed.details) return '';
      return `
        <article class="edu-block">
          <div class="exp-head">
            <div class="exp-title">${esc(top)}</div>
            ${meta ? `<div class="exp-meta">${esc(meta)}</div>` : ''}
          </div>
          ${ed.details ? `<p class="edu-detail">${esc(ed.details)}</p>` : ''}
        </article>`;
    })
    .join('');

  let skillsHtml = '';
  const skills = structured.skills;
  if (skills?.length) {
    if (typeof skills[0] === 'string') {
      skillsHtml = `<div class="skill-pills">${skills
        .filter(Boolean)
        .map((s) => `<span class="pill">${esc(s)}</span>`)
        .join('')}</div>`;
    } else {
      skillsHtml = (skills || [])
        .map((g) => {
          if (!g || typeof g !== 'object') return '';
          const label = (g.label || '').trim();
          const items = Array.isArray(g.items) ? g.items.filter(Boolean) : [];
          if (label && items.length) {
            return `<div class="skill-group"><span class="skill-label">${esc(label)}</span> ${esc(items.join(', '))}</div>`;
          }
          if (items.length) return `<div class="skill-group">${esc(items.join(', '))}</div>`;
          return '';
        })
        .join('');
    }
  }

  const certHtml = (structured.certifications || [])
    .map((cert) => {
      const row = [cert.name, cert.issuer, cert.date].filter(Boolean).join(' — ');
      return row ? `<div class="cert-line">${esc(row)}</div>` : '';
    })
    .join('');

  const projectsHtml = (structured.projects || [])
    .map((pr) => {
      const bullets = (pr.bullets || [])
        .filter((b) => b && String(b).trim())
        .map((b) => `<li>${esc(String(b).trim())}</li>`)
        .join('');
      return `
        <article class="proj-block">
          ${pr.name ? `<div class="proj-name">${esc(pr.name)}</div>` : ''}
          ${pr.description ? `<p class="proj-desc">${esc(pr.description)}</p>` : ''}
          ${bullets ? `<ul class="bullets">${bullets}</ul>` : ''}
        </article>`;
    })
    .join('');

  const summarySection = structured.summary
    ? `<section class="section">
        <h2 class="section-title">Summary</h2>
        <p class="summary-text">${esc(structured.summary)}</p>
      </section>`
    : '';

  const expSection = experienceHtml
    ? `<section class="section"><h2 class="section-title">Experience</h2>${experienceHtml}</section>`
    : '';

  const eduSection = educationHtml
    ? `<section class="section"><h2 class="section-title">Education</h2>${educationHtml}</section>`
    : '';

  const skillsSection = skillsHtml
    ? `<section class="section"><h2 class="section-title">Skills</h2>${skillsHtml}</section>`
    : '';

  const certSection = certHtml
    ? `<section class="section"><h2 class="section-title">Certifications</h2><div class="cert-list">${certHtml}</div></section>`
    : '';

  const projSection = projectsHtml
    ? `<section class="section"><h2 class="section-title">Projects</h2>${projectsHtml}</section>`
    : '';

  const contactRow = contactBits.length
    ? `<div class="contact-row">${contactBits.map((x) => `<span>${esc(x)}</span>`).join('<span class="dot">·</span>')}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --ink: #0f172a;
      --muted: #475569;
      --line: #e2e8f0;
      --accent: #0d4f6c;
      --accent-soft: #e0f2f7;
      --gold: #b8860b;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: letter; margin: 0; }
    html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body {
      font-family: 'IBM Plex Sans', system-ui, sans-serif;
      font-size: 10.5pt;
      line-height: 1.45;
      color: var(--ink);
      background: #fff;
    }
    .sheet {
      min-height: 11in;
      max-width: 8.5in;
      margin: 0 auto;
      background: #fff;
    }
    .hero {
      background: linear-gradient(145deg, #0a2540 0%, #0d4f6c 48%, #0a3d52 100%);
      color: #fff;
      padding: 1.75rem 2.25rem 1.5rem;
      position: relative;
      border-bottom: 4px solid var(--gold);
    }
    .hero::after {
      content: '';
      position: absolute;
      bottom: -4px;
      left: 2.25rem;
      width: 4rem;
      height: 4px;
      background: rgba(255,255,255,0.35);
    }
    .name {
      font-family: 'Fraunces', Georgia, serif;
      font-size: 2rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      line-height: 1.15;
      margin-bottom: 0.65rem;
    }
    .contact-row {
      font-size: 9pt;
      font-weight: 500;
      opacity: 0.92;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.35rem 0.5rem;
    }
    .contact-row .dot { opacity: 0.55; padding: 0 0.15rem; }
    main {
      padding: 1.5rem 2.25rem 2rem;
    }
    .section { margin-bottom: 1.35rem; }
    .section:last-child { margin-bottom: 0; }
    .section-title {
      font-family: 'Fraunces', Georgia, serif;
      font-size: 11pt;
      font-weight: 600;
      color: var(--accent);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      border-bottom: 2px solid var(--line);
      padding-bottom: 0.35rem;
      margin-bottom: 0.85rem;
    }
    .summary-text {
      color: var(--muted);
      font-size: 10.25pt;
      line-height: 1.55;
      text-align: justify;
      hyphens: auto;
    }
    .exp-block, .edu-block, .proj-block {
      margin-bottom: 1rem;
      padding-left: 0.85rem;
      border-left: 3px solid var(--accent-soft);
    }
    .exp-head {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: baseline;
      gap: 0.35rem 1rem;
      margin-bottom: 0.35rem;
    }
    .exp-title {
      font-weight: 600;
      font-size: 10.75pt;
      color: var(--ink);
      flex: 1 1 55%;
    }
    .exp-meta {
      font-size: 9pt;
      color: var(--muted);
      font-weight: 500;
      text-align: right;
      white-space: nowrap;
    }
    .bullets {
      margin: 0.25rem 0 0 0;
      padding-left: 1.1rem;
      color: #334155;
    }
    .bullets li {
      margin-bottom: 0.3rem;
      padding-left: 0.15rem;
    }
    .bullets li::marker {
      color: var(--accent);
    }
    .edu-detail {
      margin-top: 0.25rem;
      font-size: 10pt;
      color: var(--muted);
    }
    .skill-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }
    .pill {
      display: inline-block;
      font-size: 9.25pt;
      padding: 0.25rem 0.65rem;
      background: var(--accent-soft);
      color: #0c4a5e;
      border-radius: 2px;
      font-weight: 500;
    }
    .skill-group {
      margin-bottom: 0.45rem;
      font-size: 10pt;
      color: #334155;
    }
    .skill-label {
      font-weight: 600;
      color: var(--ink);
    }
    .cert-list { font-size: 10pt; color: #334155; }
    .cert-line {
      padding: 0.35rem 0;
      border-bottom: 1px dotted var(--line);
    }
    .cert-line:last-child { border-bottom: none; }
    .proj-name { font-weight: 600; font-size: 10.75pt; margin-bottom: 0.2rem; }
    .proj-desc { font-size: 10pt; color: var(--muted); margin-bottom: 0.35rem; }
  </style>
</head>
<body>
  <div class="sheet">
    <header class="hero">
      <div class="name">${esc(c.fullName || 'Resume')}</div>
      ${contactRow}
    </header>
    <main>
      ${summarySection}
      ${expSection}
      ${eduSection}
      ${skillsSection}
      ${certSection}
      ${projSection}
    </main>
  </div>
</body>
</html>`;
};

module.exports = { buildStructuredResumeHtml };
