"use strict";

module.exports = class SortableSet extends Set {

	constructor(initialIterable, defaultSort, noCache) {
		super(initialIterable);
		this._sortFn = defaultSort;
		this._lastActiveSortFn = null;
		this.noCache = noCache;
	}

	/**
	 * @param {any} value - value to add to set
	 * @returns {SortableSet} - returns itself
	 */
	add(value) {
		this._lastActiveSortFn = null;
		super.add(value);
		return this;
	}

	/**
	 * @param {Function} sortFn - function to sort the set
	 * @returns {void}
	 */
	sortWith(sortFn) {
		// if we can cache, try not to do unnecessary sorting
		if(!this.noCache && (this.size === 0 || sortFn === this._lastActiveSortFn)) {
			// already sorted - nothing to do
			return;
		}

		const sortedArray = Array.from(this).sort(sortFn);
		this.clear();
		for(let i = 0; i < sortedArray.length; i += 1) {
			super.add(sortedArray[i]);
		}
		this._lastActiveSortFn = sortFn;
	}

	/**
	 * @returns {void}
	 */
	sort() {
		this.sortWith(this._sortFn);
	}
};
