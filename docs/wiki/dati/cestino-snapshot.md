# Cestino, snapshot e cronologia

Quattro reti di sicurezza sovrapposte, dalla più immediata alla più profonda. Vale la pena
conoscerle **prima** di averne bisogno.

## 1. Annulla e ripeti

`Ctrl+Z` annulla l'ultima azione, `Ctrl+Y` (o `Ctrl+Maiusc+Z`) la rifà.

Coprono anche le operazioni estese: un'importazione da CSV di duecento schede, una sostituzione
di testo su un'intera selezione, la fusione di due tag sono **una sola azione annullabile**.

Le scorciatoie non sono attive mentre stai scrivendo dentro un campo di testo: in quel caso
`Ctrl+Z` annulla la digitazione, come ci si aspetta.

## 2. Cestino

Le schede eliminate non spariscono: finiscono nel cestino, dove restano **30 giorni** (il valore
si cambia nelle impostazioni). Da lì si ripristinano o si eliminano definitivamente.

Si apre dal menu «⋯» sopra l'elenco, da **Impostazioni → Dati** e dalla palette dei comandi
(`Ctrl+K` → «cestino» o «recupera»).

![Il cestino, con le schede eliminate e i pulsanti per ripristinarle](/img/cestino.png){.light-only}
![Il cestino, con le schede eliminate e i pulsanti per ripristinarle](/img/cestino-scuro.png){.dark-only}

::: tip Il cestino è tuo, non dell'archivio
Non viene sincronizzato: in un archivio condiviso nessuno vede ciò che hai eliminato, e
svuotarlo qui non fa tornare le schede da un'altra macchina. L'eliminazione, quella sì, si
propaga a tutti come sempre.
:::

## 3. Snapshot locali

Uno **snapshot** è una fotografia dell'intero archivio, presa automaticamente mentre lavori (al
massimo una ogni mezz'ora) e conservata sul tuo disco, compressa.

Vengono tenuti gli **ultimi 10** più il **più recente di ogni giorno per 30 giorni**: i due
criteri si sommano, quindi hai sia il dettaglio delle ultime ore sia la storia del mese.

Si trovano nel pannello **Cronologia** della barra laterale, sezione «Snapshot locali». Ci sono
sempre, anche senza alcuna sincronizzazione attiva.

![Il pannello Cronologia con l'elenco degli snapshot locali](/img/cronologia.png){.light-only}
![Il pannello Cronologia con l'elenco degli snapshot locali](/img/cronologia-scuro.png){.dark-only}

Da lì puoi **ripristinare** l'archivio a una fotografia precedente. Il ripristino è pensato per
sopravvivere alla sincronizzazione: le schede che tornano indietro vengono rifirmate e quelle
create dopo lo snapshot non ritornano dal cloud.

::: warning
Il ripristino riporta indietro **tutto** l'archivio, non la singola scheda. Per una scheda sola
usa la cronologia della scheda, qui sotto.
:::

## 4. Cronologia di una scheda

Menu del tasto destro su una scheda → **Cronologia**: mostra come quella scheda cambiava nel
tempo, ricostruita dagli snapshot, con le differenze evidenziate campo per campo.

È lo strumento giusto per la domanda più frequente: *«questa data l'avevo scritta diversa?»*.

## Le impostazioni

**Impostazioni → Dati → Cestino e snapshot**: si regolano quanti snapshot tenere, per quanti
giorni, e per quanti giorni conservare il cestino.

`0 giorni` per il cestino significa «non conservare nulla», non «per sempre».

## Che cosa non coprono

Nessuna di queste reti protegge dal disco rotto o dalla cartella cancellata: cestino e snapshot
vivono **dentro** la cartella di lavoro. Per quello serve una copia altrove: vedi
[Backup, export e trasferimento](/dati/backup-export).
