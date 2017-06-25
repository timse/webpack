/*
 MIT License http://www.opensource.org/licenses/mit-license.php
 Author Tobias Koppers @sokra
 */
"use strict";

const DependenciesBlockVariable = require("./DependenciesBlockVariable");
const identifierUtils = require("./util/identifier");

function disconnect(i) {
	i.disconnect();
}

function unseal(i) {
	i.unseal();
}

class DependenciesBlock {
	constructor() {
		this.dependencies = [];
		this.blocks = [];
		this.variables = [];
	}

	addBlock(block) {
		this.blocks.push(block);
		block.parent = this;
	}

	addVariable(name, expression, dependencies) {
		for(let v of this.variables) {
			if(v.name === name && v.expression === expression) {
				return;
			}
		}
		this.variables.push(new DependenciesBlockVariable(name, expression, dependencies));
	}

	addDependency(dependency) {
		this.dependencies.push(dependency);
	}

	updateHash(hash) {
		function updateHash(i) {
			i.updateHash(hash);
		}

		this.dependencies.forEach(updateHash);
		this.blocks.forEach(updateHash);
		this.variables.forEach(updateHash);
	}

	disconnect() {
		this.dependencies.forEach(disconnect);
		this.blocks.forEach(disconnect);
		this.variables.forEach(disconnect);
	}

	unseal() {
		this.blocks.forEach(unseal);
	}

	hasDependencies(filter) {
		if(filter) {
			if(this.dependencies.some(filter)) {
				return true;
			}
		} else {
			if(this.dependencies.length > 0) {
				return true;
			}
		}

		return this.blocks.concat(this.variables).some(item => item.hasDependencies(filter));
	}

	sortItems() {
		this.blocks.forEach(block => block.sortItems());
	}

	getIdentForChunk(chunk, context) {
		// if identifier method is not defined - break here
		if(!this.identifier) return null;

		const ident = [];
		if(this.chunks.length > 1) {
			ident.push(this.chunks.indexOf(chunk));
		}

		let parent = this.parent;
		while(parent) {
			const p = this.parent;
			const idx = p.blocks.indexOf(this);
			const l = p.blocks.length - 1;
			ident.unshift(`${idx}/${l}`);
			parent = parent.parent;
		}

		ident.unshift(identifierUtils.makePathsRelative(context, this.identifier()));
		return ident.join(":");
	}
}

module.exports = DependenciesBlock;
