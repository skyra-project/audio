import { Backoff, exponential } from 'backoff';
import { once } from 'events';
import type { IncomingMessage } from 'http';
import * as WebSocket from 'ws';
import type { BaseNode } from '../base/BaseNode';
import type { IncomingPayload } from '../types/IncomingPayloads';
import type { OutgoingPayload } from '../types/OutgoingPayloads';

interface Sendable {
	resolve: () => void;
	reject: (e: Error) => void;
	data: Buffer | string;
}

interface Headers {
	Authorization: string;
	'Num-Shards': number;
	'User-Id': string;
	'Client-Name': string;
	'Resume-Key'?: string;
}

export const enum WebSocketEvents {
	Open = 'open',
	Close = 'close',
	Upgrade = 'upgrade',
	Message = 'message',
	Error = 'error'
}

export const enum ConnectionEvents {
	Close = 'close',
	Error = 'error',
	Event = 'event',
	Open = 'open',
	PlayerUpdate = 'playerUpdate',
	Stats = 'stats',
	Upgrade = 'upgrade'
}

export interface Options extends WebSocket.ClientOptions {
	/**
	 * The key to send when resuming the session. Set to `null` or leave unset to disable resuming.
	 * @defaults `null`
	 */
	resumeKey?: string | null;

	/**
	 * The number of seconds after disconnecting before the session is closed anyways. This is useful for avoiding
	 * accidental leaks.
	 * @defaults `60`
	 */
	resumeTimeout?: number;
}

export class Connection<T extends BaseNode = BaseNode> {
	/**
	 * The node that owns this connection.
	 */
	public readonly node: T;

	/**
	 * The url the connection connects to.
	 */
	public readonly url: string;

	/**
	 * The websocket options.
	 */
	public readonly options: Options;

	/**
	 * The resume key, check [[Options.resumeKey]] for more information.
	 */
	public resumeKey?: string | null;

	/**
	 * The websocket connection.
	 */
	public ws: WebSocket | null;

	/* eslint-disable @typescript-eslint/explicit-member-accessibility */

	/**
	 * The back-off queue.
	 */
	#backoff: Backoff = exponential();

	/**
	 * The queue of requests to be processed.
	 */
	#queue: Sendable[] = [];

	/**
	 * The bound callback function for `wsSend`.
	 */
	#send: Connection<T>['wsSend'];

	/**
	 * The bound callback function for `onOpen`.
	 */
	#open: Connection<T>['onOpen'];

	/**
	 * The bound callback function for `onClose`.
	 */
	#close: Connection<T>['onClose'];

	/**
	 * The bound callback function for `onUpgrade`.
	 */
	#upgrade: Connection<T>['onUpgrade'];

	/**
	 * The bound callback function for `onMessage`.
	 */
	#message: Connection<T>['onMessage'];

	/**
	 * The bound callback function for `onError`.
	 */
	#error: Connection<T>['onError'];

	/* eslint-enable @typescript-eslint/explicit-member-accessibility */

	public constructor(node: T, url: string, options: Options = {}) {
		this.node = node;
		this.url = url;
		this.options = options;
		this.resumeKey = options.resumeKey;

		this.ws = null;
		this.#send = this.wsSend.bind(this);
		this.#open = this.onOpen.bind(this);
		this.#close = this.onClose.bind(this);
		this.#upgrade = this.onUpgrade.bind(this);
		this.#message = this.onMessage.bind(this);
		this.#error = this.onError.bind(this);
	}

	/**
	 * Connects to the server.
	 */
	public connect(): Promise<void> {
		// Create a new ready listener if none was set.
		if (!this.#backoff.listenerCount('ready')) {
			this.#backoff.on('ready', () => this._connect().catch((error) => this.node.emit(ConnectionEvents.Error, error)));
		}

		return this._connect();
	}

	/**
	 * Configures the resuming for this connection.
	 * @param timeout The number of seconds after disconnecting before the session is closed anyways.
	 * This is useful for avoiding accidental leaks.
	 * @param key The key to send when resuming the session. Set to `null` or leave unset to disable resuming.
	 */
	public configureResuming(timeout = 60, key: string | null = null): Promise<void> {
		this.resumeKey = key;

		return this.send({
			op: 'configureResuming',
			key,
			timeout
		});
	}

	/**
	 * Sends a message to the websocket.
	 * @param payload The data to be sent to the websocket.
	 */
	public send(payload: OutgoingPayload): Promise<void> {
		if (!this.ws) return Promise.reject(new Error('The client has not been initialized.'));

		return new Promise((resolve, reject) => {
			const encoded = JSON.stringify(payload);
			const send = { resolve, reject, data: encoded };

			if (this.ws!.readyState === WebSocket.OPEN) this.wsSend(send);
			else this.#queue.push(send);
		});
	}

	/**
	 * Closes the WebSocket connection.
	 * @param code The close code.
	 * @param data The data to be sent.
	 */
	public async close(code?: number, data?: string): Promise<boolean> {
		if (!this.ws) return false;

		this.ws.off(WebSocketEvents.Close, this.#close);

		this.ws!.close(code, data);

		// @ts-expect-error Arguments are passed, TypeScript just does not recognize them.
		this.node.emit(ConnectionEvents.Close, ...(await once(this.ws, WebSocketEvents.Close)));
		this.#backoff.removeAllListeners();
		this.ws!.removeAllListeners();
		this.ws = null;

		return true;
	}

	private async _connect() {
		if (this.ws?.readyState === WebSocket.OPEN) {
			this.ws.close();
			this.ws.removeAllListeners();

			// @ts-expect-error Arguments are passed, TypeScript just does not recognize them.
			this.node.emit(ConnectionEvents.Close, ...(await once(this.ws, WebSocketEvents.Close)));
		}

		const headers: Headers = {
			Authorization: this.node.password,
			'Num-Shards': this.node.shardCount || 1,
			'Client-Name': '@skyra/audio',
			'User-Id': this.node.userID
		};

		if (this.resumeKey) headers['Resume-Key'] = this.resumeKey;

		const ws = new WebSocket(this.url, { headers, ...this.options } as WebSocket.ClientOptions);
		this.ws = ws;
		this._registerWSEventListeners();

		return new Promise<void>((resolve, reject) => {
			// eslint-disable-next-line @typescript-eslint/no-this-alias
			const self = this;

			function onOpen() {
				resolve();
				cleanup();
			}

			function onError(error: Error) {
				self.ws = null;
				reject(error);
				cleanup();
			}

			function onClose(code: number, reason: string) {
				self.ws = null;
				reject(new Error(`Closed connection with code ${code} and reason ${reason}`));
				cleanup();
			}

			function cleanup() {
				ws.off(WebSocketEvents.Open, onOpen);
				ws.off(WebSocketEvents.Error, onError);
				ws.off(WebSocketEvents.Close, onClose);
			}

			ws.on(WebSocketEvents.Open, onOpen);
			ws.on(WebSocketEvents.Error, onError);
			ws.on(WebSocketEvents.Close, onClose);
		});
	}

	private _reconnect() {
		if (!this.ws || this.ws.readyState === WebSocket.CLOSED) this.#backoff.backoff();
	}

	private _registerWSEventListeners() {
		if (!this.ws!.listeners(WebSocketEvents.Open).includes(this.#open)) this.ws!.on(WebSocketEvents.Open, this.#open);
		if (!this.ws!.listeners(WebSocketEvents.Close).includes(this.#close)) this.ws!.on(WebSocketEvents.Close, this.#close);
		if (!this.ws!.listeners(WebSocketEvents.Upgrade).includes(this.#upgrade)) this.ws!.on(WebSocketEvents.Upgrade, this.#upgrade);
		if (!this.ws!.listeners(WebSocketEvents.Message).includes(this.#message)) this.ws!.on(WebSocketEvents.Message, this.#message);
		if (!this.ws!.listeners(WebSocketEvents.Error).includes(this.#error)) this.ws!.on(WebSocketEvents.Error, this.#error);
	}

	private async _flush() {
		await Promise.all(this.#queue.map(this.#send));
		this.#queue = [];
	}

	private wsSend({ resolve, reject, data }: Sendable) {
		this.ws!.send(data, (err) => {
			if (err) reject(err);
			else resolve();
		});
	}

	private onOpen(): void {
		this.#backoff.reset();
		this.node.emit(ConnectionEvents.Open);
		this._flush()
			.then(() => this.configureResuming(this.options.resumeTimeout, this.options.resumeKey))
			.catch((e) => this.node.emit(ConnectionEvents.Error, e));
	}

	private onClose(code: number, reason: string): void {
		this.node.emit(ConnectionEvents.Close, code, reason);
		this._reconnect();
	}

	private onUpgrade(req: IncomingMessage) {
		this.node.emit(ConnectionEvents.Upgrade, req);
	}

	private onMessage(d: WebSocket.Data): void {
		if (Array.isArray(d)) d = Buffer.concat(d);
		else if (d instanceof ArrayBuffer) d = Buffer.from(d);

		let pk: IncomingPayload;
		try {
			pk = JSON.parse((d as string | Buffer).toString());
		} catch (e) {
			this.node.emit(ConnectionEvents.Error, e);
			return;
		}

		if ('guildId' in pk) this.node.players.get(pk.guildId)?.emit(pk.op, pk);

		// @ts-expect-error `pk` is an union of types, emit expects only one of them at at time.
		this.node.emit(pk.op, pk);
	}

	private onError(err: any): void {
		this.node.emit(ConnectionEvents.Error, err);
		this._reconnect();
	}
}
