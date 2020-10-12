import { BaseNode, BaseNodeOptions, NodeSend } from './base/BaseNode';

export interface NodeOptions extends BaseNodeOptions {
	send: NodeSend;
}

export class Node extends BaseNode {
	public send: NodeSend;

	public constructor(options: NodeOptions) {
		super(options);
		this.send = options.send;
	}
}
