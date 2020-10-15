import { BaseCluster, ClusterFilter, ClusterSend } from './base/BaseCluster';
import type { ClusterNodeOptions } from './ClusterNode';

export interface ClusterOptions {
	filter?: ClusterFilter;
	nodes?: ClusterNodeOptions[];
}

export class Cluster extends BaseCluster {
	public filter: ClusterFilter;
	public send: ClusterSend;

	public constructor(options: ClusterOptions, send: ClusterSend) {
		super(options.nodes);
		this.filter = options.filter || (() => true);
		this.send = send;
	}
}
