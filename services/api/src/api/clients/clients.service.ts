import { Injectable, NotFoundException } from "@nestjs/common";
import { deleteClient } from "@/db/queries/delete/deleteClient";
import { insertClient } from "@/db/queries/insert/insertClient";
import { listClients } from "@/db/queries/select/many/listClients";
import { selectClient } from "@/db/queries/select/one/selectClient";
import { updateClient } from "@/db/queries/update/updateClient";
import type { CreateClientDto } from "./dto/create-client.dto";
import type { ListClientsDto } from "./dto/list-clients.dto";
import type { UpdateClientDto } from "./dto/update-client.dto";

@Injectable()
export class ClientsService {
  async create(organizationId: string, userId: string, dto: CreateClientDto) {
    return insertClient({ ...dto, organizationId, userId });
  }

  async findAll(organizationId: string, query: ListClientsDto) {
    const { limit, offset, sortBy, sortDir, search, status, autonomy } = query;

    return listClients(
      { organizationId, search, statuses: status, autonomies: autonomy },
      { [sortBy]: sortDir },
      limit,
      offset,
    );
  }

  async findOne(organizationId: string, id: string) {
    const client = await selectClient(id, organizationId);
    if (!client) {
      throw new NotFoundException(`Client "${id}" not found`);
    }

    return client;
  }

  async update(organizationId: string, id: string, dto: UpdateClientDto) {
    const client = await updateClient(id, organizationId, dto);
    if (!client) {
      throw new NotFoundException(`Client "${id}" not found`);
    }

    return client;
  }

  async remove(organizationId: string, id: string) {
    const client = await deleteClient(id, organizationId);
    if (!client) {
      throw new NotFoundException(`Client "${id}" not found`);
    }

    return client;
  }
}
