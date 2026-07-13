import { Injectable, NotFoundException } from "@nestjs/common";
import { listProducts } from "@/db/queries/select/many/listProducts";
import { selectProduct } from "@/db/queries/select/one/selectProduct";
import type { SelectProduct } from "@/db/schema";

function toProduct(product: SelectProduct) {
  return {
    id: product.id,
    clientId: product.clientId,
    name: product.name,
    sku: product.sku,
    description: product.description,
    htsCode: product.htsCode,
    htsDescription: product.htsDescription,
    confidence: product.confidence,
    source: product.source,
    classifiedAt: product.classifiedAt?.toISOString() ?? null,
    classificationRunId: product.classificationRunId,
    createdAt: product.createdAt.toISOString(),
  };
}

@Injectable()
export class ProductsService {
  async findAll(organizationId: string, clientId?: string) {
    const { data } = await listProducts({
      organizationId,
      ...(clientId ? { clientId } : {}),
    });
    return { products: data.map(toProduct) };
  }

  async findOne(organizationId: string, id: string) {
    const product = await selectProduct(id, organizationId);
    if (!product) {
      throw new NotFoundException(`Product "${id}" not found`);
    }
    return toProduct(product);
  }
}
