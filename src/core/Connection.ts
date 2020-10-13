import { Backoff, exponential } from 'backoff';
import type { IncomingMessage } from 'http';
import WebSocket from 'ws';
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

	public ws!: WebSocket;
	public reconnectTimeout = 100; // TODO: remove in next major version

	private _backoff!: Backoff;
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

		this.backoff = exponential();
		this._send = this.wsSend.bind(this);
		this._open = this.onOpen.bind(this);
		this._close = this.onClose.bind(this);
		this._upgrade = this.onUpgrade.bind(this);
		this._message = this.onMessage.bind(this);
		this._error = this.onError.bind(this);
	}

	public get backoff(): Backoff {
		return this._backoff;
	}

	public set backoff(b: Backoff) {
		// Remove current backoff in case we assign the current one again.
		if (this._backoff) this._backoff.removeAllListeners();

		b.on('ready', (_number, delay) => {
			this.reconnectTimeout = delay;
			this.connect();
		});
		b.on('backoff', (_number, delay) => (this.reconnectTimeout = delay));

		this._backoff = b;
	}

	public connect() {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.close();

		const headers: Headers = {
			Authorization: this.node.password,
			'Num-Shards': this.node.shardCount || 1,
			'User-Id': this.node.userID
		};

		if (this.resumeKey) headers['Resume-Key'] = this.resumeKey;
		this.ws = new WebSocket(this.url, { headers, ...this.options } as WebSocket.ClientOptions);
		this._registerWSEventListeners();
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
		return new Promise((resolve, reject) => {
			const encoded = JSON.stringify(d);
			const send = { resolve, reject, data: encoded };

			if (this.ws.readyState === WebSocket.OPEN) this.wsSend(send);
			else this._queue.push(send);
		});
	}

	public close(code?: number, data?: string): Promise<void> {
		if (!this.ws) return Promise.resolve();

		this.ws.removeListener('close', this._close);
		return new Promise((resolve) => {
			this.ws.once('close', (code: number, reason: string) => {
				this.node.emit('close', code, reason);
				resolve();
			});

			this.ws.close(code, data);
		});
	}

	private _reconnect() {
		if (this.ws.readyState === WebSocket.CLOSED) this.backoff.backoff();
	}

	private _registerWSEventListeners() {
		if (!this.ws.listeners('open').includes(this._open)) this.ws.on('open', this._open);
		if (!this.ws.listeners('close').includes(this._close)) this.ws.on('close', this._close);
		if (!this.ws.listeners('upgrade').includes(this._upgrade)) this.ws.on('upgrade', this._upgrade);
		if (!this.ws.listeners('message').includes(this._message)) this.ws.on('message', this._message);
		if (!this.ws.listeners('error').includes(this._error)) this.ws.on('error', this._error);
	}

	private async _flush() {
		await Promise.all(this._queue.map(this._send));
		this._queue = [];
	}

	private wsSend({ resolve, reject, data }: Sendable) {
		this.ws.send(data, (err) => {
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
