import { PutObjectCommand } from "@aws-sdk/client-s3";
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
}
