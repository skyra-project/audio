import type { IncomingMessage } from 'http';
import type { IncomingEventPayload, IncomingPlayerUpdatePayload, IncomingStatsPayload } from './types/IncomingPayloads';
import type { BaseCluster, ClusterSend } from './base/BaseCluster';
import { BaseNode, NodeOptions } from './base/BaseNode';
import { ConnectionEvents } from './core/Connection';

export interface ClusterNodeOptions extends NodeOptions {
	tags?: Iterable<string>;
}

export type Stats = Omit<IncomingStatsPayload, 'op'>;

export class ClusterNode extends BaseNode {
	public tags: Set<string>;
	public send: ClusterSend;
	public stats: Stats | null;

	public constructor(public readonly cluster: BaseCluster, options: ClusterNodeOptions) {
		super(options);
		this.tags = new Set(options.tags || []);
		this.send = this.cluster.send.bind(this.cluster);
		this.stats = null;

		this.on(ConnectionEvents.Stats, (stats) => (this.stats = stats));
	}

	public emit(event: ConnectionEvents.Close, code: number, reason: string): boolean;
	public emit(event: ConnectionEvents.Error, error: Error): boolean;
	public emit(event: ConnectionEvents.Event, payload: IncomingEventPayload): boolean;
	public emit(event: ConnectionEvents.Open): boolean;
	public emit(event: ConnectionEvents.PlayerUpdate, payload: IncomingPlayerUpdatePayload): boolean;
	public emit(event: ConnectionEvents.Stats, payload: IncomingStatsPayload): boolean;
	public emit(event: ConnectionEvents.Upgrade, req: IncomingMessage): boolean;
	public emit(event: ConnectionEvents, ...args: readonly any[]): boolean {
		// @ts-expect-error Expect same arguments as parent.
		if (this.listenerCount(event)) super.emit(event, ...args);
		return this.cluster.emit(event, ...args);
	}

	public async destroy(code?: number, data?: string): Promise<void> {
		await super.destroy(code, data);
		this.cluster.nodes.splice(this.cluster.nodes.indexOf(this), 1);
	}
}
