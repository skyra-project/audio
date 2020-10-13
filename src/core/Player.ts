import type { GatewayVoiceStateUpdate } from 'discord-api-types/v6';
import { EventEmitter } from 'events';
import type { BaseNode, VoiceServerUpdate, VoiceStateUpdate } from '../base/BaseNode';
import type { IncomingEventPayload } from '../types/IncomingPayloads';
import type { OutgoingPayload } from '../types/OutgoingPayloads';
import type { Track } from './Http';

export const enum Status {
	Instantiated,
	Playing,
	Paused,
	Ended,
	Errored,
	Stuck,
	Unknown
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
	public status: Status = Status.Instantiated;

	public constructor(node: T, guildID: string) {
		super();
		this.node = node;
		this.guildID = guildID;

		this.on('event', (d: IncomingEventPayload) => {
			switch (d.type) {
				case 'TrackStartEvent':
					this.status = Status.Playing;
					break;
				case 'TrackEndEvent':
					if (d.reason !== 'REPLACED') this.status = Status.Ended;
					break;
				case 'TrackExceptionEvent':
					this.status = Status.Errored;
					break;
				case 'TrackStuckEvent':
					this.status = Status.Stuck;
					break;
				case 'WebSocketClosedEvent':
					this.status = Status.Ended;
					break;
				default:
					this.status = Status.Unknown;
					break;
			}
		});
	}

	public get playing(): boolean {
		return this.status === Status.Playing;
	}

	public get paused(): boolean {
		return this.status === Status.Paused;
	}

	public get voiceState(): VoiceStateUpdate | null {
		const session = this.node.voiceStates.get(this.guildID);
		if (!session) return null;

		return {
			...session,
			guild_id: this.guildID,
			user_id: this.node.userID
		};
	}

	public get voiceServer(): VoiceServerUpdate | null {
		return this.node.voiceServers.get(this.guildID) ?? null;
	}

	public async moveTo(node: BaseNode) {
		if (this.node === node) return;

		const { voiceState, voiceServer } = this;
		if (voiceServer === null || voiceState === null) throw new Error('no voice state/server data to move');

		await this.destroy();
		await Promise.all([node.voiceStateUpdate(voiceState), node.voiceServerUpdate(voiceServer)]);
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

		this.status = Status.Playing;
	}

	public setVolume(volume: number) {
		return this.send({
			op: 'volume',
			guildId: this.guildID,
			volume
		});
	}

	public setEqualizer(bands: readonly EqualizerBand[]) {
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

		if (pause) this.status = Status.Paused;
		else this.status = Status.Playing;
	}

	public async stop() {
		await this.send({
			op: 'stop',
			guildId: this.guildID
		});

		this.status = Status.Ended;
	}

	public async destroy() {
		if (this.node.connected) {
			await this.send({
				op: 'destroy',
				guildId: this.guildID
			});
		}
		this.status = Status.Ended;
		this.node.players.delete(this.guildID);
	}

	public voiceUpdate(sessionId: string, event: VoiceServerUpdate) {
		return this.send({
			op: 'voiceUpdate',
			guildId: this.guildID,
			event,
			sessionId
		});
	}

	public send(data: OutgoingPayload) {
		const conn = this.node.connection;
		if (conn) return conn.send(data);
		return Promise.reject(new Error('no WebSocket connection available'));
	}
}
