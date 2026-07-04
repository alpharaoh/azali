import Axios, { type AxiosError, type AxiosRequestConfig } from "axios";
import { env } from "#/env";

export const AXIOS_INSTANCE = Axios.create({
  baseURL: env.API_SERVER_URL,
  withCredentials: true,
});

export const axios = async <T>(
  url: string,
  {
    body,
    headers,
    signal,
    ...config
  }: RequestInit & Omit<AxiosRequestConfig, "headers" | "signal"> = {},
): Promise<T> => {
  return await AXIOS_INSTANCE({
    url,
    data: body,
    headers: headers as AxiosRequestConfig["headers"],
    signal: signal ?? undefined,
    ...config,
  });
};

// In some case with react-query and swr you want to be able to override the return error type so you can also do it here like this
export type ErrorType<Error> = AxiosError<Error>;
