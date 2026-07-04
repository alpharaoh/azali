/**
 * Seed fake clients for an organization.
 *
 * Usage (from services/api):
 *   bun src/db/seed/seedClients.ts <organizationId> <userId>
 */
import { insertClient } from "@/db/queries/insert/insertClient";
import { ClientAutonomy, ClientStatus } from "@/db/schemas/clients";

const [organizationId, userId] = process.argv.slice(2);

if (!organizationId || !userId) {
  console.error("Usage: bun src/db/seed/seedClients.ts <organizationId> <userId>");
  process.exit(1);
}

const logo = (domain: string) => `https://icon.horse/icon/${domain}`;

const companies: Array<{ name: string; logo?: string }> = [
  { name: "Pacific Rim Imports", logo: logo("worldmarket.com") },
  { name: "Bluewave Electronics", logo: logo("sony.com") },
  { name: "Cascade Apparel Group", logo: logo("gap.com") },
  { name: "Harbor Foods Co.", logo: logo("sysco.com") },
  { name: "Meridian Auto Parts", logo: logo("autozone.com") },
  { name: "Sunbelt Furnishings", logo: logo("ashleyfurniture.com") },
  { name: "Northstar Medical Supply", logo: logo("mckesson.com") },
  { name: "Coastal Toys & Games", logo: logo("hasbro.com") },
  { name: "Ironclad Industrial", logo: logo("grainger.com") },
  { name: "Vela Cosmetics", logo: logo("coty.com") },
  { name: "Summit Footwear", logo: logo("skechers.com") },
  { name: "Redwood Home Goods", logo: logo("williams-sonoma.com") },
  { name: "Atlas Machinery Corp.", logo: logo("caterpillar.com") },
  { name: "Lotus Textiles", logo: logo("hanesbrands.com") },
  { name: "Golden Gate Trading", logo: logo("maersk.com") },
  { name: "Evergreen Produce Partners", logo: logo("dole.com") },
  { name: "Titan Tools USA", logo: logo("stanleyblackanddecker.com") },
  { name: "Aurora Lighting Co.", logo: logo("signify.com") },
  { name: "Crestline Sporting Goods", logo: logo("dickssportinggoods.com") },
  { name: "Marina Seafood Imports", logo: logo("delmonte.com") },
  { name: "Pinnacle Components", logo: logo("arrow.com") },
  { name: "Silverline Packaging", logo: logo("sealedair.com") },
  { name: "Oakmont Furniture Works", logo: logo("ethanallen.com") },
  { name: "Zenith Bike Supply", logo: logo("trekbikes.com") },
  { name: "Solstice Apparel", logo: logo("lululemon.com") },
  { name: "Ridgeline Outdoor Gear", logo: logo("rei.com") },
  { name: "Bayview Kitchenware", logo: logo("allclad.com") },
  { name: "Falcon Aerospace Parts", logo: logo("boeing.com") },
  { name: "Juniper Beauty Labs", logo: logo("esteelauder.com") },
  { name: "Stonebridge Hardware", logo: logo("homedepot.com") },
  { name: "Vermilion Ceramics", logo: logo("lenox.com") },
  { name: "Halcyon Pet Supply", logo: logo("petsmart.com") },
  { name: "Copperfield Instruments", logo: logo("fender.com") },
  { name: "Windward Marine Group", logo: logo("brunswickcorp.com") },
  { name: "Larkspur Stationery", logo: logo("hallmark.com") },
  { name: "Granite Peak Fitness", logo: logo("peloton.com") },
  { name: "Amber Valley Foods", logo: logo("campbells.com") },
  { name: "Cobalt Optics", logo: logo("oakley.com") },
  { name: "Fernwood Garden Supply", logo: logo("scotts.com") },
  { name: "Trailhead Luggage Co.", logo: logo("samsonite.com") },
  { name: "Beacon Electrical Imports", logo: logo("eaton.com") },
  { name: "Saffron Spice Traders", logo: logo("mccormick.com") },
];

const industries = [
  "Apparel & Textiles",
  "Consumer Electronics",
  "Automotive Parts",
  "Food & Beverage",
  "Furniture & Home",
  "Toys & Games",
  "Industrial Equipment",
  "Cosmetics & Beauty",
  "Footwear",
  "Medical Devices",
  "Sporting Goods",
  "Hardware & Tools",
];

const origins = [
  "China",
  "Vietnam",
  "Mexico",
  "India",
  "Germany",
  "Japan",
  "South Korea",
  "Taiwan",
  "Italy",
  "Thailand",
  "Canada",
  "Brazil",
];

const allPorts = [
  "LA/Long Beach",
  "NY/NJ",
  "Laredo",
  "Chicago",
  "Savannah",
  "Houston",
  "Miami",
  "Seattle",
];

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function pickSeeded<T>(items: readonly T[], random: number): T {
  return items[Math.floor(random * items.length)] as T;
}

function randomDate(seed: number): Date {
  const base = new Date(2023, 0, 1).getTime();
  const range = 900 * 24 * 60 * 60 * 1000;
  return new Date(base + seededRandom(seed) * range);
}

function randomPorts(seed: number): string[] {
  const count = Math.floor(seededRandom(seed) * 4) + 1;
  const shuffled = [...allPorts].sort(() => seededRandom(seed + 99) - 0.5);
  return shuffled.slice(0, count);
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
  const r = (offset: number) => seededRandom(i * 7 + offset);

  const created = await insertClient({
    organizationId,
    userId,
    name: company.name,
    image: company.logo ?? null,
    iorNumber: randomIorNumber(i * 13 + 1),
    bondNumber: randomBondNumber(i * 17 + 5),
    primaryOrigin: pickSeeded(origins, r(3)),
    industry: pickSeeded(industries, r(2)),
    autonomy: r(4) < 0.5 ? ClientAutonomy.Autopilot : ClientAutonomy.Supervised,
    status: r(5) < 0.1 ? ClientStatus.Paused : ClientStatus.Active,
    portsOfEntry: randomPorts(i * 11 + 3),
    createdAt: randomDate(i * 13 + 7),
  });

  console.log(`seeded: ${created?.name} (${created?.id})`);
}

console.log(`\nDone — ${companies.length} clients seeded for org ${organizationId}`);
process.exit(0);
