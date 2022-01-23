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

export class BadRequest extends HttpError implements HttpResponse {
  readonly status: number = 400

  constructor(res: Object | string) {
    super('Bad Request')
    this.res = res
  }
}

export class Forbidden extends HttpError implements HttpResponse {
  readonly status: number = 403

  constructor(res: Object | string) {
    super('Forbidden')
    this.res = res
  }
}

export class NotFound extends HttpError implements HttpResponse {
  readonly status: number = 404

  constructor(res: Object | string) {
    super('Not Found')
    this.res = res
  }
}
