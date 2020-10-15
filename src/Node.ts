import { BaseNode, NodeOptions, NodeSend } from './base/BaseNode';

export class Node extends BaseNode {
	public send: NodeSend;

	public constructor(options: NodeOptions, send: NodeSend) {
		super(options);
		this.send = send;
	}
}
