const axios = require('axios');

const PROVIDER = (process.env.JOB_SCRAPER_PROVIDER || 'jsearch').toLowerCase();
const JSEARCH_HOST = process.env.JSEARCH_RAPIDAPI_HOST || 'jsearch.p.rapidapi.com';
const JSEARCH_PATH = process.env.JSEARCH_RAPIDAPI_PATH || '/search-v2';
const JSEARCH_KEY = process.env.JSEARCH_RAPIDAPI_KEY || process.env.JOB_SCRAPER_API_KEY;
const ADZUNA_APP_ID = process.env.ADZUNA_APP_ID;
const ADZUNA_APP_KEY = process.env.ADZUNA_APP_KEY;
const DEFAULT_COUNTRY = (process.env.JOB_SCRAPER_COUNTRY || 'au').toLowerCase();
const DEFAULT_LOCATION =
  process.env.JOB_SCRAPER_DEFAULT_LOCATION || 'Australia';

const experienceToQuery = (experience) => {
  if (experience === undefined || experience === null || experience === '') return '';
  const years = parseInt(String(experience).replace(/\D/g, ''), 10);
  if (Number.isNaN(years)) return String(experience).trim();
  if (years <= 2) return 'entry level junior';
  if (years <= 5) return 'mid level';
  return 'senior experienced';
};

const buildSearchQuery = ({ jobTitle, skills, experience }) => {
  const parts = [
    (jobTitle || '').trim(),
    (skills || '').trim().replace(/,/g, ' '),
    experienceToQuery(experience),
  ].filter(Boolean);
  return parts.join(' ').trim() || 'developer';
};

/**
 * JSearch expects natural-language queries like "software developer jobs in Sydney".
 */
const buildJSearchQuery = ({ jobTitle, skills, experience, location, country }) => {
  const core = buildSearchQuery({ jobTitle, skills, experience });
  let q = /\bjobs\b/i.test(core) ? core : `${core} jobs`;

  const loc = (location || '').trim();
  if (loc) {
    q = `${q} in ${loc}`;
  } else if (country === 'au') {
    const auLoc = DEFAULT_LOCATION.includes('Australia')
      ? DEFAULT_LOCATION
      : `${DEFAULT_LOCATION}, Australia`;
    q = `${q} in ${auLoc}`;
  }

  return q;
};

const normalizeJSearchJob = (item) => ({
  id: item.job_id || item.job_link,
  title: item.job_title || 'Untitled',
  company: item.employer_name || '—',
  location:
    item.job_location ||
    [item.job_city, item.job_state, item.job_country].filter(Boolean).join(', ') ||
    '—',
  description: item.job_description || '',
  jobUrl: item.job_apply_link || item.job_google_link || null,
  platform: item.job_publisher || 'external',
  postedAt: item.job_posted_at_datetime_utc || item.job_posted_at || null,
  employmentType: item.job_employment_type || null,
  isRemote: !!item.job_is_remote,
  salary:
    item.job_salary_string ||
    (item.job_min_salary && item.job_max_salary
      ? `${item.job_min_salary}–${item.job_max_salary} ${item.job_salary_currency || ''}`.trim()
      : item.job_salary || null),
  source: 'jsearch',
});

const ADZUNA_CURRENCY = {
  au: 'AUD',
  gb: 'GBP',
  us: 'USD',
  ca: 'CAD',
  nz: 'NZD',
  in: 'INR',
  sg: 'SGD',
};

const formatAdzunaSalary = (item, country) => {
  const currency = ADZUNA_CURRENCY[country] || '';
  const fmt = (n) => (n != null ? Number(n).toLocaleString('en') : null);
  const min = fmt(item.salary_min);
  const max = fmt(item.salary_max);
  if (min && max) return `${currency} ${min}–${max}`.trim();
  if (min) return `${currency} ${min}+`.trim();
  if (max) return `Up to ${currency} ${max}`.trim();
  return null;
};

const normalizeAdzunaJob = (item, country) => ({
  id: String(item.id),
  title: item.title || 'Untitled',
  company: item.company?.display_name || '—',
  location: item.location?.display_name || '—',
  description: item.description || '',
  jobUrl: item.redirect_url || null,
  platform: 'adzuna',
  postedAt: item.created || null,
  employmentType: item.contract_type || null,
  category: item.category?.label || null,
  isRemote: false,
  salary: formatAdzunaSalary(item, country),
  source: 'adzuna',
});

const getMockJobs = (query, page) => {
  const base = (page - 1) * 10;
  return Array.from({ length: 10 }, (_, i) => {
    const n = base + i + 1;
    return {
      id: `mock-${n}`,
      title: `${query} — Role ${n}`,
      company: `Company ${n}`,
      location: 'Sydney, NSW, Australia',
      description: `Sample listing for "${query}". Configure JSEARCH_RAPIDAPI_KEY for live results.`,
      jobUrl: `https://example.com/jobs/${n}`,
      platform: 'mock',
      postedAt: new Date().toISOString(),
      employmentType: 'FULLTIME',
      isRemote: n % 3 === 0,
      salary: '$80,000–$120,000 AUD',
      source: 'mock',
    };
  });
};

const callJSearchApi = async ({ query, page, country }) => {
  const params = {
    query,
    page: String(page),
    num_pages: '1',
    country: country || DEFAULT_COUNTRY,
    date_posted: 'all',
    language: 'en',
  };

  const { data } = await axios.get(`https://${JSEARCH_HOST}${JSEARCH_PATH}`, {
    params,
    headers: {
      'Content-Type': 'application/json',
      'x-rapidapi-key': JSEARCH_KEY,
      'x-rapidapi-host': JSEARCH_HOST,
    },
    timeout: 25000,
  });

  const rawList = Array.isArray(data.data)
    ? data.data
    : data.data?.jobs || data.jobs || [];
  const jobs = rawList.map(normalizeJSearchJob);
  const hasMore = !!(data.data?.cursor || data.cursor);
  const total =
    data.estimated_total ||
    data.data?.total ||
    (hasMore ? page * 10 + jobs.length : jobs.length);

  return {
    jobs,
    total,
    page,
    hasMore,
    provider: 'jsearch',
    apiQuery: query,
    apiCountry: params.country,
  };
};

const searchJSearch = async ({ jobTitle, skills, experience, page, location, country }) => {
  const countryCode = (country || DEFAULT_COUNTRY).toLowerCase();

  const attempts = [
    {
      query: buildJSearchQuery({
        jobTitle,
        skills,
        experience,
        location,
        country: countryCode,
      }),
      country: countryCode,
      warning: null,
    },
  ];

  // AU often returns empty without a city — retry with explicit Sydney
  if (countryCode === 'au' && !location?.trim()) {
    attempts.push({
      query: buildJSearchQuery({
        jobTitle,
        skills,
        experience,
        location: 'Sydney',
        country: 'au',
      }),
      country: 'au',
      warning: null,
    });
  }

  // Broader international fallback (matches RapidAPI playground behaviour)
  if (countryCode === 'au') {
    attempts.push({
      query: buildJSearchQuery({
        jobTitle,
        skills,
        experience,
        location: location?.trim() || 'United States',
        country: 'us',
      }),
      country: 'us',
      warning:
        'Limited results in Australia for this search. Showing additional listings from other regions.',
    });
  }

  let lastResult = null;
  for (const attempt of attempts) {
    const result = await callJSearchApi({
      query: attempt.query,
      page,
      country: attempt.country,
    });
    lastResult = result;
    if (result.jobs.length > 0) {
      return {
        ...result,
        warning: attempt.warning,
      };
    }
  }

  return {
    ...(lastResult || { jobs: [], total: 0, page, hasMore: false, provider: 'jsearch' }),
    warning:
      'No jobs matched this search. Try a broader job title, add a city (e.g. Sydney), or different skills.',
  };
};

const searchAdzuna = async ({ query, page, location, country }) => {
  const countryCode = (country || DEFAULT_COUNTRY).toLowerCase();
  const params = {
    app_id: ADZUNA_APP_ID,
    app_key: ADZUNA_APP_KEY,
    what: query,
    results_per_page: 10,
  };
  if (location?.trim()) params.where = location.trim();

  const { data } = await axios.get(
    `https://api.adzuna.com/v1/api/jobs/${countryCode}/search/${page}`,
    { params, timeout: 20000 }
  );

  const jobs = (data.results || []).map((item) => normalizeAdzunaJob(item, countryCode));
  return {
    jobs,
    total: data.count || jobs.length,
    page,
    hasMore: page * 10 < (data.count || 0),
    provider: 'adzuna',
    apiCountry: countryCode,
    warning: null,
  };
};

/**
 * Search external job listings by title, skills, and experience.
 */
const searchJobs = async (filters = {}) => {
  const {
    jobTitle = '',
    skills = '',
    experience = '',
    location = '',
    page = 1,
    country = DEFAULT_COUNTRY,
  } = filters;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);

  if (!jobTitle?.trim() && !skills?.trim()) {
    const err = new Error('Job title or skills is required');
    err.statusCode = 400;
    throw err;
  }

  const useJSearch = PROVIDER === 'jsearch' && JSEARCH_KEY;
  const useAdzuna = PROVIDER === 'adzuna' && ADZUNA_APP_ID && ADZUNA_APP_KEY;

  if (useJSearch) {
    try {
      return await searchJSearch({
        jobTitle,
        skills,
        experience,
        page: pageNum,
        location,
        country,
      });
    } catch (err) {
      console.error('JSearch API error:', err.response?.data || err.message);
      if (process.env.JOB_SCRAPER_FALLBACK_MOCK === 'true') {
        const q = buildJSearchQuery({
          jobTitle,
          skills,
          experience,
          location,
          country: DEFAULT_COUNTRY,
        });
        return {
          jobs: getMockJobs(q, pageNum),
          total: 30,
          page: pageNum,
          provider: 'mock',
          warning: 'Live API failed; showing sample data.',
        };
      }
      throw err;
    }
  }

  if (useAdzuna) {
    try {
      const query = buildSearchQuery({ jobTitle, skills, experience });
      return await searchAdzuna({ query, page: pageNum, location, country });
    } catch (err) {
      console.error('Adzuna API error:', err.response?.data || err.message);
      if (process.env.JOB_SCRAPER_FALLBACK_MOCK === 'true') {
        const q = buildSearchQuery({ jobTitle, skills, experience });
        return {
          jobs: getMockJobs(q, pageNum),
          total: 30,
          page: pageNum,
          provider: 'mock',
          warning: 'Adzuna API failed; showing sample data.',
        };
      }
      const apiErr = new Error(
        err.response?.data?.exception || err.message || 'Adzuna API request failed'
      );
      apiErr.statusCode = err.response?.status || 502;
      throw apiErr;
    }
  }

  const q = buildJSearchQuery({
    jobTitle,
    skills,
    experience,
    location,
    country: DEFAULT_COUNTRY,
  });
  return {
    jobs: getMockJobs(q, pageNum),
    total: 30,
    page: pageNum,
    provider: 'mock',
    warning:
      'Job scraper API not configured. Set JSEARCH_RAPIDAPI_KEY in .env',
  };
};

module.exports = {
  searchJobs,
  buildSearchQuery,
  buildJSearchQuery,
};
