class HttpError extends Error {
  res: object | string = null
  status: number
  toResponse() {
    return typeof this.res === 'string' ? this.res : JSON.stringify(this.res)
  }
}

interface HttpResponse {
  status: number
}

export class BadRequest<T extends Object | string>
  extends HttpError
  implements HttpResponse
{
  readonly status: number = 400

  constructor(res: T) {
    super('Bad Request')
    this.res = res
  }
}

export class Forbidden<T extends Object | string>
  extends HttpError
  implements HttpResponse
{
  readonly status: number = 403

  constructor(res: T) {
    super('Forbidden')
    this.res = res
  }
}

export class NotFound<T extends Object | string>
  extends HttpError
  implements HttpResponse
{
  readonly status: number = 404

  constructor(res: T) {
    super('Not Found')
    this.res = res
  }
}
