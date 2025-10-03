import { Errorx, ErrorxAdditionalOpts } from '@commercetools/connect-payments-sdk';

export type CkoApiErrorData = {
  status: number;
  errorCode: string;
  message: string;
  errorType?: string;
};

export class CkoApiError extends Errorx {
  constructor(errorData: CkoApiErrorData, additionalOpts?: ErrorxAdditionalOpts) {
    super({
      code: `CkoError-${errorData.errorCode}`,
      httpErrorStatus: errorData.status,
      message: errorData.message,
      ...additionalOpts,
    });
  }
}

export type UnsupportedNotificationErrorData = {
  notificationEvent: string;
};

export class UnsupportedNotificationError extends Errorx {
  constructor(errorData: UnsupportedNotificationErrorData, additionalOpts?: ErrorxAdditionalOpts) {
    super({
      code: 'UnsupportedNotification',
      httpErrorStatus: 400,
      message: `Unsupported notification event: ${errorData.notificationEvent}`,
      skipLog: true,
      ...additionalOpts,
    });
  }
}
