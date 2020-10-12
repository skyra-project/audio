import type { BaseCluster, ClusterSend } from './base/BaseCluster';
import { BaseNode, BaseNodeOptions } from './base/BaseNode';

export interface ClusterNodeOptions extends BaseNodeOptions {
	tags?: Iterable<string>;
}

export interface Stats {
	players: number;
	playingPlayers: number;
	uptime: number;
	memory?: {
		free: number;
		used: number;
		allocated: number;
		reservable: number;
	};
	cpu?: {
		cores: number;
		systemLoad: number;
		lavalinkLoad: number;
	};
	frameStats?: {
		sent: number;
		nulled: number;
		deficit: number;
	};
}

export class ClusterNode extends BaseNode {
	public tags: Set<string>;
	public send: ClusterSend;
	public stats: Stats | null;

	public constructor(public readonly cluster: BaseCluster, options: ClusterNodeOptions) {
		super(options);
		this.tags = new Set(options.tags || []);
		this.send = this.cluster.send.bind(this.cluster);
		this.stats = null;

		this.on('stats', (stats) => (this.stats = stats));
	}

	public emit(name: string | symbol, ...args: any[]): boolean {
		if (this.listenerCount(name)) super.emit(name, ...args);
		return this.cluster.emit(name, ...args);
	}

	public async destroy(code?: number, data?: string): Promise<void> {
		await super.destroy(code, data);
		this.cluster.nodes.splice(this.cluster.nodes.indexOf(this), 1);
	}
}
