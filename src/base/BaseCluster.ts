import type { GatewaySendPayload } from 'discord-api-types/v6';
import { EventEmitter } from 'events';
import { ClusterNode, ClusterNodeOptions } from '../ClusterNode';
import type { Player } from '../core/Player';
import type { VoiceServerUpdate, VoiceStateUpdate } from './BaseNode';

export interface ClusterFilter {
	(node: ClusterNode, guildID: string): boolean;
}

export interface ClusterSend {
	(guildID: string, packet: GatewaySendPayload): unknown;
}

export abstract class BaseCluster extends EventEmitter {
	public abstract send: ClusterSend;
	public abstract filter: ClusterFilter;

	public readonly nodes: ClusterNode[] = [];

	public constructor(options?: ClusterNodeOptions[]) {
		super();
		if (options) this.spawn(options);
	}

	public connect() {
		return Promise.all(this.nodes.map((node) => node.connect()));
	}

	public spawn(options: ClusterNodeOptions): ClusterNode;
	public spawn(options: ClusterNodeOptions[]): ClusterNode[];
	public spawn(options: ClusterNodeOptions | ClusterNodeOptions[]): ClusterNode | ClusterNode[] {
		if (Array.isArray(options)) return options.map((opt) => this.spawn(opt));

		const node = new ClusterNode(this, options);
		this.nodes.push(node);
		return node;
	}

	public sort(): ClusterNode[] {
		return this.nodes
			.filter((n) => n.connected)
			.sort((a, b) => {
				// sort by overall system cpu load
				if (!a.stats || !b.stats) return -1;
				return (
					(a.stats.cpu ? a.stats.cpu.systemLoad / a.stats.cpu.cores : 0) - (b.stats.cpu ? b.stats.cpu.systemLoad / b.stats.cpu.cores : 0)
				);
			});
	}

	public getNode(guildID: string): ClusterNode {
		let node = this.nodes.find((node) => node.players.has(guildID));
		if (!node) node = this.sort().find((node) => this.filter(node, guildID));
		if (node) return node;
		throw new Error('unable to find appropriate node; please check your filter');
	}

	public has(guildID: string): boolean {
		return this.nodes.some((node) => node.players.has(guildID));
	}

	public get(guildID: string): Player<ClusterNode> {
		return this.getNode(guildID).players.get(guildID);
	}

	public voiceStateUpdate(state: VoiceStateUpdate): Promise<boolean> {
		return this.getNode(state.guild_id!).voiceStateUpdate(state);
	}

	public voiceServerUpdate(server: VoiceServerUpdate): Promise<boolean> {
		return this.getNode(server.guild_id).voiceServerUpdate(server);
	}
}
