import { and, count, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";

const TOP_CHAPTERS = 6;

/** Aggregate picture of the classified-product knowledge base. */
export const productStats = async (organizationId: string) => {
  const where = and(
    eq(products.organizationId, organizationId),
    isNotNull(products.htsCode),
    isNull(products.deletedAt),
  );

  const chapterExpr = sql<string>`substring(${products.htsCode}, 1, 2)`;
  // A product joins the knowledge base when it's classified; fall back to
  // createdAt for any legacy rows missing the timestamp.
  const monthExpr = sql<string>`to_char(date_trunc('month', coalesce(${products.classifiedAt}, ${products.createdAt})), 'YYYY-MM')`;

  const [[totals], topChapters, growth] = await Promise.all([
    db
      .select({
        entries: count(),
        totalReuses: sql<number>`coalesce(sum(${products.reuseCount}), 0)::int`,
        brokerApproved: sql<number>`count(*) filter (where ${products.source} = 'broker')::int`,
        chaptersCovered: sql<number>`count(distinct substring(${products.htsCode}, 1, 2))::int`,
      })
      .from(products)
      .where(where),
    db
      .select({ chapter: chapterExpr, count: count() })
      .from(products)
      .where(where)
      .groupBy(chapterExpr)
      .orderBy(desc(count()), chapterExpr)
      .limit(TOP_CHAPTERS),
    db
      .select({ month: monthExpr, added: count() })
      .from(products)
      .where(where)
      .groupBy(monthExpr)
      .orderBy(monthExpr),
  ]);

  return {
    entries: totals?.entries ?? 0,
    totalReuses: totals?.totalReuses ?? 0,
    brokerApproved: totals?.brokerApproved ?? 0,
    chaptersCovered: totals?.chaptersCovered ?? 0,
    topChapters,
    growth,
  };
};
