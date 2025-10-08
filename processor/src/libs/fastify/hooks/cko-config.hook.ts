import { getConfig } from '../../../config/config';
import { FastifyRequest } from 'fastify';
import { ContextProvider } from '@commercetools/connect-payments-sdk';
import { ContextData } from '../context/context';

export class CkoConfigHook {
  private contextProvider: ContextProvider<ContextData>;

  constructor(opts: { contextProvider: ContextProvider<ContextData> }) {
    this.contextProvider = opts.contextProvider;
  }

  public readCkoConfig() {
    return async (request: FastifyRequest) => {
      this.contextProvider.updateContextData({
        ckoConfigKey: undefined,
      });
    };
  }
}
