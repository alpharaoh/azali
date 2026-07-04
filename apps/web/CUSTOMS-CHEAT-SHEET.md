# Customs Cheat Sheet

Every term from the broker world, in plain English. Organized by theme so it doubles as a mental model of how importing actually works.

---

## The players

**Importer (Importer of Record)** — The company bringing goods into the US. Legally on the hook for everything: correct paperwork, correct taxes, correct declarations. Even when they hire a broker, *they* carry the liability.

**Customs broker** — A person licensed by the US government to file import paperwork on behalf of importers. Think of them like a tax accountant, but for imports. The license requires passing a famously brutal federal exam.

**CBP (Customs and Border Protection)** — The government agency that controls what enters the US. They collect the import taxes, inspect containers, and punish mistakes.

**CCS (Certified Customs Specialist)** — An extra industry certification brokers can earn. Like a CPA badge on top of the license.

**Surety** — An insurance-like company that promises CBP: "if this importer doesn't pay their taxes, we will." Every importer needs one (see *Bond* below).

**PGA (Partner Government Agency)** — Any *other* government agency that cares about a product beyond customs. FDA for food, cosmetics, and medical devices; USDA for agriculture; EPA for chemicals. Certain products can't clear customs until these agencies are satisfied too.

---

## Classifying products (the core skill)

**HTS / HTSUS (Harmonized Tariff Schedule)** — A giant catalog of every product imaginable, each with a 10-digit code. Every import must be assigned one. The code determines the tax rate. Getting it wrong = wrong tax = trouble.

**Chapter** — The HTS is organized into ~99 chapters by product family. Chapter 61 = knitted clothes, Chapter 85 = electronics, Chapter 64 = shoes.

**Chapter notes** — Legally binding fine print at the start of each chapter saying what belongs in it and what doesn't. Example: "a jacket is classified by the fabric of its outer shell, whichever fiber weighs the most." These notes decide the hard cases.

**GRI (General Rules of Interpretation)** — Six tie-breaker rules for when a product could fit multiple codes. The famous one, GRI 3(b): a boxed *set* of items is classified by whichever component gives it its "essential character."

**CROSS** — CBP's public database of past official rulings. If someone once formally asked "how do I classify a mesh Wi-Fi router?" and CBP answered in writing, that answer is precedent anyone can rely on. Brokers search it constantly.

**Ruling (e.g., "NY N324089", "HQ 960950")** — One official CBP answer in the CROSS database. "NY" and "HQ" just indicate which CBP office wrote it.

**Country of origin** — Where the product was *made* (not shipped from). Required on every entry, and it changes which tariffs apply. China origin vs. Taiwan origin can be a 25% price difference.

---

## The tariff stack (why it got complicated)

**Duty** — The import tax. Usually a percentage of the goods' value ("ad valorem"), e.g. 6404.11.90 shoes = 20%.

**Column 1 rate** — The normal, base tax rate in the HTS for countries the US trades normally with. This is the *starting point* — surcharges stack on top.

**Section 301** — Extra punitive tariffs on Chinese-made goods (the "trade war" tariffs), added *on top of* the normal duty. Organized in "Lists" (List 1, 2, 3, 4A…) covering different products at different rates (7.5%–25%).

**Section 232** — Extra tariffs justified by national security, originally on steel and aluminum. Also stacks on top of normal duty.

**Chapter 99** — The special chapter of the HTS where all these temporary/political tariffs live. Your product gets its real code *plus* one or more 9903.xx.xx codes bolted on. Figuring out which apply — and which exclusions apply — is the tedious part brokers complain about.

**Exclusion** — A carve-out. "This tariff applies to all products on List 3… *except* these specific ones." Exclusions expire and change constantly, so they must be re-checked on every entry.

**AD/CVD (Anti-Dumping / Countervailing Duties)** — Yet another layer: extra duties on specific products from specific countries that are being sold unfairly cheap (dumping) or are subsidized by a foreign government. These can exceed 100%.

**MPF / HMF** — Two small standard fees on top of duty: Merchandise Processing Fee (paperwork fee) and Harbor Maintenance Fee (ports upkeep, ocean freight only).

---

## The paperwork

**Entry** — The official act of declaring goods to CBP: "here's what it is, where it's from, what it's worth, and what tax I owe." One shipment = one entry.

**Entry Summary / Form 7501** — The master document of an entry. Lists every product line, its HTS code, value, and duty. This is what "filing an entry" means filing.

**Entry Type 01 — Consumption** — The most common entry type: goods entering the US to be sold/used (as opposed to passing through in transit or going into a bonded warehouse).

**ACE** — CBP's online portal where all filings happen. "Filed to ACE" = submitted electronically to CBP.

**Commercial invoice** — The seller's bill for the goods. The starting document for everything: what it is, quantity, price.

**Packing list** — The document that says what's physically in each carton (counts and weights). Used to cross-check the invoice.

**Bill of lading (B/L)** — The transport document from the shipping line: who shipped what, from which port, to whom. The third leg of the cross-check.

**ISF ("10+2")** — Importer Security Filing. A data filing due to CBP **before the ship even leaves the foreign port** (72 hours before departure). Miss it or get it wrong: **$5,000 penalty per filing**, no lawsuit needed.

**Liquidation** — CBP's final sign-off on an entry, usually ~10 months later. "Liquidated as entered" = CBP accepted everything as filed, case closed. Until liquidation, CBP can still come back with questions.

---

## Money & valuation

**Declared value** — What you tell CBP the goods are worth. Duty is a percentage of this, so undervaluing = underpaying tax = penalty territory.

**Transaction value** — The default method for valuing goods: simply the price actually paid. Works fine unless the buyer and seller are related…

**Related-party transaction** — When importer and seller are the same corporate family (e.g., buying from your own parent company). CBP is suspicious: are you charging yourself an artificially low price to shrink the tax? Allowed only if you can show the relationship didn't influence the price.

**Circumstances of sale test** — The proof that a related-party price is legit — e.g., it's consistent with prices charged to unrelated buyers.

**Transfer-pricing study** — A formal accounting document proving intra-company prices are arm's-length. The gold-standard evidence for the test above.

**Incoterms (FOB, CIF, DAP…)** — Three-letter shipping codes defining who pays for what leg of the journey. Matters for valuation: **FOB** ("Free On Board") = price covers goods to the foreign port; **CIF** = price also includes freight + insurance; **DAP** = seller delivers to the door.

---

## Enforcement (when CBP pushes back)

**Form 28 (Request for Information)** — CBP's formal "prove it" letter: justify this classification / value / origin, typically within 30 days. Not an accusation yet — but the start of one if answered badly.

**Form 29 (Notice of Action)** — The escalation. CBP saying "we're changing your entry" — usually to a higher duty rate ("rate advance"), with a bill attached.

**19 USC §1509** — The law letting CBP demand your records to check any entry. Why importers must keep everything for 5 years.

**19 USC §1592** — The penalty statute: fraud, gross negligence, or plain negligence on entries. Crucially, exposure isn't just one entry — CBP can reach back through *years* of identical past entries.

**Reasonable care** — The legal standard importers are held to. Your defense file: documented reasoning, rulings relied on, consistent history. "We had a solid basis and here's the paper trail."

**Examination ("exam")** — CBP physically opening and inspecting your container. Costs time (days–weeks) and money (fees, storage).

**Liquidated damages** — Pre-agreed penalty amounts written into bonds (e.g., $5,000 per late ISF). CBP just sends the bill — no court needed.

---

## Bonds & security programs

**Customs bond** — Mandatory financial guarantee backing every importer. If the importer doesn't pay duties, the surety pays CBP, then chases the importer. No bond = no importing.

**Continuous bond** — The year-long version covering all of an importer's shipments (vs. buying a single-entry bond each time). Sized relative to expected annual duty.

**Bond utilization** — How much of the bond's capacity current duties are eating. New tariffs → duties balloon → bonds max out → sureties demand financials or bigger bonds. This is the "sureties got strict" complaint.

**C-TPAT** — A voluntary CBP supply-chain-security program. Members prove their supply chain is secure (vetted partners, sealed containers) and get fewer exams in return.

**ISO 17712 seals** — The high-security tamper-evident bolt seals C-TPAT requires on containers bound for the US.

---

## Quick reference: the documents trail

```
Seller's invoice ──┐
Packing list ──────┼── 3-way reconciliation ── HTS classification ── Ch. 99 / PGA / AD-CVD screens
Bill of lading ────┘                                                          │
                                                                              ▼
ISF (before vessel departs) ──► Entry / 7501 (filed to ACE) ──► CBP release ──► Liquidation (~10 months)
                                                                    │
                                            (if CBP has questions:) ▼
                                                    Form 28 ──► Form 29 ──► §1592 penalties
```

## Quick reference: what a duty bill is made of

```
  Declared value
× Column 1 rate (the product's normal HTS rate)
+ Section 301 surcharge (if China origin, via Chapter 99 code)
+ Section 232 surcharge (if steel/aluminum-adjacent)
+ AD/CVD (if a dumping order covers the product+country)
+ MPF + HMF (small standard fees)
= What the importer owes CBP
```
