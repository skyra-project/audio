import type { GatewaySendPayload, GatewayVoiceServerUpdateDispatch, GatewayVoiceState } from 'discord-api-types/v6';
import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { Connection, Options as ConnectionOptions } from '../core/Connection';
import { Http, Track, TrackInfo, TrackResponse } from '../core/Http';
import { PlayerStore } from '../core/PlayerStore';

export type VoiceServerUpdate = GatewayVoiceServerUpdateDispatch['d'];
export type VoiceStateUpdate = GatewayVoiceState;

/**
 * The options for the node.
 */
export interface BaseNodeOptions {
	/**
	 * The password to use to login to the Lavalink server.
	 * @example
	 * ```json
	 * "you-shall-not-pass"
	 * ```
	 */
	password: string;

	/**
	 * The client's user ID.
	 * @example
	 * ```json
	 * "266624760782258186"
	 * ```
	 */
	userID: string;

	/**
	 * The total number of shards that your bot is running. (Optional, useful if you are load balancing).
	 * @example
	 * ```json
	 * 0
	 * ```
	 */
	shardCount?: number;

	/**
	 * The host options to use, this is a more advanced alternative to [[BaseNodeOptions.host]].
	 */
	hosts?: {
		/**
		 * The HTTP host of your Lavalink instance.
		 * @example
		 * ```json
		 * "http://localhost"
		 * ```
		 *
		 * @example
		 * ```json
		 * "http://localhost:2333"
		 * ```
		 */
		rest?: string;

		/**
		 * The WS host of your Lavalink instance.
		 * @example
		 * ```json
		 * "ws://localhost"
		 * ```
		 *
		 * @example
		 * ```json
		 * "ws://localhost:2333"
		 * ```
		 */
		ws?: string | { url: string; options: ConnectionOptions };
	};

	/**
	 * A URL to your Lavalink instance without protocol.
	 * @example
	 * ```json
	 * "localhost"
	 * ```
	 *
	 * @example
	 * ```json
	 * "localhost:2333"
	 * ```
	 */
	host?: string;
}

export interface NodeSend {
	(guildID: string, packet: GatewaySendPayload): Promise<any>;
}

export abstract class BaseNode extends EventEmitter {
	public abstract send: NodeSend;

	public password: string;
	public userID: string;
	public shardCount?: number;

	public players: PlayerStore<this>;
	public http: Http | null = null;
	public connection: Connection | null = null;

	public voiceStates: Map<string, VoiceStateUpdate> = new Map();
	public voiceServers: Map<string, VoiceServerUpdate> = new Map();

	private _expectingConnection: Set<string> = new Set();

	public constructor({ password, userID, shardCount, hosts, host }: BaseNodeOptions) {
		super();
		this.password = password;
		this.userID = userID;
		this.shardCount = shardCount;
		this.players = new PlayerStore(this);

		if (host) {
			this.http = new Http(this, `http://${host}`);
			this.connection = new Connection(this, `ws://${host}`);
		} else if (hosts) {
			this.http = hosts.rest ? new Http(this, hosts.rest) : null;
			this.connection = hosts.ws
				? typeof hosts.ws === 'string'
					? new Connection(this, hosts.ws)
					: new Connection(this, hosts.ws.url, hosts.ws.options)
				: null;
		}
	}

	/**
	 * Connects to the server.
	 */
	public connect(): Promise<void> {
		return this.connection!.connect();
	}

	/**
	 * Whether or not the node is connected to the websocket.
	 */
	public get connected(): boolean {
		return this.connection?.ws?.readyState === WebSocket.OPEN;
	}

	/**
	 * Loads a song.
	 * @param identifier The track to be loaded.
	 * @example
	 * ```typescript
	 * // Load from URL:
	 *
	 * const result = await node.load('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
	 * console.log(result);
	 * // {
	 * //   "loadType": "TRACK_LOADED",
	 * //   "playlistInfo": {},
	 * //   "tracks": [
	 * //     {
	 * //       "track": "QAAAjQIAJVJpY2sgQXN0bGV5IC0gTmV2ZXIgR29ubmEgR2l2ZSBZb3UgVXAADlJpY2tBc3RsZXlWRVZPAAAAAAADPCAAC2RRdzR3OVdnWGNRAAEAK2h0dHBzOi8vd3d3LnlvdXR1YmUuY29tL3dhdGNoP3Y9ZFF3NHc5V2dYY1EAB3lvdXR1YmUAAAAAAAAAAA==",
	 * //       "info": {
	 * //         "identifier": "dQw4w9WgXcQ",
	 * //         "isSeekable": true,
	 * //         "author": "RickAstleyVEVO",
	 * //         "length": 212000,
	 * //         "isStream": false,
	 * //         "position": 0,
	 * //         "title": "Rick Astley - Never Gonna Give You Up",
	 * //         "uri": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
	 * //       }
	 * //     }
	 * //   ]
	 * // }
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Load from YouTube search:
	 *
	 * const result = await node.load('ytsearch: Never Gonna Give You Up');
	 * console.log(result);
	 * // {
	 * //   "loadType": "SEARCH_RESULT",
	 * //   "playlistInfo": {},
	 * //   "tracks": [
	 * //     {
	 * //       "track": "...",
	 * //       "info": {
	 * //         "identifier": "dQw4w9WgXcQ",
	 * //         "isSeekable": true,
	 * //         "author": "RickAstleyVEVO",
	 * //         "length": 212000,
	 * //         "isStream": false,
	 * //         "position": 0,
	 * //         "title": "Rick Astley - Never Gonna Give You Up",
	 * //         "uri": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
	 * //       }
	 * //     },
	 * //     ...
	 * //   ]
	 * // }
	 * ```
	 */
	public load(identifier: string): Promise<TrackResponse> {
		if (this.http) return this.http.load(identifier);
		throw new Error('no available http module');
	}

	/**
	 * Decodes a track.
	 * @param track The track to be decoded.
	 * @example
	 * ```typescript
	 * const identifier = 'QAAAjQIAJVJpY2sgQXN0bGV5IC0gTmV2ZXIgR29ubmEgR2l2ZSBZb3UgVXAADlJpY2tBc3RsZXlWRVZPAAAAAAADPCAAC2RRdzR3OVdnWGNRAAEAK2h0dHBzOi8vd3d3LnlvdXR1YmUuY29tL3dhdGNoP3Y9ZFF3NHc5V2dYY1EAB3lvdXR1YmUAAAAAAAAAAA==';
	 *
	 * const track = await http.decode(identifier);
	 * console.log(track);
	 * // Logs: {
	 * //   "identifier": "dQw4w9WgXcQ",
	 * //   "isSeekable": true,
	 * //   "author": "RickAstleyVEVO",
	 * //   "length": 212000,
	 * //   "isStream": false,
	 * //   "position": 0,
	 * //   "title": "Rick Astley - Never Gonna Give You Up",
	 * //   "uri": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
	 * // }
	 * ```
	 */
	public decode(track: string): Promise<TrackInfo>;

	/**
	 * Decodes multiple tracks.
	 * @note This returns an array of [[Track]]s, not a [[TrackInfo]].
	 * @param tracks The tracks to be decoded.
	 */
	public decode(tracks: string[]): Promise<Track[]>;
	public decode(tracks: string | string[]): Promise<TrackInfo | Track[]> {
		if (this.http) return this.http.decode(tracks);
		throw new Error('no available http module');
	}

	public voiceStateUpdate(packet: VoiceStateUpdate): Promise<boolean> {
		if (packet.user_id !== this.userID) return Promise.resolve(false);

		if (packet.channel_id) {
			this.voiceStates.set(packet.guild_id!, packet);
			return this._tryConnection(packet.guild_id!);
		}

		this.voiceServers.delete(packet.guild_id!);
		this.voiceStates.delete(packet.guild_id!);

		return Promise.resolve(false);
	}

	public voiceServerUpdate(packet: VoiceServerUpdate): Promise<boolean> {
		this.voiceServers.set(packet.guild_id!, packet);
		this._expectingConnection.add(packet.guild_id!);
		return this._tryConnection(packet.guild_id!);
	}

	public disconnect(code?: number, data?: string): Promise<boolean> {
		if (this.connection) return this.connection.close(code, data);
		return Promise.resolve(false);
	}

	public async destroy(code?: number, data?: string): Promise<void> {
		await Promise.all([...this.players.values()].map((player) => player.destroy()));
		await this.disconnect(code, data);
	}

	private async _tryConnection(guildID: string): Promise<boolean> {
		const state = this.voiceStates.get(guildID);
		const server = this.voiceServers.get(guildID);
		if (!state || !server || !this._expectingConnection.has(guildID)) return false;

		await this.players.get(guildID).voiceUpdate(state.session_id, server);
		this._expectingConnection.delete(guildID);
		return true;
	}
}
