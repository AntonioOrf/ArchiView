import { registerHooks } from 'node:module';

registerHooks({
  resolve(spec, ctx, next) {
    try {
      return next(spec, ctx);
    } catch (e) {
      if (spec.startsWith('.') && !/\.[cm]?[jt]sx?$/.test(spec)) return next(spec + '.ts', ctx);
      throw e;
    }
  }
});

const { impostaLingua } = await import('../src/lingua.ts');
impostaLingua('it');
