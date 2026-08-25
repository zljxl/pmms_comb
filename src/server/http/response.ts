import { NextResponse } from 'next/server';
import { HttpError } from './errors';
export function routeError(error: unknown) {
  console.error(error instanceof Error ? error.stack : error);
  return error instanceof HttpError
    ? NextResponse.json({ message: error.message }, { status: error.status })
    : NextResponse.json({ message: 'Erro interno do servidor.' }, { status: 500 });
}
