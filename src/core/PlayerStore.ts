import type { BaseNode } from '../base/BaseNode';
import { Player } from './Player';

/**
 * Represents a collection of players.
 */
export class PlayerStore<T extends BaseNode = BaseNode> extends Map<string, Player<T>> {
	/**
	 * The [[Node]] or [[ClusterNode]] that created this store.
	 */
	public readonly node: T;

	public constructor(node: T) {
		super();
		this.node = node;
	}

	/**
	 * Gets an existing player, creating a new one if none was found.
	 * @param key The guild's ID to get a player from.
	 */
	public get(key: string): Player<T> {
		let player = super.get(key);
		if (!player) {
			player = new Player(this.node, key);
			this.set(key, player);
		}

		return player;
	}
}
