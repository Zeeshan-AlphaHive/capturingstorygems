const axios = require('axios');
const { formatLuluError } = require('./luluShipping.js');

const luluApiBase = (process.env.LULU_API_BASE_URL || 'https://api.sandbox.lulu.com').replace(/\/+$/, '');

// simple in-memory cache
let cachedToken = null;
let tokenExpiry = 0;

const TOKEN_URL = `${luluApiBase}/auth/realms/glasstree/protocol/openid-connect/token`;
const PRINT_JOB_URL = `${luluApiBase}/print-jobs/`;
const PRINT_COST_URL = `${luluApiBase}/print-job-cost-calculations/`;

const getValidToken = async () => {
  console.log('Fetching Lulu token...');
  const now = Date.now();

  // prefer pre-encoded credentials if provided
  const encoded = process.env.Lulu_encoded_credentials;
  let authString;

  if (encoded && typeof encoded === 'string' && encoded.trim().length > 0) {
    authString = encoded.replace(/^Basic\s+/i, '').trim();
    console.log('Using pre-encoded Lulu credentials from env');
  } else {
    const key = process.env.Lulu_Client || process.env.LULU_KEY;
    const secret = process.env.Lulu_Client_Secret || process.env.LULU_SECRET;
    if (!key || !secret) {
      throw new Error('Lulu client key/secret not found in environment variables');
    }
    authString = Buffer.from(`${key}:${secret}`).toString('base64');
    console.log('Using Lulu key/secret from env');
  }

  const resp = await axios.post(
    TOKEN_URL,
    'grant_type=client_credentials',
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${authString}`,
      },
    }
  );

  cachedToken = resp.data.access_token;
  tokenExpiry = now + (resp.data.expires_in * 1000) - 60000; // expire 1 minute early
  return cachedToken;
};

const createPrintJob = async (orderData) => {
  const token = await getValidToken();
  console.log('Using Lulu token:', token);

  const resp = await axios.post(PRINT_JOB_URL, orderData, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return resp.data;
};

// module.exports consolidated below

// Calculate print job costs via Lulu API
const calculatePrintCost = async (payload) => {
  const token = await getValidToken();
  console.log("payload", payload);
  try {
    const resp = await axios.post(PRINT_COST_URL, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return resp.data;
  } catch (err) {
    const message = formatLuluError(err);
    console.error('Lulu cost calculation failed:', message, err.response?.data);
    const wrapped = new Error(message);
    wrapped.status = err.response?.status || 400;
    throw wrapped;
  }
};

// Validate an interior PDF (returns validation job/status)
const VALIDATE_INTERIOR_URL = `${luluApiBase}/validate-interior/`;
const validateInterior = async (source_url) => {
  const token = await getValidToken();
  console.log('Validating interior with Lulu. Source URL:', source_url);
  const resp = await axios.post(
    VALIDATE_INTERIOR_URL,
    { source_url },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
    }
  );
  console.log('Interior validation response:', resp.data);
  return resp.data;
};

// Fetch validation status by validation job id
const getInteriorValidationStatus = async (validationId) => {
  const token = await getValidToken();
  const url = `${VALIDATE_INTERIOR_URL}${validationId}/`;
  const resp = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    },
  });
  console.log('Interior validation status response:', resp.data);
  return resp.data;
};

// Validate a cover PDF
const VALIDATE_COVER_URL = `${luluApiBase}/validate-cover/`;
const validateCover = async ({ source_url, pod_package_id, interior_page_count }) => {
  const token = await getValidToken();
  const resp = await axios.post(
    VALIDATE_COVER_URL,
    { source_url, pod_package_id, interior_page_count },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );
  return resp.data;
};

const getCoverValidationStatus = async (validationId) => {
  const token = await getValidToken();
  const url = `${VALIDATE_COVER_URL}${validationId}/`;
  const resp = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return resp.data;
};

// Calculate cover dimensions based on POD package and interior page count
const COVER_DIMENSIONS_URL = `${luluApiBase}/cover-dimensions/`;
const getCoverDimensions = async ({ pod_package_id, interior_page_count, unit } = {}) => {
  const token = await getValidToken();
  const body = { pod_package_id, interior_page_count };
  if (unit) body.unit = unit;
  console.log('Cover dimensions request body:', body);
  console.log('Cover dimensions request URL:', COVER_DIMENSIONS_URL);
  const resp = await axios.post(COVER_DIMENSIONS_URL, body, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return resp.data;
};

module.exports = { getValidToken, createPrintJob, calculatePrintCost, validateInterior, getInteriorValidationStatus, validateCover, getCoverValidationStatus, getCoverDimensions };

