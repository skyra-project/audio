import { BaseCluster, BaseNode, Cluster, Node } from '../src';

describe('Lavalink', () => {
	test('Node extends BaseNode', () => {
		expect(Node.prototype instanceof BaseNode).toBe(true);
	});

	test('Cluster extends BaseCluster', () => {
		expect(Cluster.prototype instanceof BaseCluster).toBe(true);
	});
});
