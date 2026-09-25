// schema-validate.mjs — a small, dependency-free JSON Schema validator.
//
//   import { validate } from './schema-validate.mjs';
//   const errors = validate(instance, schema);   // [] means valid
//
// This file supports exactly the keywords reference/schema/lesson-card.v1.json actually uses:
//
//   $ref (local "#/$defs/NAME" form), type (object/array/string/number/integer/boolean),
//   required, properties, additionalProperties:false, items, const, enum, pattern,
//   minimum, maximum, minLength, minItems, oneOf, allOf.
//
// Annotation-only keywords are read for nothing and never affect the verdict: $schema, $id,
// title, description, and the project's custom fieldOrder.
//
// No imports. It does not read reference/schema/lesson-card.v1.json itself and it does not import
// checker/convert.mjs — the caller reads the schema and hands both instance and schema in. That
// keeps this file usable by anything that wants a verdict without also inheriting an opinion about
// where the contract lives or how a card gets produced.

// ── small helpers ──────────────────────────────────────────────────────────────────────────────

function describeType(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

// JSON.stringify silently turns NaN/Infinity/-Infinity into the string "null", which makes a
// rejection message for exactly those values claim the instance WAS null — misleading in the one
// case an error message most needs to be trusted. Report them by name instead.
function fmt(v) {
  if (typeof v === 'number' && !Number.isFinite(v)) return String(v);
  return JSON.stringify(v);
}

// Only what this schema's const/enum values need: strings, numbers, booleans. JSON.stringify is a
// safe equality check for those scalar cases, which is all this contract's const/enum ever carry.
function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function typeMatches(instance, type) {
  switch (type) {
    case 'object':
      return instance !== null && typeof instance === 'object' && !Array.isArray(instance);
    case 'array':
      return Array.isArray(instance);
    case 'string':
      return typeof instance === 'string';
    // NaN and Infinity cannot survive round-tripping through JSON.parse of well-formed JSON text,
    // but this function also has to be correct for instances built in memory (tests, pipes that
    // hand-assemble an object) — so number/integer explicitly demand finiteness rather than
    // trusting that "typeof === 'number'" is enough.
    case 'number':
      return typeof instance === 'number' && Number.isFinite(instance);
    case 'integer':
      return typeof instance === 'number' && Number.isFinite(instance) && Number.isInteger(instance);
    case 'boolean':
      return typeof instance === 'boolean';
    default:
      return true;
  }
}

function resolveRef(ref, root) {
  if (!ref.startsWith('#/')) throw new Error(`schema-validate: only local refs are supported, got ${ref}`);
  const parts = ref.slice(2).split('/');
  let node = root;
  for (const p of parts) {
    if (node == null || !(p in node)) throw new Error(`schema-validate: cannot resolve ${ref} (missing ${p})`);
    node = node[p];
  }
  return node;
}

// The set of property names "declared at the same schema object" for additionalProperties
// purposes — direct `properties`, plus anything reachable through `$ref` or `allOf`, since those
// are the two ways this schema (or a future one) could carry properties without stating them
// inline. oneOf is deliberately excluded: its branches are alternatives, not a joint declaration.
function collectPropertyNames(schema, root, seen = new Set()) {
  const names = new Set();
  function walk(s) {
    if (!s || seen.has(s)) return;
    seen.add(s);
    if (s.$ref) walk(resolveRef(s.$ref, root));
    if (s.properties) for (const k of Object.keys(s.properties)) names.add(k);
    if (Array.isArray(s.allOf)) for (const sub of s.allOf) walk(sub);
  }
  walk(schema);
  return names;
}

function joinPath(path, key) {
  return path ? `${path}.${key}` : String(key);
}

function indexPath(path, i) {
  return `${path}[${i}]`;
}

// ── the core validator ─────────────────────────────────────────────────────────────────────────
// Every applicable keyword on `schema` is checked; JSON Schema keywords are an implicit AND, and a
// keyword that does not apply to the instance's actual type (e.g. `items` on a non-array, `pattern`
// on a non-string) is simply skipped rather than treated as a failure or forced to match.
function validateNode(instance, schema, path, root, errors) {
  if (schema === true) return;
  if (schema === false) {
    errors.push({ path, message: 'schema is `false`; nothing is valid here' });
    return;
  }

  if (schema.$ref) {
    validateNode(instance, resolveRef(schema.$ref, root), path, root, errors);
  }

  if (Object.prototype.hasOwnProperty.call(schema, 'const')) {
    if (!deepEqual(instance, schema.const))
      errors.push({ path, message: `expected const ${fmt(schema.const)}, got ${fmt(instance)}` });
  }

  if (Array.isArray(schema.enum)) {
    if (!schema.enum.some((v) => deepEqual(v, instance)))
      errors.push({ path, message: `expected one of ${JSON.stringify(schema.enum)}, got ${fmt(instance)}` });
  }

  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => typeMatches(instance, t)))
      errors.push({ path, message: `expected type ${types.join('|')}, got ${describeType(instance)} (${fmt(instance)})` });
  }

  if (typeof instance === 'string') {
    if (typeof schema.pattern === 'string' && !new RegExp(schema.pattern).test(instance))
      errors.push({ path, message: `does not match pattern ${schema.pattern}: ${fmt(instance)}` });
    if (typeof schema.minLength === 'number' && instance.length < schema.minLength)
      errors.push({ path, message: `length ${instance.length} is below minLength ${schema.minLength}` });
  }

  if (typeof instance === 'number' && Number.isFinite(instance)) {
    if (typeof schema.minimum === 'number' && instance < schema.minimum)
      errors.push({ path, message: `${instance} is below minimum ${schema.minimum}` });
    if (typeof schema.maximum === 'number' && instance > schema.maximum)
      errors.push({ path, message: `${instance} is above maximum ${schema.maximum}` });
  }

  if (Array.isArray(instance)) {
    if (typeof schema.minItems === 'number' && instance.length < schema.minItems)
      errors.push({ path, message: `${instance.length} item(s) is below minItems ${schema.minItems}` });
    // `items` applies only when the instance is an array — this is what lets the same schema node
    // (allOf: [listOrAbsent], items: {...}) validate the absent-marker string with `items` simply
    // not in play, and validate a real array with every element checked.
    if (schema.items !== undefined) {
      instance.forEach((v, i) => validateNode(v, schema.items, indexPath(path, i), root, errors));
    }
  }

  if (instance !== null && typeof instance === 'object' && !Array.isArray(instance)) {
    if (Array.isArray(schema.required)) {
      for (const key of schema.required) {
        if (!Object.prototype.hasOwnProperty.call(instance, key))
          errors.push({ path: joinPath(path, key), message: `missing required property \`${key}\`` });
      }
    }
    if (schema.properties) {
      for (const [key, subschema] of Object.entries(schema.properties)) {
        if (Object.prototype.hasOwnProperty.call(instance, key))
          validateNode(instance[key], subschema, joinPath(path, key), root, errors);
      }
    }
    if (schema.additionalProperties === false) {
      const allowed = collectPropertyNames(schema, root);
      for (const key of Object.keys(instance)) {
        if (!allowed.has(key))
          errors.push({ path: joinPath(path, key), message: `unexpected property \`${key}\` — additionalProperties is false here` });
      }
    }
  }

  if (Array.isArray(schema.allOf)) {
    for (const sub of schema.allOf) validateNode(instance, sub, path, root, errors);
  }

  if (Array.isArray(schema.oneOf)) {
    const branchResults = schema.oneOf.map((sub, i) => {
      const subErrors = [];
      validateNode(instance, sub, path, root, subErrors);
      return { i, subErrors };
    });
    const matched = branchResults.filter((b) => b.subErrors.length === 0);
    if (matched.length !== 1) {
      const detail = branchResults
        .map((b) => `branch ${b.i}: ${b.subErrors.length === 0 ? 'matched' : b.subErrors.map((e) => `${e.path || '(root)'}: ${e.message}`).join('; ')}`)
        .join(' | ');
      const verdict = matched.length === 0 ? 'no branch matched' : `${matched.length} branches matched (must be exactly 1)`;
      errors.push({ path, message: `oneOf failed — ${verdict} — ${detail}` });
    }
  }
}

export function validate(instance, schema, root = schema) {
  const errors = [];
  validateNode(instance, schema, '', root, errors);
  return errors;
}
