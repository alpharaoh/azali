import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { json } from "express";
import { OnboardingController } from "./onboarding.controller";

@Module({ controllers: [OnboardingController] })
export class OnboardingModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(json()).forRoutes(OnboardingController);
  }
}
