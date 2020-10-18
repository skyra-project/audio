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
	/**
	 * The guild's ID to identify the player.
	 */
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

	/**
	 * The offset in milliseconds to play the current track from.
	 */
	position: number;
}

export interface OutgoingPausePayload extends BaseOutgoingPayload {
	op: 'pause';

	/**
	 * Whether or not the player should be paused.
	 */
	pause: boolean;
}

export interface OutgoingPlayPayload extends BaseOutgoingPayload {
	op: 'play';

	/**
	 * The track to be played.
	 */
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

	/**
	 * The voice channel's session ID.
	 */
	sessionId: string;

	/**
	 * The raw event data from Discord.
	 */
	event: VoiceServerUpdate;
}

export interface OutgoingVolumePayload extends BaseOutgoingPayload {
	op: 'volume';

	/**
	 * The volume to be set.
	 * @default 100
	 * @range [0, 1000]
	 */
	volume: number;
}

export interface OutgoingEqualizerPayload extends BaseOutgoingPayload {
	op: 'equalizer';

	/**
	 * The bands to be set.
	 */
	bands: readonly {
		/**
		 * The band to be changed, ranges from 0 to 14 inclusive.
		 * @range [0, 14]
		 */
		band: number;

		/**
		 * The multiplier of the band. Valid values range from -0.25 to 1.0, where -0.25 means the given band is
		 * completely muted, and 0.25 means it is doubled. Modifying the gain could also change the volume of the output.
		 * @default 0
		 * @range [-0.25, -1]
		 */
		gain: number;
	}[];
}

export interface OutgoingConfigureResumingPayload {
	op: 'configureResuming';

	/**
	 * The string you will need to send when resuming the session. Set to null to disable resuming altogether.
	 */
	key?: string | null;

	/**
	 * The number of seconds after disconnecting before the session is closed anyways.
	 * This is useful for avoiding accidental leaks.
	 */
	timeout?: number;
}
