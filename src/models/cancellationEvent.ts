export class CancellationEvent extends Error {
  constructor(message?: string) {
    super(message);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CancellationEvent);
    }

    this.name = "CancellationEvent";
  }
}
