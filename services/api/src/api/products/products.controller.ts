import { Controller, Get, Param, Query } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { getActiveOrganizationId } from "@/db/lib/getActiveOrganizationId";
import type { auth } from "@/lib/auth";
import { ListProductsDto } from "./dto/list-products.dto";
import {
  ListProductsResponseDto,
  ProductResponseDto,
  ProductStatsResponseDto,
} from "./dto/product.response.dto";
import { ProductsService } from "./products.service";

@ApiTags("Products")
@Controller("products")
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  /** The classified-product knowledge base. */
  @Get()
  @ApiOperation({
    summary: "List products",
    description:
      "Returns the knowledge base — every classified product, with its current HTS code, who set it (AI or broker), how many shipment lines reused it, and the owning client embedded. Supports filtering by client and source, free-text search, sorting, and offset pagination.",
  })
  @ApiOkResponse({
    type: ListProductsResponseDto,
    description: "A page of classified products plus the total count.",
  })
  list(
    @Session() session: UserSession<typeof auth>,
    @Query() query: ListProductsDto,
  ) {
    return this.productsService.findAll(
      getActiveOrganizationId(session),
      query,
    );
  }

  /** Aggregate stats over the knowledge base. */
  @Get("stats")
  @ApiOperation({
    summary: "Knowledge base stats",
    description:
      "Returns aggregate counts over the classified-product knowledge base: entries, total reuses, broker-approved entries, and distinct HTS chapters covered.",
  })
  @ApiOkResponse({
    type: ProductStatsResponseDto,
    description: "The knowledge base totals.",
  })
  stats(@Session() session: UserSession<typeof auth>) {
    return this.productsService.stats(getActiveOrganizationId(session));
  }

  /** One product with its classification. */
  @Get(":id")
  @ApiOperation({
    summary: "Get a product",
    description: "Returns one product and its current classification details.",
  })
  @ApiParam({ name: "id", description: "Product id." })
  @ApiOkResponse({ type: ProductResponseDto, description: "The product." })
  find(@Session() session: UserSession<typeof auth>, @Param("id") id: string) {
    return this.productsService.findOne(getActiveOrganizationId(session), id);
  }
}
