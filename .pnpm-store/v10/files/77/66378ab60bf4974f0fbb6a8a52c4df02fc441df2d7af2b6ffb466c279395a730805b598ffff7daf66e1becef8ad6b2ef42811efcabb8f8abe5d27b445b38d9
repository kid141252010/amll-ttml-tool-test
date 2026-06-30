"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var unique_name_exports = {};
__export(unique_name_exports, {
  generateUniqueName: () => generateUniqueName,
  getOutcomeCount: () => getOutcomeCount
});
module.exports = __toCommonJS(unique_name_exports);
const placeholderRegex = /(X+)[^X]*$/;
const table = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const tableLength = table.length;
function getOutcomeCount(template) {
  if (typeof template !== "string") {
    throw new TypeError(`template must be a string: ${template}`);
  }
  const matches = template.match(placeholderRegex);
  if (matches === null || !matches[1]) {
    return 1;
  }
  return Math.pow(tableLength, matches[1].length);
}
function generateUniqueName(template) {
  if (typeof template !== "string") {
    throw new TypeError(`template must be a string: ${template}`);
  }
  const matches = template.match(placeholderRegex);
  if (matches === null || !matches[1]) {
    return template;
  }
  const result = [];
  for (let i = 0, len = matches[1].length; i < len; i += 1) {
    result.push(table[Math.floor(Math.random() * tableLength)]);
  }
  const { index = 0 } = matches;
  return template.slice(0, index) + result.join("") + template.slice(index + result.length);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  generateUniqueName,
  getOutcomeCount
});
//# sourceMappingURL=unique_name.js.map