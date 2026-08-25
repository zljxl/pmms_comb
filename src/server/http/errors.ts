export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const badRequest = (message: string) => new HttpError(400, message);
export const forbidden = (message = 'Acesso negado.') => new HttpError(403, message);
export const notFound = (message = 'Registro não encontrado.') => new HttpError(404, message);
