import type { GatewayVoiceStateUpdate } from 'discord-api-types/v6';
import { EventEmitter } from 'events';
import type { BaseNode, VoiceServerUpdate, VoiceStateUpdate } from '../base/BaseNode';
import type { IncomingEventPayload, IncomingPlayerUpdatePayload } from '../types/IncomingPayloads';
import type { EqualizerBand, OutgoingFilterPayload, OutgoingPayload } from '../types/OutgoingPayloads';
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
	pause?: boolean;
}

export interface FilterOptions extends Omit<OutgoingFilterPayload, 'op' | 'guildId'> {}

export interface JoinOptions {
	mute?: boolean;
	deaf?: boolean;
}

export interface LastPosition {
	position: number;
	time: number;
}

export class Player<T extends BaseNode = BaseNode> extends EventEmitter {
	public readonly node: T;
	public guildID: string;
	public status: Status = Status.Instantiated;
	private lastPosition: LastPosition | null = null;

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

		this.on('playerUpdate', (d: IncomingPlayerUpdatePayload) => {
			this.lastPosition = d.state;
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

	public get position(): number {
		return this.lastPosition ? this.lastPosition.position + (Date.now() - this.lastPosition.time) : 0;
	}

	public async moveTo(node: BaseNode): Promise<void> {
		if (this.node === node) return;

		const { voiceState, voiceServer } = this;
		if (voiceServer === null || voiceState === null) throw new Error('no voice state/server data to move');

		await this.destroy();
		await Promise.all([node.voiceStateUpdate(voiceState), node.voiceServerUpdate(voiceServer)]);
	}

	public leave(): Promise<void> {
		return this.join(null);
	}

	public join(channel: string | null, { deaf = false, mute = false }: JoinOptions = {}): Promise<void> {
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

	public async play(track: string | Track, { start, end, noReplace, pause }: PlayerOptions = {}): Promise<void> {
		await this.send({
			op: 'play',
			guildId: this.guildID,
			track: typeof track === 'object' ? track.track : track,
			startTime: start,
			endTime: end,
			noReplace,
			pause
		});

		if (pause) this.status = Status.Paused;
		else this.status = Status.Playing;
	}

	/**
	 * Sets the filters for the player.
	 * @note This is not available in Lavalink v3.3.
	 * @param options The filters to be sent.
	 */
	public setFilters(options: FilterOptions): Promise<void> {
		return this.send({
			op: 'filters',
			guildId: this.guildID,
			...options
		});
	}

	/**
	 * @param volume The new volume to be set.
	 */
	public setVolume(volume: number): Promise<void> {
		return this.send({
			op: 'volume',
			guildId: this.guildID,
			volume
		});
	}

	/**
	 * @param equalizer The equalizer bads to be set.
	 */
	public setEqualizer(equalizer: readonly EqualizerBand[]): Promise<void> {
		return this.send({
			op: 'equalizer',
			guildId: this.guildID,
			bands: equalizer
		});
	}

	public seek(position: number): Promise<void> {
		return this.send({
			op: 'seek',
			guildId: this.guildID,
			position
		});
	}

	public async pause(pause = true): Promise<void> {
		await this.send({
			op: 'pause',
			guildId: this.guildID,
			pause
		});

		if (pause) this.status = Status.Paused;
		else this.status = Status.Playing;
	}

	public async stop(): Promise<void> {
		await this.send({
			op: 'stop',
			guildId: this.guildID
		});

		this.status = Status.Ended;
	}

	public async destroy(): Promise<void> {
		if (this.node.connected) {
			await this.send({
				op: 'destroy',
				guildId: this.guildID
			});
		}
		this.status = Status.Ended;
		this.node.players.delete(this.guildID);
	}

	public voiceUpdate(sessionId: string, event: VoiceServerUpdate): Promise<void> {
		return this.send({
			op: 'voiceUpdate',
			guildId: this.guildID,
			event,
			sessionId
		});
	}

	public send(data: OutgoingPayload): Promise<void> {
		const conn = this.node.connection;
		if (conn) return conn.send(data);
		return Promise.reject(new Error('no WebSocket connection available'));
	}
}
