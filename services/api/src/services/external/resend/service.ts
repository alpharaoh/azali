import { Resend } from "resend";
import { env } from "@/env";

const resend = new Resend(env.RESEND_API_KEY);

export enum EmailServiceType {
  SIGN_IN = "sign-in",
}

const EMAIL_SERVICE_CONTENT = {
  [EmailServiceType.SIGN_IN]: ({ otp }: { otp: string }) => ({
    subject: "Sign in to Azali",
    html: `
      <p>You are receiving this email because you signed in to Azali.</p>
      <p>Your one-time password is: <strong>${otp}</strong></p>
      <p>If you did not sign in to Azali, please ignore this email.</p>
    `,
  }),
} satisfies Record<
  EmailServiceType,
  (...args: never[]) => { subject: string; html: string }
>;

type EmailContentMap = typeof EMAIL_SERVICE_CONTENT;
type EmailArgs<T extends EmailServiceType> = Parameters<EmailContentMap[T]>[0];

export class EmailService {
  static async send<T extends EmailServiceType>({
    type,
    to,
    args,
  }: {
    type: T;
    to: string;
    args: EmailArgs<T>;
  }) {
    const emailFunc = EMAIL_SERVICE_CONTENT[type] as (arg: EmailArgs<T>) => {
      subject: string;
      html: string;
    };
    const props = emailFunc(args);

    return await resend.emails.send({
      from: "onboarding@resend.dev",
      to,
      ...props,
    });
  }
}
