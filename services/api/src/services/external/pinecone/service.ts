import { pinecone } from "./client";

const INDEX_NAME = "azali-knowledge-base";
/** Hosted embedding model — callers pass text, Pinecone handles vectors. */
const EMBEDDING_MODEL = "llama-text-embed-v2";
/** Integrated-embedding upserts accept at most 96 records per request. */
const UPSERT_BATCH_SIZE = 96;

/** Filterable attributes stored alongside a record (Pinecone metadata). */
export type KnowledgeMetadata = Record<
  string,
  string | number | boolean | string[]
>;

export interface KnowledgeDocument {
  id: string;
  /** The text to embed and search against. */
  text: string;
  metadata?: KnowledgeMetadata;
}

export interface KnowledgeMatch {
  id: string;
  /** Similarity score — higher is a closer match. */
  score: number;
  text: string;
  metadata: Record<string, unknown>;
}

/** One namespace per organization keeps tenants' knowledge isolated. */
const namespaceFor = (organizationId: string) =>
  pinecone.index({ name: INDEX_NAME, namespace: organizationId });

export class KnowledgeBaseService {
  /**
   * Create the knowledge-base index if it doesn't exist yet. Safe to call at
   * startup — an existing index resolves without error.
   */
  static async ensureIndex(): Promise<void> {
    await pinecone.createIndexForModel({
      name: INDEX_NAME,
      cloud: "aws",
      region: "us-east-1",
      embed: {
        model: EMBEDDING_MODEL,
        fieldMap: { text: "text" },
      },
      waitUntilReady: true,
      suppressConflicts: true,
    });
  }

  /** Add or replace documents in an organization's knowledge base. */
  static async upsert({
    organizationId,
    documents,
  }: {
    organizationId: string;
    documents: KnowledgeDocument[];
  }): Promise<void> {
    const namespace = namespaceFor(organizationId);

    for (let i = 0; i < documents.length; i += UPSERT_BATCH_SIZE) {
      await namespace.upsertRecords({
        records: documents
          .slice(i, i + UPSERT_BATCH_SIZE)
          .map(({ id, text, metadata }) => ({ id, text, ...metadata })),
      });
    }
  }

  /** Semantic search over an organization's knowledge base. */
  static async search({
    organizationId,
    query,
    topK = 10,
    filter,
  }: {
    organizationId: string;
    query: string;
    topK?: number;
    /** Pinecone metadata filter, e.g. `{ source: { $eq: "ruling" } }`. */
    filter?: object;
  }): Promise<KnowledgeMatch[]> {
    const response = await namespaceFor(organizationId).searchRecords({
      query: { topK, inputs: { text: query }, filter },
    });

    return response.result.hits.map((hit) => {
      const { text, ...metadata } = hit.fields as Record<string, unknown>;

      return {
        id: hit._id,
        score: hit._score,
        text: typeof text === "string" ? text : "",
        metadata,
      };
    });
  }

  /** Delete specific documents from an organization's knowledge base. */
  static async remove({
    organizationId,
    ids,
  }: {
    organizationId: string;
    ids: string[];
  }): Promise<void> {
    await namespaceFor(organizationId).deleteMany({ ids });
  }

  /** Delete an organization's entire knowledge base. */
  static async clear({
    organizationId,
  }: {
    organizationId: string;
  }): Promise<void> {
    await namespaceFor(organizationId).deleteAll();
  }
}
