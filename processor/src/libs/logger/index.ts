import { createApplicationLogger } from '@commercetools-backend/loggers';
import { defaultFieldsFormatter } from '@commercetools/connect-payments-sdk';
import { getConfig } from '@app/config/config';
import { getRequestContext } from '@lib/fastify/context/context';

export const log = createApplicationLogger({
  formatters: [
    defaultFieldsFormatter({
      projectKey: getConfig().projectKey,
      version: process.env.npm_package_version,
      name: process.env.npm_package_name,
      correlationId: () => getRequestContext().correlationId,
      pathTemplate: () => getRequestContext().pathTemplate,
      path: () => getRequestContext().path,
    }),
  ],
});
