import Axios, { type AxiosRequestConfig } from "axios";

const DECK_ENGINE_URL = process.env.DECK_ENGINE_URL ?? "http://localhost:3002";

export const DECK_ENGINE_INSTANCE = Axios.create({
  baseURL: DECK_ENGINE_URL,
});

export const deckEngineAxios = async <T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): Promise<T> => {
  const { data } = await DECK_ENGINE_INSTANCE({
    ...config,
    ...options,
  });
  return data as T;
};

export default deckEngineAxios;
