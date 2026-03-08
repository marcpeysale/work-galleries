import type { APIGatewayProxyResultV2 } from 'aws-lambda';

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '').split(',');

const corsHeaders = (origin: string | undefined): Record<string, string> => {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] ?? '';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json',
  };
};

export const ok = (body: unknown, origin?: string): APIGatewayProxyResultV2 => ({
  statusCode: 200,
  headers: corsHeaders(origin),
  body: JSON.stringify(body),
});

export const created = (body: unknown, origin?: string): APIGatewayProxyResultV2 => ({
  statusCode: 201,
  headers: corsHeaders(origin),
  body: JSON.stringify(body),
});

export const noContent = (origin?: string): APIGatewayProxyResultV2 => ({
  statusCode: 204,
  headers: corsHeaders(origin),
  body: '',
});

export const badRequest = (message: string, origin?: string): APIGatewayProxyResultV2 => ({
  statusCode: 400,
  headers: corsHeaders(origin),
  body: JSON.stringify({ message }),
});

export const unauthorized = (origin?: string): APIGatewayProxyResultV2 => ({
  statusCode: 401,
  headers: corsHeaders(origin),
  body: JSON.stringify({ message: 'Non autorisé' }),
});

export const forbidden = (origin?: string): APIGatewayProxyResultV2 => ({
  statusCode: 403,
  headers: corsHeaders(origin),
  body: JSON.stringify({ message: 'Accès refusé' }),
});

export const notFound = (origin?: string): APIGatewayProxyResultV2 => ({
  statusCode: 404,
  headers: corsHeaders(origin),
  body: JSON.stringify({ message: 'Ressource introuvable' }),
});

export const internalError = (message = 'Erreur interne', origin?: string): APIGatewayProxyResultV2 => ({
  statusCode: 500,
  headers: corsHeaders(origin),
  body: JSON.stringify({ message }),
});
