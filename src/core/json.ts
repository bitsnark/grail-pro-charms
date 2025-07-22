// This is a hideous hack to overcome no proper support for Buffer in JSON.stringify/parse
export function bufferReplacer(key: string, value: any): any {
	if (value && value['type'] === 'Buffer' && Array.isArray(value['data'])) {
		return '0x' + Buffer.from(value.data).toString('hex');
	}
	return value;
}

export function bufferReviver(key: string, value: any): any {
	if (value instanceof String && value.startsWith('0x')) {
		return Buffer.from(value.slice(2), 'hex');
	}
	return value;
}
