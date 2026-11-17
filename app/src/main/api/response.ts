// src/main/api/response.ts
//
// Convención de respuesta de la API local (ver stack-tecnologico.md, sección 3,
// y docs/03-gestion-proyecto/sprint-1-backlog.md, punto 0).
//
// Toda respuesta exitosa tiene la forma { ok: true, data }.
// Toda respuesta de error tiene la forma { ok: false, error: { message, code? } }.
// Esto permite que el renderer distinga el resultado sin depender únicamente
// del código HTTP, y deja un lugar fijo para los mensajes de validación.

import type { Response } from "express";

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: {
    message: string;
    code?: string;
  };
}

export type ApiResponseBody<T> = ApiSuccess<T> | ApiError;

export function sendOk<T>(res: Response, data: T, status = 200): void {
  const body: ApiSuccess<T> = { ok: true, data };
  res.status(status).json(body);
}

export function sendError(
  res: Response,
  status: number,
  message: string,
  code?: string,
): void {
  const body: ApiError = { ok: false, error: { message, code } };
  res.status(status).json(body);
}

// Errores de uso frecuente, para no repetir el status HTTP en cada endpoint.
export const sendNotFound = (res: Response, message = "No encontrado"): void =>
  sendError(res, 404, message, "NOT_FOUND");

export const sendBadRequest = (res: Response, message: string): void =>
  sendError(res, 400, message, "BAD_REQUEST");

export const sendUnauthorized = (res: Response, message = "No autenticado"): void =>
  sendError(res, 401, message, "UNAUTHORIZED");

export const sendForbidden = (res: Response, message = "No autorizado"): void =>
  sendError(res, 403, message, "FORBIDDEN");

export const sendServerError = (res: Response, message = "Error interno"): void =>
  sendError(res, 500, message, "INTERNAL_ERROR");