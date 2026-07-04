import { BadRequestException, Body, Controller, Post } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { BlobStorageService } from "@/services/external/s3/service";
import { UploadUrlDto, UploadUrlResponseDto } from "./upload.dto";

@Controller("projects")
export class UploadController {
  @Post("upload-url")
  @ApiOkResponse({ type: UploadUrlResponseDto })
  async getUploadUrl(
    @Session() session: UserSession,
    @Body() body: UploadUrlDto,
  ) {
    const { filename, contentType } = body;

    if (!filename.endsWith(".pptx") && !filename.endsWith(".ppt")) {
      throw new BadRequestException("Only .ppt and .pptx files are allowed");
    }

    const ext = filename.split(".").pop();
    const key = `projects/${session.user.id}/${crypto.randomUUID()}.${ext}`;

    const uploadUrl = await BlobStorageService.getUploadUrl({
      key,
      contentType,
    });

    return { uploadUrl, key };
  }
}
