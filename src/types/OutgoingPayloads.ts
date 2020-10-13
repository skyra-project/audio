import type { VoiceServerUpdate } from '../base/BaseNode';

export type OutgoingPayload =
	| OutgoingDestroyPayload
	| OutgoingEqualizerPayload
	| OutgoingPausePayload
	| OutgoingPlayPayload
	| OutgoingSeekPayload
	| OutgoingStopPayload
	| OutgoingVoiceUpdatePayload
	| OutgoingVolumePayload
	| OutgoingConfigureResumingPayload;

export interface BaseOutgoingPayload {
	guildId: string;
}

export interface OutgoingDestroyPayload extends BaseOutgoingPayload {
	op: 'destroy';
}

export interface OutgoingStopPayload extends BaseOutgoingPayload {
	op: 'stop';
}

export interface OutgoingSeekPayload extends BaseOutgoingPayload {
	op: 'seek';
	position: number;
}

export interface OutgoingPausePayload extends BaseOutgoingPayload {
	op: 'pause';
	pause: boolean;
}

export interface OutgoingPlayPayload extends BaseOutgoingPayload {
	op: 'play';
	track: string;

	/**
	 * If set to true, this operation will be ignored if a track is already playing or paused.
	 */
	noReplace: boolean;

	/**
	 * Determines the number of milliseconds to offset the track by. Defaults to 0.
	 */
	startTime: number;

	/**
	 * Determines at the number of milliseconds at which point the track should stop playing. Helpful if you only want
	 * to play a snippet of a bigger track. By default the track plays until it's end as per the encoded data.
	 */
	endTime?: number;
}

export interface OutgoingVoiceUpdatePayload extends BaseOutgoingPayload {
	op: 'voiceUpdate';
	sessionId: string;
	event: VoiceServerUpdate;
}

export interface OutgoingVolumePayload extends BaseOutgoingPayload {
	op: 'volume';
	volume: number;
}

export interface OutgoingEqualizerPayload extends BaseOutgoingPayload {
	op: 'equalizer';
	bands: readonly {
		band: number;
		gain: number;
	}[];
}

export interface OutgoingConfigureResumingPayload {
	op: 'configureResuming';

	/**
	 * The string you will need to send when resuming the session. Set to null to disable resuming altogether.
	 */
	key: string;

	/**
	 * The number of seconds after disconnecting before the session is closed anyways.
	 * This is useful for avoiding accidental leaks.
	 */
	timeout: number;
}
