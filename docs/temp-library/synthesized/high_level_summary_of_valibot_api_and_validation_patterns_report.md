# Valibot API and Validation Patterns Summary

Valibot is a modular, high-performance schema library for TypeScript designed with a focus on bundle size, type safety, and developer experience. It allows developers to create schemas that describe structured data, which can be executed at runtime to guarantee the type safety of unknown data.

## 1. Core API Architecture

Valibot’s API is categorized into several functional areas to support a modular, tree-shakable design. This modularity allows bundlers to remove unused code, potentially reducing bundle size by up to 95% compared to alternatives like Zod.

### Schemas

Schemas are the building blocks used to define data structures. They range from primitives to complex compositions:

- **Primitives:** `string`, `number`, `bigint`, `boolean`, `null`, `undefined`, `void`, `symbol`.
- **Complex Types:** `object`, `array`, `tuple`, `map`, `set`, `record`, `function`, `promise`, `instance`.
- **Logic & Wrappers:** `union`, `intersect`, `variant`, `lazy`, `optional`, `nullable`, `nullish`, `fallback`.
- **Specialized:** `any`, `unknown`, `never`, `nan`, `literal`, `picklist`, `enum`.

### Methods

Methods are used to interact with schemas, perform validation, or transform schema definitions:

- **Execution:** `parse`, `safeParse`, `parser`, `safeParser`.
- **Transformation:** `pipe`, `transform`, `omit`, `pick`, `partial`, `required`, `unwrap`.
- **Introspection:** `getDefault`, `getFallback`, `getMetadata`, `getTitle`, `is`.
- **Error Handling:** `flatten`, `summarize`.

### Actions

Actions are specific validation constraints or transformations applied within a schema, typically used inside a `pipe`:

- **String Validation:** `email`, `url`, `uuid`, `isoDate`, `regex`, `length`, `trim`.
- **Numeric Validation:** `minValue`, `maxValue`, `integer`, `finite`, `multipleOf`.
- **Collection Validation:** `minSize`, `maxSize`, `nonEmpty`, `includes`, `everyItem`, `someItem`.
- **Custom Logic:** `check`, `guard`, `brand`, `transform`.

## 2. Validation Patterns

### The Pipe Pattern

One of Valibot's primary patterns is the use of the `pipe` method. This allows developers to chain a schema with multiple actions (validations or transformations) in a readable sequence.

- **Example Pattern:** `pipe(string(), trim(), email(), minLength(10))`

### Parsing and Safety

Valibot provides two main ways to validate data:

1.  **Standard Parsing:** The `parse` method validates data and returns the typed output or throws a `ValiError` if validation fails.
2.  **Safe Parsing:** The `safeParse` method returns a result object containing either the typed data or detailed issue information, preventing the need for try-catch blocks.

### Asynchronous Validation

For operations requiring network access or database checks, Valibot provides an entire suite of asynchronous counterparts for schemas, methods, and actions:

- **Async Schemas:** `objectAsync`, `arrayAsync`, `unionAsync`.
- **Async Methods:** `parseAsync`, `safeParseAsync`, `pipeAsync`.
- **Async Actions:** `checkAsync`, `transformAsync`.

### Error and Path Management

Valibot includes utilities to handle complex error structures:

- **`flatten`**: Simplifies nested validation errors into a flat object keyed by dot-paths.
- **`getDotPath`**: A utility to retrieve the specific path of a validation issue.

## 3. Configuration and Metadata

Valibot supports global and specific configurations to manage error messages and behavior:

- **Storages:** Functions like `setGlobalConfig`, `setSchemaMessage`, and `setGlobalMessage` allow for centralized management of validation behavior and localization.
- **Metadata:** Actions like `title`, `description`, and `examples` allow developers to attach documentation-related metadata to schemas, which can be retrieved using methods like `getMetadata` or `getDescription`.

## 4. Technical Specifications

- **Type Safety:** Supports full static type inference.
- **Bundle Size:** Starts at less than 700 bytes due to modularity.
- **Interface Example:**
  ```typescript
  // Internal representation of a schema (e.g., AnySchema)
  AnySchema extends BaseSchema<any, any, never> {
      type: 'any';
      reference: typeof any;
      expects: 'any';
  }
  ```
