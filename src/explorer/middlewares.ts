import { Request, Response, NextFunction } from 'express';
import { logger } from '../core/logger';

// Error response interface
export interface ErrorResponse {
	error: string;
	message: string;
	details?: unknown;
}

// Error handling middleware
export const errorHandler = (
	err: Error,
	req: Request,
	res: Response,
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	_next: NextFunction
): void => {
	logger.error('API Error:', {
		error: err.message,
		stack: err.stack,
		path: req.path,
		method: req.method,
	});

	if (err.message.includes('Timeout')) {
		res.status(408).json({ error: `Request Timeout`, message: err.message });
		return;
	}

	const errorResponse: ErrorResponse = {
		error: 'Internal Server Error',
		message: 'An unexpected error occurred',
	};
	res.status(500).json(errorResponse);
};

// Request logging middleware
export const requestLogger = (
	req: Request,
	res: Response,
	next: NextFunction
): void => {
	logger.info('Incoming request', {
		path: req.path,
		method: req.method,
		ip: req.ip,
		body: req.body,
	});
	next();
};

// 404 handler middleware
export const notFoundHandler = (req: Request, res: Response): void => {
	logger.warn('Route not found', {
		path: req.path,
		method: req.method,
	});

	const errorResponse: ErrorResponse = {
		error: 'Not Found',
		message: 'The requested route does not exist',
	};
	res.status(404).json(errorResponse);
};

// Async handler wrapper to avoid try-catch blocks in route handlers
export type AsyncRequestHandler = (
	req: Request,
	res: Response,
	next: NextFunction
) => Promise<void>;

export const asyncHandler =
	async (fn: AsyncRequestHandler) =>
	async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		await Promise.resolve(fn(req, res, next)).catch(next);
	};
