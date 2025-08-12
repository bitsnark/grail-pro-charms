import cors from 'cors';
import express from 'express';
import * as http from 'http';
import { setApi } from './api';
import { DEBUG_LEVELS, logger } from '../core/logger';
import { parse } from '../core/env-parser';

logger.setLoggerOptions(DEBUG_LEVELS.ERROR, true, true); // Set debug level to ALL, print date and level

export function initServer(): void {
	const app = express();
	app.use(cors()); // <-- Enable CORS for cross-origin requests
	app.set('trust proxy', 2);
	app.use(express.json());

	setApi(app);

	// HTTP server options
	const options = {};

	// Create HTTP server with the Express app
	const port = parse.integer('HTTP_PORT', 3000);
	const host = '0.0.0.0';
	logger.log(`Starting HTTP server on ${host}:${port}`);
	http.createServer(options, app).listen(port, host, () => {
		logger.info(`HTTP server listening on port ${host}:${port}`);
	});
}

if (require.main === module) {
	initServer();
}
