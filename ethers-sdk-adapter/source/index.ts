import * as OracleSdk from '@keydonix/uniswap-oracle-sdk'

type Provider = { send: (method: string, params?: unknown[] | object) => Promise<unknown> }

export function getBlockByNumberFactory(provider: Provider): OracleSdk.EthGetBlockByNumber {
	return async (blockNumber: bigint | 'latest') => {
		const block = await provider.send('eth_getBlockByNumber', [`0x${blockNumber.toString(16)}`, false])
		assertPlainObject(block)
		assertProperty(block, 'parentHash', 'string')
		assertProperty(block, 'sha3Uncles', 'string')
		assertProperty(block, 'miner', 'string')
		assertProperty(block, 'stateRoot', 'string')
		assertProperty(block, 'transactionsRoot', 'string')
		assertProperty(block, 'receiptsRoot', 'string')
		assertProperty(block, 'logsBloom', 'string')
		assertProperty(block, 'difficulty', 'string')
		assertProperty(block, 'number', 'string')
		assertProperty(block, 'gasLimit', 'string')
		assertProperty(block, 'gasUsed', 'string')
		assertProperty(block, 'timestamp', 'string')
		assertProperty(block, 'extraData', 'string')
		assertProperty(block, 'mixHash', 'string')
		assertProperty(block, 'nonce', 'string')
		return {
			parentHash: stringToBigint(block.parentHash),
			sha3Uncles: stringToBigint(block.sha3Uncles),
			miner: stringToBigint(block.miner),
			stateRoot: stringToBigint(block.stateRoot),
			transactionsRoot: stringToBigint(block.transactionsRoot),
			receiptsRoot: stringToBigint(block.receiptsRoot),
			logsBloom: stringToBigint(block.logsBloom),
			difficulty: stringToBigint(block.difficulty),
			number: stringToBigint(block.number),
			gasLimit: stringToBigint(block.gasLimit),
			gasUsed: stringToBigint(block.gasUsed),
			timestamp: stringToBigint(block.timestamp),
			extraData: stringToByteArray(block.extraData),
			mixHash: stringToBigint(block.mixHash),
			nonce: stringToBigint(block.nonce),
		}
	}
}

export function getStorageAtFactory(provider: Provider): OracleSdk.EthGetStorageAt {
	return async (address: bigint, position: bigint, block: bigint | 'latest') => {
		const encodedAddress = bigintToHexAddress(address)
		const encodedPosition = bigintToHexQuantity(position)
		const encodedBlockTag = block === 'latest' ? 'latest' : bigintToHexQuantity(block)
		const result = await provider.send('eth_getStorageAt', [encodedAddress, encodedPosition, encodedBlockTag])
		if (typeof result !== 'string') throw new Error(`Expected eth_getStorageAt to return a string but instead returned a ${typeof result}`)
		return stringToBigint(result)
	}
}

export function getProofFactory(provider: Provider): OracleSdk.EthGetProof {
	return async (address: bigint, positions: readonly bigint[], block: bigint) => {
		const encodedAddress = bigintToHexAddress(address)
		const encodedPositions = positions.map(bigintToHexQuantity)
		const encodedBlockTag = bigintToHexQuantity(block)
		const result = await provider.send('eth_getProof', [encodedAddress, encodedPositions, encodedBlockTag])
		assertPlainObject(result)
		assertProperty(result, 'accountProof', 'array')
		assertProperty(result, 'storageProof', 'array')
		const accountProof = result.accountProof.map(entry => {
			assertType(entry, 'string')
			return stringToByteArray(entry)
		})
		const storageProof = result.storageProof.map(entry => {
			assertPlainObject(entry)
			assertProperty(entry, 'key', 'string')
			assertProperty(entry, 'value', 'string')
			assertProperty(entry, 'proof', 'array')
			return {
				key: stringToBigint(entry.key),
				value: stringToBigint(entry.key),
				proof: entry.proof.map(proofEntry => {
					assertType(proofEntry, 'string')
					return stringToByteArray(proofEntry)
				})
			}
		})
		return { accountProof, storageProof }
	}
}

export class JsonRpcError extends Error {
	constructor(public readonly code: number, message: string, public readonly data?: unknown) {
		super(message)
		// https://github.com/Microsoft/TypeScript-wiki/blob/master/Breaking-Changes.md#extending-built-ins-like-error-array-and-map-may-no-longer-work
		Object.setPrototypeOf(this, JsonRpcError.prototype)
	}
}

function assertPlainObject(maybe: unknown): asserts maybe is {} {
	if (typeof maybe !== 'object') throw new Error(`Expected an object but received a ${typeof maybe}`)
	if (maybe === null) throw new Error(`Expected an object but received null.`)
	if (Array.isArray(maybe)) throw new Error(`Expected an object but received an array.`)
	if (Object.getPrototypeOf(maybe) !== Object.prototype) throw new Error(`Expected a plain object, but received a class instance.`)
}


type TypeMapping = { 'string': string, 'object': {}, 'array': unknown[] }
function assertType<V extends 'string' | 'object' | 'array'>(maybe: unknown, expectedPropertyType: V): asserts maybe is TypeMapping[V] {
	if (expectedPropertyType === 'string' && typeof maybe === 'string') return
	if (expectedPropertyType === 'array' && Array.isArray(maybe)) return
	if (expectedPropertyType === 'object' && typeof maybe === 'object' && maybe !== null && !Array.isArray(maybe)) return
	throw new Error(`Value is of type ${typeof maybe} instead of expected type ${expectedPropertyType}`)
}
function assertProperty<T extends {}, K extends string, V extends 'string' | 'object' | 'array'>(maybe: T, propertyName: K, expectedPropertyType: V): asserts maybe is T & { [Key in K]: TypeMapping[V] } {
	if (!(propertyName in maybe)) throw new Error(`Object does not contain a ${propertyName} property.`)
	const propertyValue = (maybe as any)[propertyName] as unknown
	// CONSIDER: DRY with `assertType`
	if (expectedPropertyType === 'string' && typeof propertyValue === 'string') return
	if (expectedPropertyType === 'array' && Array.isArray(propertyValue)) return
	if (expectedPropertyType === 'object' && typeof propertyValue === 'object' && propertyValue !== null && !Array.isArray(propertyValue)) return
	throw new Error(`Object.${propertyName} is of type ${typeof propertyValue} instead of expected type ${expectedPropertyType}`)
}

function stringToBigint(hex: string): bigint {
	const match = /^(?:0x)?([a-fA-F0-9]*)$/.exec(hex)
	if (match === null) throw new Error(`Expected a hex string encoded number with an optional '0x' prefix but received ${hex}`)
	const normalized = match[1]
	return BigInt(`0x${normalized}`)
}

function stringToByteArray(hex: string): Uint8Array {
	const match = /^(?:0x)?([a-fA-F0-9]*)$/.exec(hex)
	if (match === null) throw new Error(`Expected a hex string encoded byte array with an optional '0x' prefix but received ${hex}`)
	const normalized = match[1]
	if (normalized.length % 2) throw new Error(`Hex string encoded byte array must be an even number of charcaters long.`)
	const bytes = []
	for (let i = 0; i < normalized.length; i += 2) {
		bytes.push(Number.parseInt(`${normalized[i]}${normalized[i + 1]}`, 16))
	}
	return new Uint8Array(bytes)
}

function bigintToHexAddress(value: bigint): string {
	return `0x${value.toString(16).padStart(40, '0')}`
}

function bigintToHexQuantity(value: bigint): string {
	return `0x${value.toString(16)}`
}
