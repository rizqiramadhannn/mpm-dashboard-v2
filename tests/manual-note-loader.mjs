import { registerHooks } from "node:module";

// Node's type stripping handles .ts; resolve the extensionless imports used by
// the Next application without pulling server-only modules into unit tests.
registerHooks({
  resolve(specifier, context, nextResolve) {
    try { return nextResolve(specifier, context); }
    catch (error) {
      if (!specifier.startsWith(".")) throw error;
      for (const suffix of [".ts", "/index.ts"]) {
        try { return nextResolve(specifier + suffix, context); } catch { /* try next */ }
      }
      throw error;
    }
  },
});
