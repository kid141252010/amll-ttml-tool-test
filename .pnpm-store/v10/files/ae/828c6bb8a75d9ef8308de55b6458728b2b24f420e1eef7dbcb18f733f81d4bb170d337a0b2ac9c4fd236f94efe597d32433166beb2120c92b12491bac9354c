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
export {
  generateUniqueName,
  getOutcomeCount
};
//# sourceMappingURL=unique_name.mjs.map