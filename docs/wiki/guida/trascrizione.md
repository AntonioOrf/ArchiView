# Trascrizione

Il pulsante **Trascrivi** su una scheda apre l'ambiente dedicato: l'immagine (o il PDF) del
documento a sinistra, l'editor di testo a destra.

![L'ambiente di trascrizione: carta del documento a sinistra, testo con i numeri di riga a destra](/img/trascrizione.png){.light-only}
![L'ambiente di trascrizione: carta del documento a sinistra, testo con i numeri di riga a destra](/img/trascrizione-scuro.png){.dark-only}

In alto, il selettore **Fonte | Affiancate | Testo** sceglie che cosa vedere: solo la carta, le due
colonne, o solo il testo a tutta larghezza. Se la scheda non ha allegati si vede solo il testo.

## Una trascrizione per carta

Il testo appartiene alla **carta** che stai guardando, non alla scheda intera: cambiando
allegato, l'editor segue. In alto compare l'indicazione «Carta 2 di 3», con il nome del file.

Con `Alt+←` e `Alt+→` si passa da una carta all'altra, e il testo di ciascuna resta al suo posto:
prima di ogni cambio di carta l'app tiene in memoria quello che hai appena scritto.

Se la scheda non ha allegati, si scrive su un'unica trascrizione, come da sempre.

## I PDF, una pagina alla volta

Un PDF si apre nello stesso visore delle immagini, con zoom, rotazione e filtri, e si sfoglia
**pagina per pagina**: le frecce e il numero di pagina nella barra del visore, oppure `PagSu` e
`PagGiù`. Arrivati all'ultima pagina, si prosegue con l'allegato successivo.

Anche la trascrizione è **per pagina**: ogni pagina del PDF ha il suo testo, e l'indicazione in
alto dice a quale pagina stai lavorando («p. 3 di 12»). Quando il testo esce dall'app (stampa,
esportazione), le pagine vengono unite nell'ordine, ciascuna preceduta dal suo marcatore `[p. N]`.

Il campo **Cerca nel PDF** trova una parola nel testo del PDF stesso (se ne ha uno) oppure nella
tua trascrizione, e porta alla pagina giusta. Anche un facsimile di centinaia di pagine si apre
subito: il file viene letto un pezzo alla volta, non caricato per intero.

## Il visore

Ha tutti i comandi descritti in [Allegati](/guida/allegati): ingrandimento, spostamento,
rotazione, adattamento alla pagina, e soprattutto **luminosità, contrasto e negativo** per le
scritture difficili. `Alt+F` passa da «Affiancate» a «Fonte» e ritorno: la carta prende tutto lo
spazio.

## L'editor

È un editor di testo: la barra offre la formattazione necessaria a marcare il testo dove serve.
**Salva spesso con `Ctrl+S`**: è la scorciatoia più utile del programma.

Ogni riga ha il suo **numero** a margine, e in fondo una barra dice a che riga sei, quante sono e
quante parole contiene il testo.

La barra filologica applica i segni di Leiden alla selezione:

| Pulsante | Con una selezione | Senza selezione |
| --- | --- | --- |
| **[lacuna]** | la mette tra quadre: `[sel]` | inserisce `[...]` |
| **(espansione)** | scioglimento di abbreviazione tra tonde: `(sel)` | inserisce `()` col cursore dentro |
| **sic (!)** | segnala la lezione: `sel (!)` | — |

Incollando da Word o da una pagina web restano paragrafi, grassetto, corsivo, sottolineato ed
elenchi; stili, colori e immagini si perdono.

Il pulsante di esportazione porta il testo fuori dall'app in cinque formati: vedi
[Esportare trascrizioni e citazioni](/esporta/testo-citazioni).

## La scheda accanto al documento

Sopra l'editor ci sono due tab, **Testo** e **Scheda**. «Scheda» mostra il modulo completo della
scheda al posto del testo, con la carta sempre accanto: si compilano datazione, materia, misure
guardando il documento. La scheda si salva da sola dopo una breve pausa, e accanto ai tab compare
«Salvata alle…». `Ctrl+Maiusc+S` passa da un tab all'altro.

Si può fare anche il contrario: modificando una scheda, il pulsante **Documento** mostra la carta
accanto al modulo, con «Immagine | Trascrizione» per leggere il testo già trascritto.

La barra fra le due colonne si trascina, si regola con le frecce `←` `→` dopo averla selezionata e
torna a metà con un doppio clic; si aggancia a un terzo, metà e due terzi. Per «Testo» e «Scheda»
ricorda proporzioni diverse.

### In una finestra a parte

Con due monitor, il pulsante **Stacca in una finestra** porta la scheda (o il documento) in una
finestra sua. Per rimetterla al suo posto: **Riaggancia**, la chiusura della finestra, oppure
trascinarla sopra la colonna di sinistra finché compare «Rilascia per riagganciare». Le due finestre
lavorano sulla stessa scheda: quello che scrivi in una non si perde nell'altra.

## Il testo trascritto è ricercabile

Tutto ciò che scrivi entra nella ricerca globale: cercare una formula o un nome dentro le
trascrizioni funziona come cercarlo nei metadati.

Il filtro «ha trascrizione» separa in un clic il fatto dal da farsi.

## Partire da una bozza automatica

Su scritture tarde o a stampa, l'[OCR](/guida/ocr) può produrre una prima bozza da correggere,
con le parole incerte già segnalate. Su una minuscola notarile trecentesca, no: valuta con tre o
quattro carte di prova.

## Metodo di lavoro consigliato

1. **Prima le schede, poi le trascrizioni.** Schedare in blocco un fondo (segnature, date,
   regesti brevi) dà subito un archivio consultabile; le trascrizioni si aggiungono nel tempo.
2. **Usa un tag per lo stato**: `da trascrivere`, `trascrizione parziale`, `da collazionare`.
   Filtrando per tag sai sempre che cosa manca.
3. **Segnala i dubbi con una convenzione costante** (per esempio `[?]`): potrai ritrovarli tutti
   con la ricerca.
