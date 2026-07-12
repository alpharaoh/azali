import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/env";
import { s3Client } from "./client";

export class BlobStorageService {
  static async getUploadUrl({
    key,
    contentType,
    expiresIn = 300,
  }: {
    key: string;
    contentType: string;
    expiresIn?: number;
  }): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: key,
      ContentType: contentType,
    });

    return getSignedUrl(s3Client, command, { expiresIn });
  }

  static async getDownloadUrl({
    key,
    expiresIn = 300,
  }: {
    key: string;
    expiresIn?: number;
  }): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: key,
    });

    return getSignedUrl(s3Client, command, { expiresIn });
  }

  static async getObject({ key }: { key: string }): Promise<Uint8Array> {
    const response = await s3Client.send(
      new GetObjectCommand({ Bucket: env.AWS_S3_BUCKET, Key: key }),
    );

    if (!response.Body) {
      throw new Error(`Object ${key} has no body`);
    }

    return response.Body.transformToByteArray();
  }

  static async putObject({
    key,
    body,
    contentType,
  }: {
    key: string;
    body: Uint8Array;
    contentType: string;
  }): Promise<void> {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: env.AWS_S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }
}
