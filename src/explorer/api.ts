import { Express } from 'express';
import { errorHandler, requestLogger, notFoundHandler } from './middlewares';
import { renderTransaction } from './render-transaction';
import { logger } from '../core/logger';

export const GREETING = 'This is the Grail Prp Charms Explorer API.';

export function setApi(app: Express): void {
	// Add request logging middleware
	app.use(requestLogger);

	// sanity
	app.get('/', (req, res): void => {
		res.send(GREETING);
	});

	app.get('/transaction/:txid', async (req, res): Promise<void> => {
		logger.info(`Rendering transaction for txid: ${req.params.txid}`);
		const txid = req.params.txid;
		if (!txid) {
			res.status(400).send('Transaction ID is required');
			return;
		}

		try {
			const html = await renderTransaction(txid);
			res.setHeader('Content-Type', 'text/html');
			res.status(404).send(html);
		} catch (error) {
			logger.error(error);
			res.status(500).send(`Error rendering transaction`);
		}
	});

	// Handle 404 - Route not found
	app.use(notFoundHandler);

	// Global error handler
	app.use(errorHandler);
}
