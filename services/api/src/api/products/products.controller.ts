import { Controller, Get, Param, Query } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { getActiveOrganizationId } from "@/db/lib/getActiveOrganizationId";
import type { auth } from "@/lib/auth";
import {
  ListProductsResponseDto,
  ProductResponseDto,
} from "./dto/product.response.dto";
import { ProductsService } from "./products.service";

@ApiTags("Products")
@Controller("products")
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  /** The importer's product library. */
  @Get()
  @ApiOperation({
    summary: "List products",
    description:
      "Returns the product library — every product seen on shipment documents, with its current classification. A product is classified once and reused across shipments; the classification carries who set it (AI or broker) and a link to its full audit record.",
  })
  @ApiQuery({
    name: "clientId",
    required: false,
    description: "Filter to one client's products.",
  })
  @ApiOkResponse({
    type: ListProductsResponseDto,
    description: "The product library, newest first.",
  })
  list(
    @Session() session: UserSession<typeof auth>,
    @Query("clientId") clientId?: string,
  ) {
    return this.productsService.findAll(
      getActiveOrganizationId(session),
      clientId,
    );
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
