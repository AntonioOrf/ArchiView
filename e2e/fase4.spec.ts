import { test, expect } from './fixtures';
import { createLocalWorkspace, seedItems, getAppData, expectToast } from './helpers';
import * as path from 'path';

// `appData` vive nello scope del bundle del renderer, non su `window`: dentro page.evaluate
// e' una variabile globale come le altre, e va solo dichiarata al compilatore dello spec.
declare const appData: any;

// Fase 4 — sicurezza del dato. Copre le quattro cose che prima non esistevano:
// il cestino (4.1), gli snapshot locali con ripristino (4.2), la cronologia di UNA scheda
// (4.3) e la fusione campo per campo (4.4), più il redo (4.5).
//
// In ogni semina c'è una scheda-esca che NON deve essere toccata: senza, un'asserzione su
// un conteggio passerebbe anche a operazione inerte.

/** Elimina una scheda per segnatura passando dal percorso reale (modale di conferma). */
async function eliminaPerSegnatura(page: any, segnatura: string): Promise<string> {
  const id = await page.evaluate((seg: string) => {
    const m = appData.manoscritti.find((x: any) => x.segnatura === seg);
    return m ? String(m.id) : '';
  }, segnatura);
  expect(id).not.toBe('');
  await page.evaluate((rid: string) => (window as any).deleteItem(rid), id);
  await expect(page.locator('#delete-modal')).toBeVisible();
  await page.evaluate(() => (window as any).confermaEliminazione());
  await expect(page.locator('#delete-modal')).toBeHidden();
  return id;
}

/** Le segnature presenti in archivio, ordinate. */
async function segnature(page: any): Promise<string[]> {
  return page.evaluate(() => appData.manoscritti.map((m: any) => String(m.segnatura)).sort());
}

test.describe('Cestino (4.1)', () => {

  test('una scheda eliminata finisce nel cestino e si può rimettere in archivio', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Fase4');
    await page.evaluate(async () => {
      appData.manoscritti.push(
        { id: 'a1', cartella: 'Notarile', tipoDocumento: 'imbreviature', segnatura: 'DA-BUTTARE', tags: '', allegati: [], lastModified: Date.now() },
        { id: 'esca', cartella: '', tipoDocumento: 'imbreviature', segnatura: 'ESCA', tags: '', allegati: [], lastModified: Date.now() }
      );
      appData.cartelle.push('Notarile');
      await (window as any).Store.commit();
    });

    await eliminaPerSegnatura(page, 'DA-BUTTARE');
    expect(await segnature(page)).toEqual(['ESCA']);

    // Nel cestino c'è la scheda eliminata e SOLO quella: l'esca non deve esserci.
    await page.evaluate(() => (window as any).apriCestino());
    await expect(page.locator('#cestino-modal')).toBeVisible();
    await expect(page.locator('#cestino-list')).toContainText('DA-BUTTARE');
    await expect(page.locator('#cestino-list')).not.toContainText('ESCA');

    await page.evaluate(() => (window as any).ripristinaVociCestino(['a1']));
    await expectToast(page);
    expect(await segnature(page)).toEqual(['DA-BUTTARE', 'ESCA']);

    // Il tombstone se n'è andato con il ripristino, o il primo sync rieliminerebbe la scheda.
    const dati = await getAppData(page);
    expect(dati.deletedIds || []).not.toContain('a1');
    // …e la cartella è tornata insieme alla scheda, che altrimenti sarebbe irraggiungibile.
    expect(dati.cartelle).toContain('Notarile');
    await expect(page.locator('#cestino-list')).not.toContainText('DA-BUTTARE');
  });

  test('l\'eliminazione definitiva toglie la scheda anche dal cestino', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Fase4');
    await seedItems(page, 2);
    const id = await eliminaPerSegnatura(page, 'Seed-000');

    // Prima c'è: senza questa riga il test passerebbe anche con il cestino inerte.
    const prima = await page.evaluate(() => (window as any).elencaCestino());
    expect(prima.map((v: any) => String(v.record.id))).toContain(id);

    await page.evaluate(async (rid: string) => {
      await (window as any).eliminaDefinitivo([rid]);
    }, id);

    const voci = await page.evaluate(() => (window as any).elencaCestino());
    expect(voci.map((v: any) => String(v.record.id))).not.toContain(id);
    // …e non torna in archivio: l'eliminazione definitiva non è un ripristino mancato.
    expect(await segnature(page)).toEqual(['Seed-001']);
  });

  test('anche le schede travolte dall\'eliminazione di un archivio finiscono nel cestino', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Fase4');
    await page.evaluate(async () => {
      appData.cartelle.push('Fondo');
      appData.manoscritti.push(
        { id: 'f1', cartella: 'Fondo', tipoDocumento: 'imbreviature', segnatura: 'DENTRO', tags: '', allegati: [], lastModified: Date.now() },
        { id: 'f2', cartella: '', tipoDocumento: 'imbreviature', segnatura: 'ESCA', tags: '', allegati: [], lastModified: Date.now() }
      );
      await (window as any).Store.commit();
      // `mostraBottomConfirm` chiede conferma: nel test si esegue direttamente il ramo di sì.
      (window as any).mostraBottomConfirm = (_msg: string, ok: any) => ok();
      await (window as any).eliminaCartellaDaSidebar('Fondo');
    });

    await expect.poll(() => segnature(page)).toEqual(['ESCA']);
    const voci = await page.evaluate(() => (window as any).elencaCestino());
    expect(voci.map((v: any) => String(v.record.segnatura))).toEqual(['DENTRO']);
  });
});

test.describe('Snapshot locali (4.2)', () => {

  test('uno snapshot creato a mano compare nel pannello e riporta indietro l\'archivio', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Fase4');
    await page.evaluate(async () => {
      appData.manoscritti.push({ id: 's1', cartella: '', tipoDocumento: 'imbreviature', segnatura: 'PRIMA', tags: '', allegati: [], lastModified: Date.now() });
      await (window as any).Store.commit();
      await (window as any).flushSalvataggio();
    });

    await page.evaluate(() => (window as any).creaSnapshotOra());
    await expect.poll(async () => {
      const res = await page.evaluate(() => (window as any).apiSicurezza.snapshotElenca());
      return res.voci.length;
    }).toBeGreaterThan(0);

    // Il mondo cambia DOPO lo snapshot: una scheda in più e una segnatura riscritta.
    await page.evaluate(async () => {
      appData.manoscritti.find((m: any) => m.id === 's1').segnatura = 'DOPO';
      appData.manoscritti.push({ id: 's2', cartella: '', tipoDocumento: 'imbreviature', segnatura: 'NATA-DOPO', tags: '', allegati: [], lastModified: Date.now() });
      await (window as any).Store.commit();
      await (window as any).flushSalvataggio();
    });
    expect(await segnature(page)).toEqual(['DOPO', 'NATA-DOPO']);

    const nome = await page.evaluate(async () => {
      const res = await (window as any).apiSicurezza.snapshotElenca();
      return res.voci[res.voci.length - 1].nome;
    });
    await page.evaluate(async (n: string) => {
      const res = await (window as any).apiSicurezza.snapshotCarica(n);
      await (window as any).ripristinaDatabase(res.database);
    }, nome);

    expect(await segnature(page)).toEqual(['PRIMA']);
    const dati = await getAppData(page);
    // La scheda nata dopo lo snapshot non basta toglierla: senza tombstone tornerebbe dal
    // cloud al primo sync.
    expect(dati.deletedIds).toContain('s2');
    // La scheda riportata indietro è stata rifirmata, o il primo sync la riscriverebbe.
    expect(dati.manoscritti[0].lastModified).toBeGreaterThan(0);
  });

  test('il pannello cronologia mostra la sezione locale anche senza cloud', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Fase4');
    await page.evaluate(() => (window as any).switchSidebarTab('history'));
    await page.evaluate(() => (window as any).renderHistoryList());
    // Prima della 4.2 il pannello sapeva dire soltanto "collegati a Google Drive".
    await expect(page.locator('#history-list')).toContainText('Snapshot locali');
    await expect(page.locator('#btn-snapshot-now')).toBeVisible();
  });
});

test.describe('Cronologia della scheda (4.3)', () => {

  test('le tappe sono solo i momenti in cui la scheda è cambiata', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Fase4');
    await page.evaluate(async () => {
      appData.manoscritti.push(
        { id: 'h1', cartella: '', tipoDocumento: 'imbreviature', segnatura: 'V1', tags: '', allegati: [], lastModified: 1 },
        { id: 'esca', cartella: '', tipoDocumento: 'imbreviature', segnatura: 'ESCA', tags: '', allegati: [], lastModified: 1 }
      );
      await (window as any).Store.commit();
      await (window as any).flushSalvataggio();
      await (window as any).apiSicurezza.snapshotCrea('manuale');

      // Snapshot senza toccare h1: NON deve produrre una tappa.
      appData.manoscritti.find((m: any) => m.id === 'esca').segnatura = 'ESCA-2';
      await (window as any).Store.commit();
      await (window as any).flushSalvataggio();
      await (window as any).apiSicurezza.snapshotCrea('manuale');

      appData.manoscritti.find((m: any) => m.id === 'h1').segnatura = 'V2';
      await (window as any).Store.commit();
      await (window as any).flushSalvataggio();
      await (window as any).apiSicurezza.snapshotCrea('manuale');
    });

    const tappe = await page.evaluate(async () => {
      const res = await (window as any).apiSicurezza.storiaRecord('h1');
      return res.tappe.map((t: any) => (t.record ? t.record.segnatura : null));
    });
    // Due tappe, non tre: lo snapshot di mezzo non ha cambiato questa scheda.
    expect(tappe).toEqual(['V2', 'V1']);
  });

  test('il ripristino agisce sulla sola scheda e si annulla', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Fase4');
    await page.evaluate(async () => {
      appData.manoscritti.push(
        { id: 'h1', cartella: '', tipoDocumento: 'imbreviature', segnatura: 'V1', tags: '', allegati: [], lastModified: 1 },
        { id: 'esca', cartella: '', tipoDocumento: 'imbreviature', segnatura: 'ESCA', tags: '', allegati: [], lastModified: 1 }
      );
      await (window as any).Store.commit();
      await (window as any).ripristinaVersioneRecord('h1', { id: 'h1', cartella: '', tipoDocumento: 'imbreviature', segnatura: 'ANTICA', tags: '', allegati: [], lastModified: 1 }, 'ieri');
    });
    expect(await segnature(page)).toEqual(['ANTICA', 'ESCA']);

    await page.evaluate(() => (window as any).gestoreAnnullamento.annullaUltimaAzione());
    await expect.poll(() => segnature(page)).toEqual(['ESCA', 'V1']);
  });
});

test.describe('Merge campo per campo (4.4)', () => {

  test('due colleghi su campi diversi della stessa scheda non fanno più conflitto', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Fase4');
    const esito = await page.evaluate(() => {
      const w = window as any;
      const base = { id: 'c1', cartella: '', tipoDocumento: 'imbreviature', segnatura: 'ASP 1', notaio: 'Rossi', trascrizione: '<p>uno</p>', lastModified: 1000 };
      const locale = { ...base, notaio: 'Bianchi', lastModified: 2000 };
      const esterno = { ...base, trascrizione: '<p>due</p>', lastModified: 3000 };
      const conflitti = w.rilevaConflitti([locale], [esterno], 0, { c1: w.getRecordHash(base) }, { c1: base });
      const fusa = w.Model.fondiRecord(base, locale, esterno).fuso;
      return { conflitti: conflitti.length, notaio: fusa.notaio, trascrizione: fusa.trascrizione };
    });
    expect(esito.conflitti).toBe(0);
    expect(esito.notaio).toBe('Bianchi');
    expect(esito.trascrizione).toBe('<p>due</p>');
  });

  test('lo stesso campo cambiato da entrambi resta un conflitto, ma solo quel campo', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Fase4');
    const conflitti = await page.evaluate(() => {
      const w = window as any;
      const base = { id: 'c1', cartella: '', tipoDocumento: 'imbreviature', segnatura: 'ASP 1', notaio: 'Rossi', lastModified: 1000 };
      const locale = { ...base, notaio: 'Bianchi', segnatura: 'ASP 2', lastModified: 2000 };
      const esterno = { ...base, notaio: 'Verdi', lastModified: 3000 };
      return w.rilevaConflitti([locale], [esterno], 0, { c1: w.getRecordHash(base) }, { c1: base });
    });
    expect(conflitti).toHaveLength(1);
    // `segnatura` l'ha cambiata solo il locale: non è in conflitto e non va chiesta.
    expect(conflitti[0].campiConflitto).toEqual(['notaio']);
    // La scheda già fusa viaggia nel conflitto: il modale parte da lì.
    expect(conflitti[0].fusa.segnatura).toBe('ASP 2');
  });
});

test.describe('Annulla e ripeti (4.5)', () => {

  test('un\'eliminazione si annulla e si ripete', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Fase4');
    await seedItems(page, 2);
    await eliminaPerSegnatura(page, 'Seed-000');
    expect(await segnature(page)).toEqual(['Seed-001']);

    await page.evaluate(() => (window as any).gestoreAnnullamento.annullaUltimaAzione());
    await expect.poll(() => segnature(page)).toEqual(['Seed-000', 'Seed-001']);

    await page.evaluate(() => (window as any).gestoreAnnullamento.ripetiUltimaAzione());
    await expect.poll(() => segnature(page)).toEqual(['Seed-001']);
  });

  test('la modifica di una scheda è annullabile', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Fase4');
    await seedItems(page, 2);

    const id = await page.evaluate(() => {
      const m = appData.manoscritti.find((x: any) => x.segnatura === 'Seed-000');
      return String(m.id);
    });
    await page.evaluate((rid: string) => (window as any).editItem(rid), id);
    await page.locator('#form-segnatura').fill('RISCRITTA');
    await page.locator('#btn-submit-form').click();
    await expect.poll(() => segnature(page)).toEqual(['RISCRITTA', 'Seed-001']);

    await page.evaluate(() => (window as any).gestoreAnnullamento.annullaUltimaAzione());
    await expect.poll(() => segnature(page)).toEqual(['Seed-000', 'Seed-001']);
  });

  test('una nuova azione azzera la coda delle ripetizioni', async ({ page, userDataDir }) => {
    await createLocalWorkspace(page, path.join(userDataDir, 'ws'), 'Fase4');
    await seedItems(page, 3);
    await eliminaPerSegnatura(page, 'Seed-000');
    await page.evaluate(() => (window as any).gestoreAnnullamento.annullaUltimaAzione());
    expect(await page.evaluate(() => (window as any).gestoreAnnullamento.puoRipetere())).toBe(true);

    await eliminaPerSegnatura(page, 'Seed-001');
    expect(await page.evaluate(() => (window as any).gestoreAnnullamento.puoRipetere())).toBe(false);
  });
});
