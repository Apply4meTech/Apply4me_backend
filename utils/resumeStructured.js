/**
 * Normalized resume shape for PDF rendering and ATS plain-text export.
 * @typedef {Object} StructuredResume
 * @property {Object} contact
 * @property {string} [contact.fullName]
 * @property {string} [contact.email]
 * @property {string} [contact.phone]
 * @property {string} [contact.location]
 * @property {string} [contact.linkedin]
 * @property {string} [contact.github]
 * @property {string} [contact.website]
 * @property {string} [summary]
 * @property {Array<{title?:string,company?:string,location?:string,dates?:string,bullets?:string[]}>} experience
 * @property {Array<{degree?:string,school?:string,location?:string,dates?:string,details?:string}>} education
 * @property {string[]|Array<{label?:string,items?:string[]}>} [skills]
 * @property {Array<{name?:string,issuer?:string,date?:string}>} [certifications]
 * @property {Array<{name?:string,description?:string,bullets?:string[]}>} [projects]
 */

const trimStr = (v) => (typeof v === 'string' ? v.trim() : '');

const cleanBullets = (arr) => {
  if (!Array.isArray(arr)) return [];
  return arr.map(trimStr).filter(Boolean);
};

/**
 * Coerce parsed JSON into a safe, renderable resume object.
 * @param {unknown} raw
 * @returns {StructuredResume}
 */
const normalizeStructuredResume = (raw) => {
  if (!raw || typeof raw !== 'object') {
    return emptyStructuredResume();
  }
  const o = /** @type {Record<string, unknown>} */ (raw);
  const contactIn = o.contact && typeof o.contact === 'object' ? o.contact : {};

  const contact = {
    fullName: trimStr(contactIn.fullName || contactIn.name || o.fullName),
    email: trimStr(contactIn.email),
    phone: trimStr(contactIn.phone),
    location: trimStr(contactIn.location),
    linkedin: trimStr(contactIn.linkedin),
    github: trimStr(contactIn.github),
    website: trimStr(contactIn.website)
  };

  const experience = Array.isArray(o.experience)
    ? o.experience.map((e) => {
        const ex = e && typeof e === 'object' ? e : {};
        return {
          title: trimStr(ex.title),
          company: trimStr(ex.company),
          location: trimStr(ex.location),
          dates: trimStr(ex.dates),
          bullets: cleanBullets(ex.bullets)
        };
      })
    : [];

  const education = Array.isArray(o.education)
    ? o.education.map((e) => {
        const ed = e && typeof e === 'object' ? e : {};
        return {
          degree: trimStr(ed.degree),
          school: trimStr(ed.school || ed.institution),
          location: trimStr(ed.location),
          dates: trimStr(ed.dates),
          details: trimStr(ed.details)
        };
      })
    : [];

  let skills = o.skills;
  if (Array.isArray(skills)) {
    if (skills.length && typeof skills[0] === 'object' && skills[0] !== null) {
      skills = skills
        .map((g) => {
          const gr = g && typeof g === 'object' ? g : {};
          const label = trimStr(gr.label || gr.category || gr.name);
          const items = cleanBullets(gr.items || gr.skills);
          if (!label && !items.length) return null;
          return { label, items };
        })
        .filter(Boolean);
    } else {
      skills = cleanBullets(skills);
    }
  } else {
    skills = [];
  }

  const certifications = Array.isArray(o.certifications)
    ? o.certifications
        .map((c) => {
          const x = c && typeof c === 'object' ? c : {};
          return {
            name: trimStr(x.name || x.title),
            issuer: trimStr(x.issuer),
            date: trimStr(x.date)
          };
        })
        .filter((c) => c.name || c.issuer || c.date)
    : [];

  const projects = Array.isArray(o.projects)
    ? o.projects.map((p) => {
        const x = p && typeof p === 'object' ? p : {};
        return {
          name: trimStr(x.name || x.title),
          description: trimStr(x.description),
          bullets: cleanBullets(x.bullets)
        };
      })
    : [];

  return {
    contact,
    summary: trimStr(o.summary),
    experience,
    education,
    skills,
    certifications,
    projects
  };
};

function emptyStructuredResume() {
  return {
    contact: {
      fullName: '',
      email: '',
      phone: '',
      location: '',
      linkedin: '',
      github: '',
      website: ''
    },
    summary: '',
    experience: [],
    education: [],
    skills: [],
    certifications: [],
    projects: []
  };
}

/**
 * Plain text for ATS re-analysis (clear section headers).
 * @param {StructuredResume} s
 * @returns {string}
 */
const structuredResumeToPlainText = (s) => {
  const blocks = [];
  const c = s.contact || {};
  const headerLines = [c.fullName].filter(Boolean);
  const contactBits = [c.email, c.phone, c.location, c.linkedin, c.github, c.website].filter(Boolean);
  if (headerLines.length) blocks.push(headerLines.join('\n'));
  if (contactBits.length) blocks.push(contactBits.join(' | '));

  if (s.summary) {
    blocks.push('PROFESSIONAL SUMMARY\n\n' + s.summary);
  }

  if (s.experience?.length) {
    const lines = ['EXPERIENCE'];
    for (const ex of s.experience) {
      const top = [ex.title, ex.company].filter(Boolean).join(' — ');
      const meta = [ex.location, ex.dates].filter(Boolean).join(' · ');
      if (top) lines.push(top);
      if (meta) lines.push(meta);
      for (const b of ex.bullets || []) lines.push('• ' + b);
      lines.push('');
    }
    blocks.push(lines.join('\n').trim());
  }

  if (s.education?.length) {
    const lines = ['EDUCATION'];
    for (const ed of s.education) {
      const top = [ed.degree, ed.school].filter(Boolean).join(' — ');
      const meta = [ed.location, ed.dates].filter(Boolean).join(' · ');
      if (top) lines.push(top);
      if (meta) lines.push(meta);
      if (ed.details) lines.push(ed.details);
      lines.push('');
    }
    blocks.push(lines.join('\n').trim());
  }

  if (s.skills?.length) {
    const lines = ['SKILLS'];
    if (typeof s.skills[0] === 'string') {
      lines.push((/** @type {string[]} */ (s.skills)).join(', '));
    } else {
      for (const g of s.skills) {
        if (g && typeof g === 'object' && 'items' in g) {
          const label = trimStr(g.label);
          const items = cleanBullets(g.items);
          if (label) lines.push(label + ': ' + items.join(', '));
          else if (items.length) lines.push(items.join(', '));
        }
      }
    }
    blocks.push(lines.join('\n'));
  }

  if (s.certifications?.length) {
    const lines = ['CERTIFICATIONS'];
    for (const cert of s.certifications) {
      const row = [cert.name, cert.issuer, cert.date].filter(Boolean).join(' — ');
      if (row) lines.push('• ' + row);
    }
    blocks.push(lines.join('\n'));
  }

  if (s.projects?.length) {
    const lines = ['PROJECTS'];
    for (const pr of s.projects) {
      if (pr.name) lines.push(pr.name);
      if (pr.description) lines.push(pr.description);
      for (const b of pr.bullets || []) lines.push('• ' + b);
      lines.push('');
    }
    blocks.push(lines.join('\n').trim());
  }

  return blocks.filter(Boolean).join('\n\n');
};

/**
 * Extract JSON object from model output (handles markdown fences).
 * @param {string} content
 * @returns {unknown|null}
 */
const parseResumeJson = (content) => {
  if (!content || typeof content !== 'string') return null;
  let t = content.trim();
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(t.slice(start, end + 1));
  } catch {
    return null;
  }
};

module.exports = {
  normalizeStructuredResume,
  structuredResumeToPlainText,
  parseResumeJson,
  emptyStructuredResume
};
