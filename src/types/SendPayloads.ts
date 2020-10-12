export type SendOpcode =
	| SendOpcodeDestroy
	| SendOpcodeEqualizer
	| SendOpcodePause
	| SendOpcodePlay
	| SendOpcodeSeek
	| SendOpcodeStop
	| SendOpcodeVoiceUpdate
	| SendOpcodeVolume;

export interface BaseSendOpcode {
	guildId: string;
}

export interface SendOpcodeDestroy extends BaseSendOpcode {
	op: 'destroy';
}

export interface SendOpcodeStop extends BaseSendOpcode {
	op: 'stop';
}

export interface SendOpcodeSeek extends BaseSendOpcode {
	op: 'seek';
	position: number;
}

export interface SendOpcodePause extends BaseSendOpcode {
	op: 'pause';
	pause: boolean;
}

export interface SendOpcodePlay extends BaseSendOpcode {
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

export interface SendOpcodeVoiceUpdate extends BaseSendOpcode {
	op: 'voiceUpdate';
	sessionId: string;
	event: {
		token: string;
		endpoint: string;
		guildId: string;
	};
}

export interface SendOpcodeVolume extends BaseSendOpcode {
	op: 'volume';
	volume: number;
}

export interface SendOpcodeEqualizer extends BaseSendOpcode {
	op: 'equalizer';
	bands: readonly {
		band: number;
		gain: number;
	}[];
}
