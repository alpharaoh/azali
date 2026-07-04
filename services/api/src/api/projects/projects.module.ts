import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { json } from "express";
import { ProjectsController } from "./projects.controller";
import { UploadController } from "./upload/upload.controller";
import { SessionsController } from "./sessions/sessions.controller";

@Module({
  controllers: [ProjectsController, UploadController, SessionsController],
})
export class ProjectsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(json())
      .forRoutes(ProjectsController, UploadController, SessionsController);
  }
}
