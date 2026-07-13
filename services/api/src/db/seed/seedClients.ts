/**
 * Seed realistic clients for an organization.
 *
 * Usage (from services/api):
 *   bun src/db/seed/seedClients.ts <organizationId> <userId>
 */
import { insertClient } from "@/db/queries/insert/insertClient";
import { ClientAutonomy, ClientStatus } from "@/db/schemas/clients";

const [organizationId, userId] = process.argv.slice(2);

if (!organizationId || !userId) {
  console.error(
    "Usage: bun src/db/seed/seedClients.ts <organizationId> <userId>",
  );
  process.exit(1);
}

const logo = (domain: string) => `https://icon.horse/icon/${domain}`;

interface SeedClient {
  name: string;
  domain: string;
  industry: string;
  origin: string;
  ports: string[];
  paused?: boolean;
}

// Real importers with coherent industry, sourcing origin (ISO 3166-1 alpha-2), and ports of entry
// (Asia -> West Coast, Europe -> East Coast, Mexico -> Laredo/Houston).
const companies: SeedClient[] = [
  {
    name: "Sony Electronics",
    domain: "sony.com",
    industry: "Consumer Electronics",
    origin: "JP",
    ports: ["LA/Long Beach", "Seattle"],
  },
  {
    name: "Samsung Electronics America",
    domain: "samsung.com",
    industry: "Consumer Electronics",
    origin: "KR",
    ports: ["LA/Long Beach", "Savannah"],
  },
  {
    name: "LG Electronics USA",
    domain: "lg.com",
    industry: "Consumer Electronics",
    origin: "KR",
    ports: ["LA/Long Beach", "Houston"],
  },
  {
    name: "Panasonic North America",
    domain: "panasonic.com",
    industry: "Consumer Electronics",
    origin: "JP",
    ports: ["LA/Long Beach", "Chicago"],
  },
  {
    name: "TCL North America",
    domain: "tcl.com",
    industry: "Consumer Electronics",
    origin: "CN",
    ports: ["LA/Long Beach"],
  },
  {
    name: "Nintendo of America",
    domain: "nintendo.com",
    industry: "Toys & Games",
    origin: "JP",
    ports: ["Seattle", "LA/Long Beach"],
  },
  {
    name: "Hasbro",
    domain: "hasbro.com",
    industry: "Toys & Games",
    origin: "CN",
    ports: ["LA/Long Beach", "NY/NJ"],
  },
  {
    name: "Mattel",
    domain: "mattel.com",
    industry: "Toys & Games",
    origin: "CN",
    ports: ["LA/Long Beach"],
  },
  {
    name: "LEGO Systems",
    domain: "lego.com",
    industry: "Toys & Games",
    origin: "MX",
    ports: ["Laredo", "Houston"],
  },
  {
    name: "Nike USA",
    domain: "nike.com",
    industry: "Footwear",
    origin: "VN",
    ports: ["LA/Long Beach", "Savannah"],
    paused: false,
  },
  {
    name: "Adidas America",
    domain: "adidas.com",
    industry: "Footwear",
    origin: "VN",
    ports: ["Savannah", "LA/Long Beach"],
  },
  {
    name: "Skechers USA",
    domain: "skechers.com",
    industry: "Footwear",
    origin: "CN",
    ports: ["LA/Long Beach"],
  },
  {
    name: "New Balance Athletics",
    domain: "newbalance.com",
    industry: "Footwear",
    origin: "VN",
    ports: ["NY/NJ", "Savannah"],
  },
  {
    name: "Crocs",
    domain: "crocs.com",
    industry: "Footwear",
    origin: "VN",
    ports: ["Savannah", "Houston"],
    paused: true,
  },
  {
    name: "Gap Inc.",
    domain: "gap.com",
    industry: "Apparel & Textiles",
    origin: "VN",
    ports: ["LA/Long Beach", "Savannah"],
  },
  {
    name: "Levi Strauss & Co.",
    domain: "levi.com",
    industry: "Apparel & Textiles",
    origin: "MX",
    ports: ["Laredo", "LA/Long Beach"],
  },
  {
    name: "Lululemon USA",
    domain: "lululemon.com",
    industry: "Apparel & Textiles",
    origin: "VN",
    ports: ["Seattle", "LA/Long Beach"],
  },
  {
    name: "H&M Hennes & Mauritz",
    domain: "hm.com",
    industry: "Apparel & Textiles",
    origin: "IN",
    ports: ["NY/NJ", "Savannah"],
  },
  {
    name: "Uniqlo USA",
    domain: "uniqlo.com",
    industry: "Apparel & Textiles",
    origin: "CN",
    ports: ["LA/Long Beach", "NY/NJ"],
  },
  {
    name: "IKEA Supply",
    domain: "ikea.com",
    industry: "Furniture & Home",
    origin: "SE",
    ports: ["NY/NJ", "Savannah"],
  },
  {
    name: "Ashley Furniture Industries",
    domain: "ashleyfurniture.com",
    industry: "Furniture & Home",
    origin: "VN",
    ports: ["Savannah", "Houston"],
  },
  {
    name: "Williams-Sonoma",
    domain: "williams-sonoma.com",
    industry: "Furniture & Home",
    origin: "CN",
    ports: ["LA/Long Beach"],
  },
  {
    name: "MillerKnoll",
    domain: "hermanmiller.com",
    industry: "Furniture & Home",
    origin: "CN",
    ports: ["Chicago", "NY/NJ"],
    paused: true,
  },
  {
    name: "Robert Bosch",
    domain: "bosch.com",
    industry: "Automotive Parts",
    origin: "DE",
    ports: ["NY/NJ", "Savannah", "Chicago"],
  },
  {
    name: "DENSO International America",
    domain: "denso.com",
    industry: "Automotive Parts",
    origin: "JP",
    ports: ["LA/Long Beach", "Chicago"],
  },
  {
    name: "Continental Automotive",
    domain: "continental.com",
    industry: "Automotive Parts",
    origin: "DE",
    ports: ["Savannah", "Houston"],
  },
  {
    name: "Magna International",
    domain: "magna.com",
    industry: "Automotive Parts",
    origin: "CA",
    ports: ["Chicago"],
  },
  {
    name: "AutoZone",
    domain: "autozone.com",
    industry: "Automotive Parts",
    origin: "MX",
    ports: ["Laredo", "Houston"],
  },
  {
    name: "Caterpillar",
    domain: "caterpillar.com",
    industry: "Industrial Equipment",
    origin: "JP",
    ports: ["Chicago", "Houston"],
  },
  {
    name: "Siemens Industry",
    domain: "siemens.com",
    industry: "Industrial Equipment",
    origin: "DE",
    ports: ["NY/NJ", "Houston"],
  },
  {
    name: "ABB Inc.",
    domain: "abb.com",
    industry: "Industrial Equipment",
    origin: "CH",
    ports: ["NY/NJ"],
  },
  {
    name: "Makita USA",
    domain: "makita.com",
    industry: "Hardware & Tools",
    origin: "JP",
    ports: ["LA/Long Beach"],
  },
  {
    name: "Stanley Black & Decker",
    domain: "stanleyblackanddecker.com",
    industry: "Hardware & Tools",
    origin: "CN",
    ports: ["NY/NJ", "Savannah"],
  },
  {
    name: "Milwaukee Tool",
    domain: "milwaukeetool.com",
    industry: "Hardware & Tools",
    origin: "CN",
    ports: ["LA/Long Beach", "Chicago"],
  },
  {
    name: "L'Oréal USA",
    domain: "loreal.com",
    industry: "Cosmetics & Beauty",
    origin: "FR",
    ports: ["NY/NJ", "Miami"],
  },
  {
    name: "Shiseido Americas",
    domain: "shiseido.com",
    industry: "Cosmetics & Beauty",
    origin: "JP",
    ports: ["LA/Long Beach", "NY/NJ"],
  },
  {
    name: "Beiersdorf",
    domain: "beiersdorf.com",
    industry: "Cosmetics & Beauty",
    origin: "DE",
    ports: ["NY/NJ"],
    paused: true,
  },
  {
    name: "Nestlé USA",
    domain: "nestle.com",
    industry: "Food & Beverage",
    origin: "CH",
    ports: ["NY/NJ", "Miami"],
  },
  {
    name: "Ferrero USA",
    domain: "ferrero.com",
    industry: "Food & Beverage",
    origin: "IT",
    ports: ["NY/NJ", "Miami"],
  },
  {
    name: "Barilla America",
    domain: "barilla.com",
    industry: "Food & Beverage",
    origin: "IT",
    ports: ["NY/NJ", "Houston"],
  },
  {
    name: "Dole Food Company",
    domain: "dole.com",
    industry: "Food & Beverage",
    origin: "CR",
    ports: ["Miami", "Houston"],
  },
  {
    name: "Red Bull North America",
    domain: "redbull.com",
    industry: "Food & Beverage",
    origin: "AT",
    ports: ["NY/NJ", "Miami"],
  },
  {
    name: "Medtronic",
    domain: "medtronic.com",
    industry: "Medical Devices",
    origin: "IE",
    ports: ["NY/NJ", "Chicago"],
  },
  {
    name: "Philips North America",
    domain: "philips.com",
    industry: "Medical Devices",
    origin: "NL",
    ports: ["NY/NJ"],
  },
  {
    name: "Siemens Healthineers",
    domain: "siemens-healthineers.com",
    industry: "Medical Devices",
    origin: "DE",
    ports: ["NY/NJ", "Chicago"],
  },
  {
    name: "Trek Bicycle",
    domain: "trekbikes.com",
    industry: "Sporting Goods",
    origin: "TW",
    ports: ["LA/Long Beach", "Chicago"],
  },
  {
    name: "Specialized Bicycle Components",
    domain: "specialized.com",
    industry: "Sporting Goods",
    origin: "TW",
    ports: ["LA/Long Beach"],
  },
  {
    name: "YETI",
    domain: "yeti.com",
    industry: "Sporting Goods",
    origin: "CN",
    ports: ["Houston", "LA/Long Beach"],
  },
];

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function randomDate(seed: number): Date {
  const base = new Date(2023, 0, 1).getTime();
  const range = 900 * 24 * 60 * 60 * 1000;
  return new Date(base + seededRandom(seed) * range);
}

function randomIorNumber(seed: number): string {
  const prefix = Math.floor(seededRandom(seed) * 90) + 10;
  const suffix = Math.floor(seededRandom(seed + 1) * 9000000) + 1000000;
  return `${prefix}-${suffix}`;
}

function randomBondNumber(seed: number): string {
  const num = Math.floor(seededRandom(seed) * 900000000) + 100000000;
  return `99${num}`.slice(0, 9);
}

for (const [i, company] of companies.entries()) {
  const created = await insertClient({
    organizationId,
    userId,
    name: company.name,
    image: logo(company.domain),
    iorNumber: randomIorNumber(i * 13 + 1),
    bondNumber: randomBondNumber(i * 17 + 5),
    primaryOrigin: company.origin,
    industry: company.industry,
    autonomy:
      seededRandom(i * 7 + 4) < 0.45
        ? ClientAutonomy.Autopilot
        : ClientAutonomy.Supervised,
    status: company.paused ? ClientStatus.Paused : ClientStatus.Active,
    portsOfEntry: company.ports,
    createdAt: randomDate(i * 13 + 7),
  });

  console.log(`seeded: ${created?.name} (${created?.id})`);
}

console.log(
  `\nDone — ${companies.length} clients seeded for org ${organizationId}`,
);
process.exit(0);
