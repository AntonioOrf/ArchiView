// `node --import ./test/ts.mjs`: i sorgenti si importano senza estensione (`./lingua`), come vuole
// Metro; Node da solo cerca il file esatto. Si riprova con `.ts`.
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

// I test si scrivono sui testi italiani, qualunque sia il locale della macchina (la CI è inglese).
const { impostaLingua } = await import('../src/lingua.ts');
impostaLingua('it');
