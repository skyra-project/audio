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
	'Resume-Key'?: string;
}

export interface Options extends WebSocket.ClientOptions {
	resumeKey?: string;
	resumeTimeout?: number;
}

export class Connection<T extends BaseNode = BaseNode> {
	public readonly node: T;
	public url: string;
	public options: Options;
	public resumeKey?: string;

	public ws: WebSocket | null;

	private backoff: Backoff = exponential();
	private _queue: Array<Sendable> = [];

	private _send: Connection<T>['wsSend'];
	private _open: Connection<T>['onOpen'];
	private _close: Connection<T>['onClose'];
	private _upgrade: Connection<T>['onUpgrade'];
	private _message: Connection<T>['onMessage'];
	private _error: Connection<T>['onError'];

	public constructor(node: T, url: string, options: Options = {}) {
		this.node = node;
		this.url = url;
		this.options = options;
		this.resumeKey = options.resumeKey;

		this.ws = null;
		this._send = this.wsSend.bind(this);
		this._open = this.onOpen.bind(this);
		this._close = this.onClose.bind(this);
		this._upgrade = this.onUpgrade.bind(this);
		this._message = this.onMessage.bind(this);
		this._error = this.onError.bind(this);
	}

	/**
	 * Connects to the server.
	 */
	public connect(): Promise<void> {
		// Create a new ready listener if none was set.
		if (!this.backoff.listenerCount('ready')) {
			return new Promise((resolve, reject) => {
				this.backoff.on('ready', () => this._connect().then(resolve, reject));
			});
		}

		return this._connect();
	}

	public configureResuming(timeout = 60, key: string = Math.random().toString(36)): Promise<void> {
		this.resumeKey = key;

		return this.send({
			op: 'configureResuming',
			key,
			timeout
		});
	}

	public send(d: OutgoingPayload): Promise<void> {
		if (!this.ws) return Promise.reject(new Error('The client has not been initialized.'));

		return new Promise((resolve, reject) => {
			const encoded = JSON.stringify(d);
			const send = { resolve, reject, data: encoded };

			if (this.ws!.readyState === WebSocket.OPEN) this.wsSend(send);
			else this._queue.push(send);
		});
	}

	public async close(code?: number, data?: string): Promise<boolean> {
		if (!this.ws) return false;

		this.ws.removeListener('close', this._close);

		this.ws!.close(code, data);

		this.node.emit('close', ...(await once(this.ws, 'close')));
		this.backoff.removeAllListeners();
		this.ws!.removeAllListeners();
		this.ws = null;

		return true;
	}

	private async _connect() {
		if (this.ws?.readyState === WebSocket.OPEN) {
			this.ws.close();
			this.ws.removeAllListeners();
			this.node.emit('close', ...(await once(this.ws, 'close')));
		}

		const headers: Headers = {
			Authorization: this.node.password,
			'Num-Shards': this.node.shardCount || 1,
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
				ws.off('open', onOpen);
				ws.off('error', onError);
				ws.off('close', onClose);
			}

			ws.on('open', onOpen);
			ws.on('error', onError);
			ws.on('close', onClose);
		});
	}

	private _reconnect() {
		if (this.ws!.readyState === WebSocket.CLOSED) this.backoff.backoff();
	}

	private _registerWSEventListeners() {
		if (!this.ws!.listeners('open').includes(this._open)) this.ws!.on('open', this._open);
		if (!this.ws!.listeners('close').includes(this._close)) this.ws!.on('close', this._close);
		if (!this.ws!.listeners('upgrade').includes(this._upgrade)) this.ws!.on('upgrade', this._upgrade);
		if (!this.ws!.listeners('message').includes(this._message)) this.ws!.on('message', this._message);
		if (!this.ws!.listeners('error').includes(this._error)) this.ws!.on('error', this._error);
	}

	private async _flush() {
		await Promise.all(this._queue.map(this._send));
		this._queue = [];
	}

	private wsSend({ resolve, reject, data }: Sendable) {
		this.ws!.send(data, (err) => {
			if (err) reject(err);
			else resolve();
		});
	}

	private onOpen(): void {
		this.backoff.reset();
		this.node.emit('open');
		this._flush()
			.then(() => this.configureResuming(this.options.resumeTimeout, this.options.resumeKey))
			.catch((e) => this.node.emit('error', e));
	}

	private onClose(code: number, reason: string): void {
		this.node.emit('close', code, reason);
		this._reconnect();
	}

	private onUpgrade(req: IncomingMessage) {
		this.node.emit('upgrade', req);
	}

	private onMessage(d: WebSocket.Data): void {
		if (Array.isArray(d)) d = Buffer.concat(d);
		else if (d instanceof ArrayBuffer) d = Buffer.from(d);

		let pk: IncomingPayload;
		try {
			pk = JSON.parse((d as string | Buffer).toString());
		} catch (e) {
			this.node.emit('error', e);
			return;
		}

		if ('guildId' in pk) this.node.players.get(pk.guildId)?.emit(pk.op, pk);
		this.node.emit(pk.op, pk);
	}

	private onError(err: any): void {
		this.node.emit('error', err);
		this._reconnect();
	}
}
