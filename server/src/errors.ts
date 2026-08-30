export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

export const notFound = (what: string) => new HttpError(404, `${what} not found`)
export const badRequest = (message: string) => new HttpError(400, message)
export const conflict = (message: string) => new HttpError(409, message)
