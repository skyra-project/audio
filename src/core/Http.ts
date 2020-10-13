import { IncomingHttpHeaders, IncomingMessage, request, STATUS_CODES } from 'http';
import { URL } from 'url';
import type { BaseNode } from '../base/BaseNode';
import { RoutePlanner } from './RoutePlanner';

export class HTTPError extends Error {
	public method: string;
	public statusCode: number;
	public headers: IncomingHttpHeaders;
	public path: string;

	public constructor(httpMessage: IncomingMessage, method: string, url: URL) {
		super(`${httpMessage.statusCode} ${STATUS_CODES[httpMessage.statusCode as number]}`);
		this.statusCode = httpMessage.statusCode as number;
		this.headers = httpMessage.headers;
		this.name = this.constructor.name;
		this.path = url.toString();
		this.method = method;
	}

	public get statusMessage() {
		return STATUS_CODES[this.statusCode];
	}
}

export enum LoadType {
	TRACK_LOADED = 'TRACK_LOADED',
	PLAYLIST_LOADED = 'PLAYLIST_LOADED',
	SEARCH_RESULT = 'SEARCH_RESULT',
	NO_MATCHES = 'NO_MATCHES',
	LOAD_FAILED = 'LOAD_FAILED'
}

export interface TrackResponse {
	loadType: LoadType;
	playlistInfo: PlaylistInfo;
	tracks: Track[];
}

export interface PlaylistInfo {
	name?: string;
	selectedTrack?: number;
}

export interface TrackInfo {
	identifier: string;
	isSeekable: boolean;
	author: string;
	length: number;
	isStream: boolean;
	position: number;
	title: string;
	uri: string;
}

export interface Track {
	track: string;
	info: TrackInfo;
}

export class Http {
	public readonly node: BaseNode;
	public input: string;
	public base: string | undefined;
	public routeplanner: RoutePlanner;

	public constructor(node: BaseNode, input: string, base?: string) {
		this.node = node;
		this.input = input;
		this.base = base;
		this.routeplanner = new RoutePlanner(this);
	}

	public get url() {
		return new URL(this.input, this.base);
	}

	public load(identifier: string): Promise<TrackResponse> {
		const { url } = this;
		url.pathname = '/loadtracks';
		url.searchParams.append('identifier', identifier);

		return this.do('GET', url);
	}

	public decode(track: string): Promise<TrackInfo>;
	public decode(tracks: string[]): Promise<Track[]>;
	public decode(tracks: string | string[]): Promise<TrackInfo | Track[]>;
	public decode(tracks: string | string[]): Promise<TrackInfo | Track[]> {
		const { url } = this;
		if (Array.isArray(tracks)) {
			url.pathname = '/decodetracks';
			return this.do('POST', url, Buffer.from(JSON.stringify(tracks)));
		}
		url.pathname = '/decodetrack';
		url.searchParams.append('track', tracks);
		return this.do('GET', url);
	}

	public async do<T = any>(method: string, url: URL, data?: Buffer): Promise<T> {
		const message = await new Promise<IncomingMessage>((resolve) => {
			const req = request(
				{
					method,
					hostname: url.hostname,
					port: url.port,
					protocol: url.protocol,
					path: url.pathname + url.search,
					headers: {
						Authorization: this.node.password,
						'Content-Type': 'application/json',
						Accept: 'application/json'
					}
				},
				resolve
			);

			if (data) req.write(data);
			req.end();
		});

		if (message.statusCode && message.statusCode >= 200 && message.statusCode < 300) {
			const chunks: Array<Buffer> = [];
			for await (const chunk of message) {
				chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
			}

			const data = Buffer.concat(chunks);
			return JSON.parse(data.toString());
		}

		throw new HTTPError(message, method, url);
	}
}
