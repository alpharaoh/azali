import { Module, RequestMethod } from "@nestjs/common";
import { APP_PIPE } from "@nestjs/core";
import { AuthModule } from "@thallesp/nestjs-better-auth";
import { LoggerModule } from "nestjs-pino";
import { ZodValidationPipe } from "nestjs-zod";
import { UsersController } from "./api/users/users.controller";
import { UsersModule } from "./api/users/users.module";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { auth } from "./lib/auth";

@Module({
  imports: [
    AuthModule.forRoot({ auth }),
    LoggerModule.forRoot({
      forRoutes: [{ path: "*path", method: RequestMethod.ALL }],
    }),
    UsersModule,
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
