// Shapes every document sent to the client: `_id` → `id`, no `__v`, and any field
// marked `private: true` in the schema (e.g. passwordHash) is removed.
export function toJSONPlugin(schema) {
  const privateFields = Object.entries(schema.paths)
    .filter(([, schemaType]) => schemaType.options?.private)
    .map(([path]) => path);

  schema.set('toJSON', {
    virtuals: false,
    versionKey: false,
    transform(_doc, ret) {
      ret.id = String(ret._id);
      delete ret._id;
      for (const field of privateFields) delete ret[field];
      return ret;
    },
  });
}
