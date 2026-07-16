import { countryName } from "#/lib/countries";

export interface PortGroup {
  /** ISO 3166-1 alpha-2 country code (drives the flag + header label). */
  code: string;
  ports: string[];
}

/**
 * Major ports of entry worldwide — the top container seaports, air cargo
 * hubs, and land border crossings, grouped by country.
 */
const GROUPS: PortGroup[] = [
  {
    code: "US",
    ports: [
      "LA/Long Beach",
      "NY/NJ",
      "Savannah",
      "Houston",
      "Seattle",
      "Tacoma",
      "Oakland",
      "Norfolk",
      "Charleston",
      "Baltimore",
      "Miami",
      "Port Everglades",
      "Jacksonville",
      "New Orleans",
      "Mobile",
      "Boston",
      "Philadelphia",
      "Chicago",
      "Laredo",
      "El Paso",
      "Otay Mesa",
      "Nogales",
      "Detroit",
      "Buffalo",
      "JFK Airport",
      "LAX Airport",
      "O'Hare Airport",
      "Atlanta Airport",
      "DFW Airport",
      "Memphis Airport",
      "Louisville Airport",
      "Anchorage Airport",
    ],
  },
  { code: "AR", ports: ["Buenos Aires"] },
  {
    code: "AU",
    ports: [
      "Sydney (Botany)",
      "Melbourne",
      "Brisbane",
      "Fremantle",
      "Adelaide",
    ],
  },
  { code: "AO", ports: ["Luanda"] },
  { code: "BD", ports: ["Chittagong"] },
  { code: "BE", ports: ["Antwerp", "Zeebrugge", "Liège Airport"] },
  {
    code: "BR",
    ports: ["Santos", "Paranaguá", "Rio Grande", "Itajaí", "Rio de Janeiro"],
  },
  {
    code: "CA",
    ports: [
      "Vancouver",
      "Prince Rupert",
      "Montreal",
      "Halifax",
      "Toronto",
      "Saint John",
    ],
  },
  { code: "CL", ports: ["Valparaíso", "San Antonio"] },
  {
    code: "CN",
    ports: [
      "Shanghai",
      "Ningbo-Zhoushan",
      "Shenzhen (Yantian)",
      "Guangzhou",
      "Qingdao",
      "Tianjin",
      "Xiamen",
      "Dalian",
    ],
  },
  { code: "CO", ports: ["Cartagena", "Buenaventura"] },
  { code: "CI", ports: ["Abidjan"] },
  { code: "DK", ports: ["Aarhus", "Copenhagen"] },
  { code: "DJ", ports: ["Djibouti"] },
  { code: "EC", ports: ["Guayaquil"] },
  {
    code: "EG",
    ports: ["Port Said", "Alexandria", "Damietta", "Ain Sokhna"],
  },
  { code: "FI", ports: ["Helsinki"] },
  {
    code: "FR",
    ports: ["Le Havre", "Marseille-Fos", "Dunkirk", "CDG Airport"],
  },
  {
    code: "DE",
    ports: [
      "Hamburg",
      "Bremerhaven",
      "Wilhelmshaven",
      "Frankfurt Airport",
      "Leipzig Airport",
    ],
  },
  { code: "GH", ports: ["Tema"] },
  { code: "GR", ports: ["Piraeus", "Thessaloniki"] },
  { code: "HK", ports: ["Hong Kong"] },
  {
    code: "IN",
    ports: [
      "Mundra",
      "Nhava Sheva (JNPT)",
      "Chennai",
      "Kolkata",
      "Cochin",
      "Visakhapatnam",
    ],
  },
  {
    code: "ID",
    ports: ["Tanjung Priok (Jakarta)", "Surabaya", "Belawan"],
  },
  { code: "IE", ports: ["Dublin", "Cork"] },
  { code: "IL", ports: ["Haifa", "Ashdod"] },
  {
    code: "IT",
    ports: ["Genoa", "Gioia Tauro", "La Spezia", "Trieste", "Naples"],
  },
  {
    code: "JP",
    ports: [
      "Tokyo",
      "Yokohama",
      "Nagoya",
      "Kobe",
      "Osaka",
      "Narita Airport",
      "Kansai Airport",
    ],
  },
  { code: "JO", ports: ["Aqaba"] },
  { code: "KE", ports: ["Mombasa"] },
  { code: "KW", ports: ["Shuwaikh"] },
  { code: "KH", ports: ["Sihanoukville"] },
  {
    code: "MY",
    ports: ["Port Klang", "Tanjung Pelepas", "Penang"],
  },
  { code: "MT", ports: ["Marsaxlokk"] },
  {
    code: "MX",
    ports: [
      "Manzanillo",
      "Lázaro Cárdenas",
      "Veracruz",
      "Altamira",
      "Ensenada",
      "Mexico City Airport",
    ],
  },
  { code: "MA", ports: ["Tanger Med", "Casablanca"] },
  {
    code: "NL",
    ports: ["Rotterdam", "Amsterdam", "Schiphol Airport"],
  },
  { code: "NZ", ports: ["Auckland", "Tauranga", "Lyttelton"] },
  { code: "NG", ports: ["Lagos (Apapa)", "Lekki", "Onne"] },
  { code: "NO", ports: ["Oslo"] },
  { code: "OM", ports: ["Salalah", "Sohar"] },
  { code: "PK", ports: ["Karachi", "Port Qasim"] },
  { code: "PA", ports: ["Colón", "Balboa"] },
  { code: "PE", ports: ["Callao"] },
  { code: "PH", ports: ["Manila", "Cebu"] },
  { code: "PL", ports: ["Gdańsk", "Gdynia"] },
  { code: "PT", ports: ["Sines", "Leixões", "Lisbon"] },
  { code: "QA", ports: ["Hamad"] },
  {
    code: "RU",
    ports: ["St. Petersburg", "Novorossiysk", "Vladivostok"],
  },
  {
    code: "SA",
    ports: ["Jeddah", "King Abdullah Port", "Dammam"],
  },
  { code: "SN", ports: ["Dakar"] },
  { code: "SG", ports: ["Singapore", "Changi Airport"] },
  {
    code: "ZA",
    ports: ["Durban", "Cape Town", "Gqeberha (Port Elizabeth)", "Ngqura"],
  },
  { code: "KR", ports: ["Busan", "Incheon", "Gwangyang"] },
  { code: "ES", ports: ["Valencia", "Algeciras", "Barcelona", "Bilbao"] },
  { code: "LK", ports: ["Colombo"] },
  { code: "SE", ports: ["Gothenburg"] },
  { code: "TW", ports: ["Kaohsiung", "Keelung", "Taichung"] },
  { code: "TZ", ports: ["Dar es Salaam"] },
  { code: "TH", ports: ["Laem Chabang", "Bangkok"] },
  { code: "TG", ports: ["Lomé"] },
  { code: "TR", ports: ["Ambarlı", "Mersin", "Izmir"] },
  {
    code: "AE",
    ports: ["Jebel Ali", "Khalifa Port", "Sharjah", "Dubai Airport"],
  },
  {
    code: "GB",
    ports: [
      "Felixstowe",
      "Southampton",
      "London Gateway",
      "Liverpool",
      "Heathrow Airport",
    ],
  },
  {
    code: "VN",
    ports: ["Ho Chi Minh City (Cat Lai)", "Hai Phong", "Cai Mep", "Da Nang"],
  },
];

// United States first (primary market), then countries A→Z by display name.
export const PORT_GROUPS: PortGroup[] = [
  ...GROUPS.filter((group) => group.code === "US"),
  ...GROUPS.filter((group) => group.code !== "US").sort((a, b) =>
    countryName(a.code).localeCompare(countryName(b.code)),
  ),
];
