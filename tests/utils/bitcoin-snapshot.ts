import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../../src/core/logger';

const execAsync = promisify(exec);

// Environment variables with defaults
const BITCOIN_CONTAINER_NAME = process.env.BITCOIN_CONTAINER_NAME || 'bitcoin-node';
const BITCOIN_DATA_DIR = process.env.BITCOIN_DATA_DIR || '/tmp/bitcoin_data';
const DOCKER_CMD = process.env.DOCKER_CMD || 'docker';

/**
 * Execute a command and return the result
 */
async function executeCommand(command: string, description: string): Promise<string> {
	try {
		logger.debug(`Executing: ${command}`);
		const { stdout, stderr } = await execAsync(command);
		if (stderr && stderr.trim()) {
			logger.warn(`${description} stderr: ${stderr}`);
		}
		return stdout.trim();
	} catch (error) {
		logger.error(`Error executing ${description}:`, error);
		throw error;
	}
}

/**
 * Check if a Docker container exists
 */
export async function containerExists(containerName: string): Promise<boolean> {
	try {
		const stdout = await executeCommand(
			`${DOCKER_CMD} ps -aq -f name=${containerName}`,
			`checking if container ${containerName} exists`
		);
		return stdout.length > 0;
	} catch (error) {
		logger.warn(`Error checking if container ${containerName} exists:`, error);
		return false;
	}
}

/**
 * Stop a Docker container
 */
export async function stopContainer(containerName: string): Promise<void> {
	try {
		logger.info(`Stopping container: ${containerName}`);
		await executeCommand(
			`${DOCKER_CMD} stop ${containerName}`,
			`stopping container ${containerName}`
		);
		logger.info(`Container ${containerName} stopped successfully`);
	} catch (error) {
		logger.warn(`Error stopping container ${containerName}:`, error);
		// Don't throw error as container might already be stopped
	}
}

/**
 * Start the Bitcoin container in persist mode
 */
export async function startContainerPersist(): Promise<void> {
	try {
		logger.info('Starting Bitcoin container in persist mode...');
		
		// Check if container already exists and is running
		const runningContainers = await executeCommand(
			`${DOCKER_CMD} ps -q -f name=${BITCOIN_CONTAINER_NAME}`,
			'checking for running containers'
		);
		
		if (runningContainers.length > 0) {
			logger.info('Container is already running');
			return;
		}

		// Check if container exists but is stopped
		const exists = await containerExists(BITCOIN_CONTAINER_NAME);
		if (exists) {
			logger.info('Starting existing container...');
			await executeCommand(
				`${DOCKER_CMD} start ${BITCOIN_CONTAINER_NAME}`,
				`starting container ${BITCOIN_CONTAINER_NAME}`
			);
		} else {
			logger.info('Creating and starting new container...');
			// Create the container using the regtest script approach
			const resolvedDataDir = path.resolve(BITCOIN_DATA_DIR);
			const command = `${DOCKER_CMD} run -d --name ${BITCOIN_CONTAINER_NAME} \
				-v "${resolvedDataDir}/regtest:/home/bitcoin/.bitcoin" \
				-p 18443:18443 -p 18444:18444 \
				ruimarinho/bitcoin-core:latest -regtest \
				-rpcuser=bitcoin -rpcpassword=1234 \
				-rpcallowip=0.0.0.0/0 -rpcbind=0.0.0.0 -reindex=1 -txindex=1 --fallbackfee=0.0001`;
			
			await executeCommand(command, `creating container ${BITCOIN_CONTAINER_NAME}`);
		}

		// Wait for the Bitcoin node to be ready
		await waitForBitcoinNode();
		
		logger.info('Bitcoin container started successfully');
	} catch (error) {
		logger.error('Error starting Bitcoin container:', error);
		throw error;
	}
}

/**
 * Wait for the Bitcoin node to be ready by checking if getblockchaininfo works
 */
async function waitForBitcoinNode(): Promise<void> {
	logger.info('Waiting for Bitcoin node to start...');
	
	let attempts = 0;
	const maxAttempts = 60; // Wait up to 60 seconds
	
	while (attempts < maxAttempts) {
		try {
			// Check if the Bitcoin node is ready using docker exec (similar to original implementation)
			// Use a simpler approach that's more reliable
			await execAsync(`${DOCKER_CMD} exec ${BITCOIN_CONTAINER_NAME} bitcoin-cli -regtest -rpcuser=bitcoin -rpcpassword=1234 getblockchaininfo`);
			
			// If we get here, the command succeeded
			logger.info('Bitcoin node is ready!');
			return;
		} catch {
			attempts++;
			if (attempts >= maxAttempts) {
				throw new Error('Bitcoin node failed to start within the expected time');
			}
			// Wait a bit longer for the first few attempts
			const delay = attempts < 10 ? 2000 : 1000;
			await new Promise(resolve => setTimeout(resolve, delay));
		}
	}
}

/**
 * Copy directory recursively (cross-platform)
 */
async function copyDirectory(src: string, dest: string): Promise<void> {
    // need to be executed with sudo
    await executeCommand(`sudo cp -a ${src} ${dest}`, `copying directory ${src} to ${dest}`);
    const user = await executeCommand(`whoami`, `getting current user`);
    await executeCommand(`sudo chown -R ${user}:${user} ${dest}`, `changing ownership of ${dest} to ${user}`);
}

/**
 * Create a snapshot of the Bitcoin regtest data
 */
export async function createSnapshot(snapshotDir: string): Promise<void> {
	try {
		logger.info(`Creating snapshot in: ${snapshotDir}`);
		
		// Stop the Bitcoin container
		await stopContainer(BITCOIN_CONTAINER_NAME);
		
		// Delete existing snapshot directory if it exists
		if (fs.existsSync(snapshotDir)) {
			logger.info(`Deleting existing snapshot directory: ${snapshotDir}`);
			await fs.promises.rm(snapshotDir, { recursive: true, force: true });
		}
		
		// Create snapshot directory
		await fs.promises.mkdir(snapshotDir, { recursive: true });
		
		// Copy Bitcoin data directory
		const bitcoinDataSrc = path.resolve(BITCOIN_DATA_DIR);
		const bitcoinDataDest = path.join(snapshotDir, 'bitcoin_data');
		
		if (fs.existsSync(bitcoinDataSrc)) {
			logger.info(`Copying Bitcoin data from ${bitcoinDataSrc} to ${bitcoinDataDest}`);
			await copyDirectory(bitcoinDataSrc, bitcoinDataDest);
		} else {
			logger.warn(`Bitcoin data directory not found: ${bitcoinDataSrc}`);
		}
		
		// Restart the container in persist mode
		await startContainerPersist();
		
		logger.info('Snapshot created successfully');
	} catch (error) {
		logger.error('Error creating snapshot:', error);
		throw error;
	}
}

/**
 * Load a snapshot of Bitcoin regtest data
 */
export async function loadSnapshot(snapshotDir: string): Promise<void> {
	try {
		logger.info(`Loading snapshot from: ${snapshotDir}`);
		
		// Check if snapshot directory exists
		if (!fs.existsSync(snapshotDir)) {
			throw new Error(`Snapshot directory not found: ${snapshotDir}`);
		}
		
		const bitcoinDataSrc = path.join(snapshotDir, 'bitcoin_data');
		if (!fs.existsSync(bitcoinDataSrc)) {
			throw new Error(`Bitcoin data not found in snapshot: ${bitcoinDataSrc}`);
		}
		
		// Stop the Bitcoin container
		await stopContainer(BITCOIN_CONTAINER_NAME);
		
		// Copy snapshot data back to Bitcoin data directory
		const bitcoinDataDest = path.resolve(BITCOIN_DATA_DIR);
		logger.info(`Copying Bitcoin data from ${bitcoinDataSrc} to ${bitcoinDataDest}`);
		
		// Create destination directory if it doesn't exist
		await fs.promises.mkdir(path.dirname(bitcoinDataDest), { recursive: true });
		
		// Remove existing data directory if it exists
		if (fs.existsSync(bitcoinDataDest)) {
            //need to run with sudo
            await executeCommand(`sudo rm -rf ${bitcoinDataDest}`, `removing existing data directory ${bitcoinDataDest}`);
		}
		
		// Copy the snapshot data
		await copyDirectory(bitcoinDataSrc, bitcoinDataDest);
		
		// Restart the container in persist mode
		await startContainerPersist();
		
		logger.info('Snapshot loaded successfully');
	} catch (error) {
		logger.error('Error loading snapshot:', error);
		throw error;
	}
}

/**
 * CLI entry point
 */
async function main() {
	const args = process.argv.slice(2);
	
	if (args.length !== 2) {
		console.error('Usage: ts-node bitcoinSnapshot.ts <create|load> <snapshot-dir>');
		process.exit(1);
	}
	
	const [action, snapshotDir] = args;
	
	try {
		switch (action) {
			case 'create':
				await createSnapshot(snapshotDir);
				console.log(`Snapshot created successfully in: ${snapshotDir}`);
				break;
			case 'load':
				await loadSnapshot(snapshotDir);
				console.log(`Snapshot loaded successfully from: ${snapshotDir}`);
				break;
			default:
				console.error('Invalid action. Use "create" or "load"');
				process.exit(1);
		}
	} catch (error) {
		console.error('Error:', error);
		process.exit(1);
	}
}

// Run CLI if this file is executed directly
if (require.main === module) {
	main().catch(error => {
		console.error('Unhandled error:', error);
		process.exit(1);
	});
}
