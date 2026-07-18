import { Injectable, NotFoundException } from "@nestjs/common";
import type { EmbeddedClient } from "@/db/lib/embedClient";
import { embedClient } from "@/db/lib/embedClient";
import { aggregateProductStats } from "@/db/queries/aggregate/aggregateProductStats";
import { listProducts } from "@/db/queries/select/many/listProducts";
import { selectProduct } from "@/db/queries/select/one/selectProduct";
import type { SelectProduct } from "@/db/schema";
import { effectiveConfidence } from "@/services/external/pinecone/classificationRecord";
import type { ListProductsDto } from "./dto/list-products.dto";

function toProduct(
  product: SelectProduct & { client?: EmbeddedClient | null },
) {
  return {
    id: product.id,
    clientId: product.clientId,
    client: product.client ?? null,
    name: product.name,
    sku: product.sku,
    description: product.description,
    htsCode: product.htsCode,
    htsDescription: product.htsDescription,
    // Broker-verified reads as full confidence; `source` tells who verified.
    confidence: effectiveConfidence(product),
    dutyRate: product.dutyRate ?? null,
    source: product.source,
    reuseCount: product.reuseCount,
    lastReusedAt: product.lastReusedAt?.toISOString() ?? null,
    classifiedAt: product.classifiedAt?.toISOString() ?? null,
    classificationRunId: product.classificationRunId,
    createdAt: product.createdAt.toISOString(),
  };
}

@Injectable()
export class ProductsService {
  /**
   * The knowledge base — classified products only, paginated. Every code the
   * team has approved (or the agent set), with how often it's been reused.
   */
  async findAll(organizationId: string, query: ListProductsDto) {
    const { data, count } = await listProducts(
      {
        organizationId,
        classifiedOnly: true,
        clientIds: query.clientId,
        sources: query.source,
        search: query.search,
      },
      { [query.sortBy]: query.sortDir },
      query.limit,
      query.offset,
    );

    return { data: data.map(toProduct), count };
  }

  async stats(organizationId: string) {
    return aggregateProductStats(organizationId);
  }

  async findOne(organizationId: string, id: string) {
    const product = await embedClient(await selectProduct(id, organizationId));
    if (!product) {
      throw new NotFoundException(`Product "${id}" not found`);
    }
    return toProduct(product);
  }
}
