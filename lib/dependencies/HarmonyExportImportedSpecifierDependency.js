/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";
const NullDependency = require("./NullDependency");
const HarmonyModulesHelpers = require("./HarmonyModulesHelpers");

class HarmonyExportImportedSpecifierDependency extends NullDependency {
	constructor(originModule, importDependency, importedVar, id, name) {
		super();
		this.originModule = originModule;
		this.importDependency = importDependency;
		this.importedVar = importedVar;
		this.id = id;
		this.name = name;
	}

	get type() {
		return "harmony export imported specifier";
	}

	getReference() {
		const used = this.originModule.isUsed(this.name);
		const active = HarmonyModulesHelpers.isActive(this.originModule, this);
		if(!this.importDependency.module || !used || !active) return null;
		if(!this.originModule.usedExports) return null;
		const importedModule = this.importDependency.module;
		if(!this.name) {
			// export *
			if(Array.isArray(this.originModule.usedExports)) {
				// reexport * with known used exports
				var activeExports = HarmonyModulesHelpers.getActiveExports(this.originModule, this);
				if(Array.isArray(importedModule.providedExports)) {
					return {
						module: importedModule,
						importedNames: this.originModule.usedExports.filter(function(id) {
							return activeExports.indexOf(id) < 0 && importedModule.providedExports.indexOf(id) >= 0 && id !== "default";
						}, this)
					}
				} else {
					return {
						module: importedModule,
						importedNames: this.originModule.usedExports.filter(function(id) {
							return activeExports.indexOf(id) < 0 && id !== "default";
						}, this)
					}
				}
			} else if(Array.isArray(importedModule.providedExports)) {
				return {
					module: importedModule,
					importedNames: importedModule.providedExports.filter(function(id) {
						return id !== "default"
					})
				}
			} else {
				return {
					module: importedModule,
					importedNames: true
				}
			}
		} else {
			if(Array.isArray(this.originModule.usedExports) && this.originModule.usedExports.indexOf(this.name) < 0) return null;
			if(this.id) {
				// export { name as name }
				return {
					module: importedModule,
					importedNames: [this.id]
				};
			} else {
				// export { * as name }
				return {
					module: importedModule,
					importedNames: true
				};
			}
		}
	}

	getExports() {
		if(this.name) {
			return {
				exports: [this.name]
			}
		}

		const importedModule = this.importDependency.module;
		if(importedModule && Array.isArray(importedModule.providedExports)) {
			return {
				exports: importedModule.providedExports.filter(function(id) {
					return id !== "default"
				}),
				dependencies: [importedModule]
			};
		}

		if(importedModule && importedModule.providedExports) {
			return {
				exports: true
			};
		}

		if(importedModule) {
			return {
				exports: null,
				dependencies: [importedModule]
			};
		}

		return {
			exports: null
		}
	}

	describeHarmonyExport() {
		const importedModule = this.importDependency.module;
		if(!this.name && importedModule && Array.isArray(importedModule.providedExports)) {
			// for a star export and when we know which exports are provided, we can tell so
			return {
				exportedName: importedModule.providedExports,
				precedence: 3
			}
		}

		return {
			exportedName: this.name,
			precedence: this.name ? 2 : 3
		};
	}

	updateHash(hash) {
		super.updateHash(hash);
		const importedModule = this.importDependency.module;
		hash.update((importedModule && (importedModule.used + JSON.stringify(importedModule.usedExports) + JSON.stringify(importedModule.providedExports))) + "");
	}
}

module.exports = HarmonyExportImportedSpecifierDependency;

HarmonyExportImportedSpecifierDependency.Template = class HarmonyExportImportedSpecifierDependencyTemplate {
	apply(dep, source, outputOptions, requestShortener) {
		const content = this.getContent(dep);
		source.insert(-1, content);
	}

	getContent(dep) {
		const name = dep.importedVar;
		const used = dep.originModule.isUsed(dep.name);
		const importedModule = dep.importDependency.module;
		const active = HarmonyModulesHelpers.isActive(dep.originModule, dep);
		const importsExportsUnknown = !importedModule || !Array.isArray(importedModule.providedExports);

		const getReexportStatement = this.reexportStatementCreator(importsExportsUnknown, name);

		if(!used) { // we want to rexport something, but the export isn't used
			return "/* unused harmony reexport " + dep.name + " */\n";
		}

		if(!active) { // we want to reexport something but another exports overrides this one
			return "/* inactive harmony reexport " + (dep.name || "namespace") + " */\n";
		}

		if(dep.name && dep.id === "default" && !(importedModule && (!importedModule.meta || importedModule.meta.harmonyModule))) { // we want to reexport the default export from a non-hamory module
			return "/* harmony reexport (default from non-hamory) */ " + getReexportStatement(JSON.stringify(used), null);
		}

		if(dep.name && dep.id) { // we want to reexport a key as new key
			var idUsed = importedModule && importedModule.isUsed(dep.id);
			return "/* harmony reexport (binding) */ " + getReexportStatement(JSON.stringify(used), JSON.stringify(idUsed));
		}

		if(dep.name) { // we want to reexport the module object as named export
			return "/* harmony reexport (module object) */ " + getReexportStatement(JSON.stringify(used), "");
		}

		if(Array.isArray(dep.originModule.usedExports)) { // we know which exports are used
			const activeExports = HarmonyModulesHelpers.getActiveExports(dep.originModule, dep);
			const items = dep.originModule.usedExports.map(function(id) {
				if(id === "default") return;
				if(activeExports.indexOf(id) >= 0) return;
				if(importedModule.isProvided(id) === false) return;
				var exportUsed = dep.originModule.isUsed(id);
				var idUsed = importedModule && importedModule.isUsed(id);
				return [exportUsed, idUsed];
			}).filter(Boolean);
			if(items.length > 0) {
				return items.map(function(item) {
					return "/* harmony namespace reexport (by used) */ " + getReexportStatement(JSON.stringify(item[0]), JSON.stringify(item[1]));
				}).join("");
			}

			return "/* unused harmony namespace reexport */\n";
		}

		if(dep.originModule.usedExports && importedModule && Array.isArray(importedModule.providedExports)) { // not sure which exports are used, but we know which are provided
			const activeExports = HarmonyModulesHelpers.getActiveExports(dep.originModule, dep);
			const items = importedModule.providedExports.map(function(id) {
				if(id === "default") return;
				if(activeExports.indexOf(id) >= 0) return;
				var exportUsed = dep.originModule.isUsed(id);
				var idUsed = importedModule && importedModule.isUsed(id);
				return [exportUsed, idUsed];
			}).filter(Boolean);
			if(items.length > 0) {
				return items.map(function(item) {
					return "/* harmony namespace reexport (by provided) */ " + getReexportStatement(JSON.stringify(item[0]), JSON.stringify(item[1]));
				}).join("");
			}

			return "/* empty harmony namespace reexport */\n";
		}

		if(dep.originModule.usedExports) { // not sure which exports are used and provided
			const activeExports = HarmonyModulesHelpers.getActiveExports(dep.originModule, dep);
			let content = "/* harmony namespace reexport (unknown) */ for(var __WEBPACK_IMPORT_KEY__ in " + name + ") ";

			// Filter out exports which are defined by other exports
			// and filter out default export because it cannot be reexported with *
			if(activeExports.length > 0)
				content += "if(" + JSON.stringify(activeExports.concat("default")) + ".indexOf(__WEBPACK_IMPORT_KEY__) < 0) ";
			else
				content += "if(__WEBPACK_IMPORT_KEY__ !== 'default') ";
			return content + "(function(key) { __webpack_require__.d(exports, key, function() { return " + name + "[key]; }) }(__WEBPACK_IMPORT_KEY__));\n";
		}

		return "/* unused harmony reexport namespace */\n";
	}

	reexportStatementCreator(importsExportsUnknown, name) {
		const getReexportStatement = (key, valueKey) => {
			const conditional = this.getConditional(importsExportsUnknown, valueKey, name);
			const returnValue = this.getReturnValue(valueKey)
			return `${conditional}__webpack_require__.d(exports, ${key}, function() { return ${name}${returnValue}; });\n`;
		};
		return getReexportStatement;
	}

	getConditional(importsExportsUnknown, valueKey, name) {
		if(!importsExportsUnknown || !valueKey) {
			return "";
		}

		return `if(__webpack_require__.o(${name}, ${valueKey})) `;
	}

	getReturnValue(valueKey) {
		if(valueKey === null) {
			return "_default.a";
		}

		return valueKey && "[" + valueKey + "]";
	}
}
