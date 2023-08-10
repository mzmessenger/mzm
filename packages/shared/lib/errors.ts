class HttpError extends Error {
  res: object | string | null = null
  readonly status: number = 200
  toResponse() {
    return typeof this.res === 'string' ? this.res : JSON.stringify(this.res)
  }
}

interface HttpResponse {
  status: number
}

export class BadRequest<T extends object | string>
  extends HttpError
  implements HttpResponse
{
  readonly status: number = 400

  constructor(res: T) {
    super('BadRequest')
    this.res = res
  }
}

export class Unauthorized<T extends object | string>
  extends HttpError
  implements HttpResponse
{
  readonly status: number = 401

  constructor(res: T) {
    super('Unauthorized')
    this.res = res
  }
}

export class Forbidden<T extends object | string>
  extends HttpError
  implements HttpResponse
{
  readonly status: number = 403

  constructor(res: T) {
    super('Forbidden')
    this.res = res
  }
}

export class NotFound<T extends object | string>
  extends HttpError
  implements HttpResponse
{
  readonly status: number = 404

  constructor(res: T) {
    super('NotFound')
    this.res = res
  }
}

export class InternalServerError<T extends object | string>
  extends HttpError
  implements HttpResponse
{
  readonly status: number = 500

  constructor(res: T) {
    super('InternalServerError')
    this.res = res
  }
}

export const isHttpError = (err: unknown): err is HttpError => {
  return err instanceof HttpError
}
