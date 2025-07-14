
export function setupLog() {
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;

  console.log = function (...args: any[]) {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.map(arg => {
      if (typeof arg === 'object') {
        return JSON.stringify(arg, null, 2);
      }
      return String(arg);
    }).join(' ');
    process.stdout.write(`[${timestamp}] ${formattedArgs}\n`);
  }

  console.error = function (...args: any[]) {
    originalConsoleLog('Error:');
    originalConsoleError(...args);
  }
}
