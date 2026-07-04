import { Module } from "@nestjs/common";
import { AuthModule } from "@thallesp/nestjs-better-auth";
import { AppController } from "./app.controller";
import { LoggerModule } from "nestjs-pino";
import { AppService } from "./app.service";
import { auth } from "./lib/auth";
import { UsersController } from "./api/users/users.controller";
import { UsersModule } from "./api/users/users.module";
import { OnboardingModule } from "./api/onboarding/onboarding.module";
import { ProjectsModule } from "./api/projects/projects.module";
import { DeckEngineModule } from "./services/deck-engine/module";
import { APP_PIPE } from "@nestjs/core";
import { ZodValidationPipe } from "nestjs-zod";

@Module({
  imports: [
    AuthModule.forRoot({ auth }),
    LoggerModule.forRoot(),
    UsersModule,
    OnboardingModule,
    ProjectsModule,
    DeckEngineModule,
  ],
  controllers: [AppController, UsersController],
  providers: [
    AppService,
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
  ],
})
export class AppModule {}
