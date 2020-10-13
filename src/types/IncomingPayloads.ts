export type IncomingPayload = IncomingPlayerUpdatePayload | IncomingStatsPayload | IncomingEventPayload;

export interface IncomingPlayerUpdatePayload {
	op: 'playerUpdate';
	guildId: string;
	state: {
		time: number;
		position: number;
	};
}

export interface IncomingStatsPayload {
	op: 'stats';
	players: number;
	playingPlayers: number;
	uptime: number;
	memory: {
		free: number;
		used: number;
		allocated: number;
		reservable: number;
	};
	cpu: {
		cores: number;
		systemLoad: number;
		lavalinkLoad: number;
	};
	frames?: {
		sent: number;
		nulled: number;
		deficit: number;
	};
}

interface IIncomingEvent {
	op: 'event';
	guildId: string;
}

export type IncomingEventPayload =
	| IncomingEventStartPayload
	| IncomingEventTrackEndPayload
	| IncomingEventTrackExceptionPayload
	| IncomingEventTrackStuckPayload
	| IncomingEventWebSocketClosedPayload;

export interface IncomingEventStartPayload extends IIncomingEvent {
	type: 'TrackStartEvent';
	track: string;
}

export interface IncomingEventTrackEndPayload extends IIncomingEvent {
	type: 'TrackEndEvent';
	track: string;
	reason: string;
}

export type IncomingEventTrackExceptionPayload = IncomingEventTrackExceptionDetailed | IncomingEventTrackExceptionErrorPayload;

interface IIncomingEventTrackException extends IIncomingEvent {
	type: 'TrackExceptionEvent';
	track: string;
}

export interface IncomingEventTrackExceptionDetailed extends IIncomingEventTrackException {
	exception: {
		message: string;
		severity: IncomingEventTrackExceptionDetailedExceptionSeverity;
		cause: string;
	};
}

export const enum IncomingEventTrackExceptionDetailedExceptionSeverity {
	/**
	 * The cause is known and expected, indicates that there is nothing wrong with the library itself.
	 */
	Common = 'COMMON',

	/**
	 * The cause might not be exactly known, but is possibly caused by outside factors. For example when an outside
	 * service responds in a format that we do not expect.
	 */
	Suspicious = 'SUSPICIOUS',

	/**
	 * If the probable cause is an issue with the library or when there is no way to tell what the cause might be.
	 * This is the default level and other levels are used in cases where the thrower has more in-depth knowledge
	 * about the error.
	 */
	Fault = 'FAULT'
}

export interface IncomingEventTrackExceptionErrorPayload extends IIncomingEventTrackException {
	error: string;
}

export interface IncomingEventTrackStuckPayload extends IIncomingEvent {
	type: 'TrackStuckEvent';
	track: string;
	thresholdMs: number;
}

export interface IncomingEventWebSocketClosedPayload extends IIncomingEvent {
	type: 'WebSocketClosedEvent';
	code: number;
	reason: string;
	byRemote: boolean;
}
