/** Lulu expects ISO-3166-2 region codes (US: WI, CA: ON), not full names. */

const US_STATES = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  "district of columbia": "DC",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
};

const CA_PROVINCES = {
  alberta: "AB",
  "british columbia": "BC",
  manitoba: "MB",
  "new brunswick": "NB",
  "newfoundland and labrador": "NL",
  "northwest territories": "NT",
  "nova scotia": "NS",
  nunavut: "NU",
  ontario: "ON",
  "prince edward island": "PE",
  quebec: "QC",
  saskatchewan: "SK",
  yukon: "YT",
};

const normalizeRegionCode = (value, countryCode) => {
  if (value == null) return value;
  const raw = String(value).trim();
  if (!raw) return raw;

  const country = String(countryCode || "").trim().toUpperCase();
  const upper = raw.toUpperCase();
  if (/^[A-Z]{2}$/.test(upper)) return upper;

  const key = raw.toLowerCase().replace(/\./g, "").trim();
  if (country === "US" || country === "USA") return US_STATES[key] || upper;
  if (country === "CA") return CA_PROVINCES[key] || upper;
  return upper.length <= 3 ? upper : raw;
};

const formatLuluError = (err) => {
  const data = err?.response?.data;
  if (!data) return err?.message || "Lulu request failed";
  if (typeof data === "string") return data;
  if (data.detail) return typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
  if (data.message) return data.message;
  try {
    return JSON.stringify(data);
  } catch {
    return err.message || "Lulu request failed";
  }
};

const normalizeLuluShippingAddress = (address) => {
  if (!address || typeof address !== "object") return address;
  const country_code = String(address.country_code || "").trim().toUpperCase();
  return {
    ...address,
    country_code: country_code || address.country_code,
    state_code: normalizeRegionCode(address.state_code, country_code),
    postcode: address.postcode != null ? String(address.postcode).trim() : address.postcode,
    city: address.city != null ? String(address.city).trim() : address.city,
    street1: address.street1 != null ? String(address.street1).trim() : address.street1,
    phone_number:
      address.phone_number != null ? String(address.phone_number).trim() : address.phone_number,
  };
};

module.exports = {
  normalizeLuluShippingAddress,
  formatLuluError,
};
