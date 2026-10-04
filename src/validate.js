// The published schema is the contract on every path. A wrong argument is refused by
// name, with the values that would work, before any network call is made — never
// coerced into a plausible answer (an empty list reads to a model as "there are none").

export function validateToolArgs(tool, args) {
  if (args === null || typeof args !== "object" || Array.isArray(args)) {
    return `${tool.name}: arguments must be a JSON object`;
  }
  const schema = tool.inputSchema || {};
  const props = schema.properties || {};
  for (const req of schema.required || []) {
    if (args[req] === undefined || args[req] === null || args[req] === "") {
      return `${tool.name}: "${req}" is required (${props[req]?.description || "no description"})`;
    }
  }
  for (const [key, value] of Object.entries(args)) {
    const prop = Object.hasOwn(props, key) ? props[key] : undefined;
    if (!prop) return `${tool.name}: unknown argument "${key}". Accepted: ${Object.keys(props).join(", ") || "none"}`;
    if (value === undefined) continue;
    if (value === null) return `${tool.name}: "${key}" must be ${prop.type === "integer" ? "an integer" : `a ${prop.type}`}, got null — omit the argument instead of passing null`;
    if (prop.type === "boolean" && typeof value !== "boolean") {
      return `${tool.name}: "${key}" must be a JSON boolean (true or false), got ${JSON.stringify(value)} — a quoted string reads as true and returns the opposite set`;
    }
    if (prop.type === "integer") {
      if (!Number.isInteger(value)) return `${tool.name}: "${key}" must be an integer, got ${JSON.stringify(value)}`;
      if (prop.minimum !== undefined && value < prop.minimum) return `${tool.name}: "${key}" must be an integer >= ${prop.minimum}, got ${value}`;
      if (prop.maximum !== undefined && value > prop.maximum) return `${tool.name}: "${key}" must be an integer <= ${prop.maximum}, got ${value}`;
    }
    if (prop.type === "string" && typeof value !== "string") return `${tool.name}: "${key}" must be a string, got ${JSON.stringify(value)}`;
    if (Array.isArray(prop.enum) && !prop.enum.includes(value)) {
      return `${tool.name}: "${key}" must be one of: ${prop.enum.join(", ")} — got ${JSON.stringify(value)}`;
    }
  }
  return null;
}
