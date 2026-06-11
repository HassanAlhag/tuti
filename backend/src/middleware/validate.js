export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const issues = result.error.issues || result.error.errors || [];
      const messages = issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
      return res.status(400).json({ error: messages });
    }
    req.body = result.data;
    next();
  };
}
