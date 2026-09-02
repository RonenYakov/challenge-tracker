export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

/** `what` names the thing for the developer; the sentence the user reads is built here. */
export const notFound = (what: string) => new HttpError(404, `${NAMES[what] ?? what} לא נמצא`)

const NAMES: Record<string, string> = {
  Challenge: 'האתגר',
  Task: 'הכלל',
  Goal: 'היעד',
  Event: 'האירוע',
  Timer: 'הטיימר',
  'Timer task': 'כלל מתוזמן',
  'Active challenge': 'אתגר פעיל',
  Calendar: 'היומן',
}
export const badRequest = (message: string) => new HttpError(400, message)
export const conflict = (message: string) => new HttpError(409, message)
