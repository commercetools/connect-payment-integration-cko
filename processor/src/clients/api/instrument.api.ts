import { getConfig } from '@app/config/config';
import { CkoBaseApi } from './base-api';
import { CkoInstrument } from '../types/instrument.type';
import { ApiResources } from '../types/api.type';

export class InstrumentApi extends CkoBaseApi {
  constructor() {
    super();
  }

  public async getInstrument(id: string): Promise<CkoInstrument> {
    const url = this.buildResourceUrl(getConfig().ckoEnvironment, ApiResources.INSTRUMENTS, id);

    return await this.executeCall<CkoInstrument>({
      method: 'get',
      url,
    });
  }

  public async deleteInstrument(id: string): Promise<void> {
    const url = this.buildResourceUrl(getConfig().ckoEnvironment, ApiResources.INSTRUMENTS, id);

    await this.executeCall<void>({
      method: 'delete',
      url,
    });
  }
}
