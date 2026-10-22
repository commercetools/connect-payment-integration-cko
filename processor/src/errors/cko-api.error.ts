import { Errorx, ErrorxAdditionalOpts } from '@commercetools/connect-payments-sdk';

export type CkoApiErrorData = {
  request_id?: string;
  error_type?: string;
  error_codes?: string[];
};

const errorCodeMap: Record<number, string> = {
  401: 'Unauthorized',
  403: 'NotAllowed',
  404: 'NotFound',
  422: 'InvalidData',
  429: 'ManyRequests',
  500: 'InternalError',
  502: 'BadGateway',
};

const errorMessageMap: Record<number, string> = {
  401: 'Unauthorized',
  403: 'Operation not allowed',
  404: 'Resource not found',
  422: 'Invalid data provided',
  429: 'Too many requests',
  500: 'Internal server error',
  502: 'Bad gateway',
};

export class CkoApiError extends Errorx {
  constructor(status: number, errorData?: CkoApiErrorData, additionalOpts?: ErrorxAdditionalOpts) {
    const errorCode = errorCodeMap[status] || 'GeneralError';
    const errorMessage = errorMessageMap[status] || 'An error occurred';

    super({
      code: `CkoError-${errorCode}`,
      httpErrorStatus: status,
      message: errorMessage,
      ...(errorData?.error_codes && { detailedErrorMessage: errorData.error_codes.join(', ') }),
      ...(errorData && {
        privateFields: {
          requestId: errorData?.request_id,
          errorType: errorData?.error_type,
          errorCodes: errorData?.error_codes,
        },
      }),
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

export class NotImplementedError extends Errorx {
  constructor(message: string, additionalOpts?: ErrorxAdditionalOpts) {
    super({
      code: 'NotImplemented',
      httpErrorStatus: 501,
      message,
      skipLog: true,
      ...additionalOpts,
    });
  }
}
