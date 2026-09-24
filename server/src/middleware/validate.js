// Validates and cleans request data with Zod schemas before the controller runs:
//   router.post('/', validate({ body: createWalletSchema }), controller)
// Unknown fields are stripped, values are converted (e.g. "5" → 5), and a failure
// becomes a 400 VALIDATION_ERROR listing every problem (see errorHandler).
export function validate({ body, query, params }) {
  return (req, _res, next) => {
    if (params) req.params = params.parse(req.params);
    if (query) {
      // In Express 5 req.query is a getter, so replace it with the parsed value.
      Object.defineProperty(req, 'query', {
        value: query.parse(req.query),
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }
    if (body) req.body = body.parse(req.body ?? {});
    next();
  };
}
