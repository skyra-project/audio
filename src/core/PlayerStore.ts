import type { BaseNode } from '../base/BaseNode';
import { Player } from './Player';

export class PlayerStore<T extends BaseNode = BaseNode> extends Map<string, Player<T>> {
	public readonly node: T;

	public constructor(node: T) {
		super();
		this.node = node;
	}

	public get(key: string): Player<T> {
		let player = super.get(key);
		if (!player) {
			player = new Player(this.node, key);
			this.set(key, player);
		}

		return player;
	}
}
