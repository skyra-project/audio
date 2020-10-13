import WebSocket from 'ws';
import type { GatewaySendPayload, GatewayVoiceState, GatewayVoiceServerUpdateDispatch } from 'discord-api-types/v6';
import { EventEmitter } from 'events';
import { Connection, Options as ConnectionOptions } from '../core/Connection';
import { Http, Track, TrackInfo, TrackResponse } from '../core/Http';
import { PlayerStore } from '../core/PlayerStore';

export type VoiceServerUpdate = GatewayVoiceServerUpdateDispatch['d'];
export type VoiceStateUpdate = GatewayVoiceState;

export interface BaseNodeOptions {
	password: string;
	userID: string;
	shardCount?: number;
	hosts?: {
		rest?: string;
		ws?: string | { url: string; options: ConnectionOptions };
	};
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

	public connection?: Connection;
	public players: PlayerStore<this>;
	public http?: Http;

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
			if (hosts.rest) this.http = new Http(this, hosts.rest);
			if (hosts.ws)
				this.connection =
					typeof hosts.ws === 'string' ? new Connection(this, hosts.ws) : new Connection(this, hosts.ws.url, hosts.ws.options);
		}
	}

	public get connected(): boolean {
		if (!this.connection) return false;
		return this.connection.ws.readyState === WebSocket.OPEN;
	}

	public load(identifier: string): Promise<TrackResponse> {
		if (this.http) return this.http.load(identifier);
		throw new Error('no available http module');
	}

	public decode(track: string): Promise<TrackInfo>;
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

	public disconnect(code?: number, data?: string): Promise<void> {
		if (this.connection) return this.connection.close(code, data);
		return Promise.resolve();
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
