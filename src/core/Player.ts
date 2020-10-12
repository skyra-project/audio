import type { GatewayVoiceStateUpdate } from 'discord-api-types/v6';
import { EventEmitter } from 'events';
import type { BaseNode, VoiceServerUpdate, VoiceStateUpdate } from '../base/BaseNode';
import type { SendOpcode } from '../types/SendPayloads';
import type { Track } from './Http';

export enum Status {
	INSTANTIATED,
	PLAYING,
	PAUSED,
	ENDED,
	ERRORED,
	STUCK,
	UNKNOWN
}

export enum EventType {
	TRACK_START = 'TrackStartEvent',
	TRACK_END = 'TrackEndEvent',
	TRACK_EXCEPTION = 'TrackExceptionEvent',
	TRACK_STUCK = 'TrackStuckEvent',
	WEBSOCKET_CLOSED = 'WebSocketClosedEvent'
}

export interface PlayerOptions {
	start?: number;
	end?: number;
	noReplace?: boolean;
}

export interface EqualizerBand {
	band: number;
	gain: number;
}

export interface JoinOptions {
	mute?: boolean;
	deaf?: boolean;
}

export class Player<T extends BaseNode = BaseNode> extends EventEmitter {
	public readonly node: T;
	public guildID: string;
	public status: Status = Status.INSTANTIATED;

	public constructor(node: T, guildID: string) {
		super();
		this.node = node;
		this.guildID = guildID;

		this.on('event', (d) => {
			switch (d.type) {
				case EventType.TRACK_START:
					this.status = Status.PLAYING;
					break;
				case EventType.TRACK_END:
					if (d.reason !== 'REPLACED') this.status = Status.ENDED;
					break;
				case EventType.TRACK_EXCEPTION:
					this.status = Status.ERRORED;
					break;
				case EventType.TRACK_STUCK:
					this.status = Status.STUCK;
					break;
				case EventType.WEBSOCKET_CLOSED:
					this.status = Status.ENDED;
					break;
				default:
					this.status = Status.UNKNOWN;
					break;
			}
		});
	}

	public get playing(): boolean {
		return this.status === Status.PLAYING;
	}

	public get paused(): boolean {
		return this.status === Status.PAUSED;
	}

	public get voiceState(): VoiceStateUpdate | undefined {
		const session = this.node.voiceStates.get(this.guildID);
		if (!session) return;

		return {
			guild_id: this.guildID,
			user_id: this.node.userID,
			session_id: session
		};
	}

	public get voiceServer(): VoiceServerUpdate | undefined {
		return this.node.voiceServers.get(this.guildID);
	}

	public async moveTo(node: BaseNode) {
		if (this.node === node) return;
		if (!this.voiceServer || !this.voiceState) throw new Error('no voice state/server data to move');

		await this.destroy();
		await Promise.all([node.voiceStateUpdate(this.voiceState), node.voiceServerUpdate(this.voiceServer)]);
	}

	public leave() {
		return this.join(null);
	}

	public join(channel: string | null, { deaf = false, mute = false }: JoinOptions = {}) {
		this.node.voiceServers.delete(this.guildID);
		this.node.voiceStates.delete(this.guildID);

		const data: GatewayVoiceStateUpdate = {
			op: 4,
			d: {
				guild_id: this.guildID,
				channel_id: channel,
				self_deaf: deaf,
				self_mute: mute
			}
		};

		return this.node.send(this.guildID, data);
	}

	public async play(track: string | Track, { start = 0, end = 0, noReplace = false }: PlayerOptions = {}) {
		await this.send({
			op: 'play',
			guildId: this.guildID,
			track: typeof track === 'object' ? track.track : track,
			startTime: start,
			endTime: end,
			noReplace
		});

		this.status = Status.PLAYING;
	}

	public setVolume(volume: number) {
		return this.send({
			op: 'volume',
			guildId: this.guildID,
			volume
		});
	}

	public setEqualizer(bands: EqualizerBand[]) {
		return this.send({
			op: 'equalizer',
			guildId: this.guildID,
			bands
		});
	}

	public seek(position: number) {
		return this.send({
			op: 'seek',
			guildId: this.guildID,
			position
		});
	}

	public async pause(pause = true) {
		await this.send({
			op: 'pause',
			guildId: this.guildID,
			pause
		});

		if (pause) this.status = Status.PAUSED;
		else this.status = Status.PLAYING;
	}

	public async stop() {
		await this.send({
			op: 'stop',
			guildId: this.guildID
		});

		this.status = Status.ENDED;
	}

	public async destroy() {
		if (this.node.connected) {
			await this.send({
				op: 'destroy',
				guildId: this.guildID
			});
		}
		this.status = Status.ENDED;
		this.node.players.delete(this.guildID);
	}

	public voiceUpdate(sessionId: string, event: VoiceServerUpdate) {
		return this.send({
			op: 'voiceUpdate',
			guildId: this.guildID,
			event: {
				endpoint: event.endpoint,
				guildId: event.guild_id,
				token: event.token
			},
			sessionId
		});
	}

	public send(data: SendOpcode) {
		const conn = this.node.connection;
		if (conn) return conn.send(data);
		return Promise.reject(new Error('no WebSocket connection available'));
	}
}
