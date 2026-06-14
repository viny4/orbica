// ISO 3166-1 alpha-3 → alpha-2 + display name, for the country codes in our data.
// Flags are served as SVG from flagcdn.com using the alpha-2 code.

interface Country {
  a2: string;
  name: string;
}

export const COUNTRIES: Record<string, Country> = {
  USA: { a2: "us", name: "United States" },
  RUS: { a2: "ru", name: "Russia" },
  CHN: { a2: "cn", name: "China" },
  FRA: { a2: "fr", name: "France" },
  JPN: { a2: "jp", name: "Japan" },
  GBR: { a2: "gb", name: "United Kingdom" },
  DEU: { a2: "de", name: "Germany" },
  IND: { a2: "in", name: "India" },
  ITA: { a2: "it", name: "Italy" },
  CAN: { a2: "ca", name: "Canada" },
  AUS: { a2: "au", name: "Australia" },
  KOR: { a2: "kr", name: "South Korea" },
  PRK: { a2: "kp", name: "North Korea" },
  ESP: { a2: "es", name: "Spain" },
  NLD: { a2: "nl", name: "Netherlands" },
  CHE: { a2: "ch", name: "Switzerland" },
  SWE: { a2: "se", name: "Sweden" },
  NOR: { a2: "no", name: "Norway" },
  DNK: { a2: "dk", name: "Denmark" },
  BEL: { a2: "be", name: "Belgium" },
  AUT: { a2: "at", name: "Austria" },
  POL: { a2: "pl", name: "Poland" },
  CZE: { a2: "cz", name: "Czechia" },
  HUN: { a2: "hu", name: "Hungary" },
  GRC: { a2: "gr", name: "Greece" },
  PRT: { a2: "pt", name: "Portugal" },
  ROU: { a2: "ro", name: "Romania" },
  HRV: { a2: "hr", name: "Croatia" },
  BGR: { a2: "bg", name: "Bulgaria" },
  LTU: { a2: "lt", name: "Lithuania" },
  LUX: { a2: "lu", name: "Luxembourg" },
  UKR: { a2: "ua", name: "Ukraine" },
  BLR: { a2: "by", name: "Belarus" },
  KAZ: { a2: "kz", name: "Kazakhstan" },
  UZB: { a2: "uz", name: "Uzbekistan" },
  TKM: { a2: "tm", name: "Turkmenistan" },
  AZE: { a2: "az", name: "Azerbaijan" },
  TUR: { a2: "tr", name: "Türkiye" },
  IRN: { a2: "ir", name: "Iran" },
  ISR: { a2: "il", name: "Israel" },
  SAU: { a2: "sa", name: "Saudi Arabia" },
  ARE: { a2: "ae", name: "United Arab Emirates" },
  EGY: { a2: "eg", name: "Egypt" },
  DZA: { a2: "dz", name: "Algeria" },
  MAR: { a2: "ma", name: "Morocco" },
  TUN: { a2: "tn", name: "Tunisia" },
  NGA: { a2: "ng", name: "Nigeria" },
  ZAF: { a2: "za", name: "South Africa" },
  MUS: { a2: "mu", name: "Mauritius" },
  PAK: { a2: "pk", name: "Pakistan" },
  BGD: { a2: "bd", name: "Bangladesh" },
  LKA: { a2: "lk", name: "Sri Lanka" },
  MNG: { a2: "mn", name: "Mongolia" },
  THA: { a2: "th", name: "Thailand" },
  VNM: { a2: "vn", name: "Vietnam" },
  MYS: { a2: "my", name: "Malaysia" },
  SGP: { a2: "sg", name: "Singapore" },
  IDN: { a2: "id", name: "Indonesia" },
  TWN: { a2: "tw", name: "Taiwan" },
  BRA: { a2: "br", name: "Brazil" },
  ARG: { a2: "ar", name: "Argentina" },
  COL: { a2: "co", name: "Colombia" },
  PER: { a2: "pe", name: "Peru" },
  BOL: { a2: "bo", name: "Bolivia" },
  VEN: { a2: "ve", name: "Venezuela" },
  URY: { a2: "uy", name: "Uruguay" },
  MEX: { a2: "mx", name: "Mexico" },
  BMU: { a2: "bm", name: "Bermuda" },
};

export function country(code?: string | null): Country | null {
  if (!code) return null;
  return COUNTRIES[code.toUpperCase()] ?? null;
}

export function flagUrl(code?: string | null): string | null {
  const c = country(code);
  return c ? `https://flagcdn.com/${c.a2}.svg` : null;
}
