import { config } from '../../config/config';
import { ApiResources } from '../types/api.type';
import { CkoInstrument } from '../types/instrument.type';
import { CkoBaseApi } from './base-api';

export class InstrumentApi extends CkoBaseApi {
  constructor() {
    super();
  }

  public async getInstrument(id: string): Promise<CkoInstrument> {
    const url = this.buildResourceUrl(config.ckoEnvironment, ApiResources.GET_INSTRUMENT, id);

    return await this.executeCall<CkoInstrument>({
      method: 'get',
      url,
    });
  }

  public async deleteInstrument(id: string): Promise<void> {
    const url = this.buildResourceUrl(config.ckoEnvironment, ApiResources.DELETE_INSTRUMENT, id);

    await this.executeCall<void>({
      method: 'delete',
      url,
    });
  }
}
