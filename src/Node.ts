import { BaseNode, BaseNodeOptions, NodeSend } from './base/BaseNode';

/**
 * The options for the node.
 */
export interface NodeOptions extends BaseNodeOptions {
	/**
	 * The send method, this is used by Lavalink to send gateway events to Discord.
	 * @note You are responsible for properly serializing and encoding the packet for transmission.
	 * @example
	 * ```typescript
	 * // Example for discord.js
	 * (guildID, packet) => {
	 *   const guild = client.guilds.cache.get(guildID);
	 *   if (guild) return guild.shard.send(packet);
	 * };
	 * ```
	 */
	send: NodeSend;
}

export class Node extends BaseNode {
	public send: NodeSend;

	public constructor(options: NodeOptions) {
		super(options);
		this.send = options.send;
	}
}
