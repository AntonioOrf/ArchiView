# Collegamenti, persone e luoghi

Tre strumenti che rispondono a domande diverse: *questo documento con quale altro c'entra?*,
*quante grafie ho usato per la stessa persona?*, *che forma ha la rete dei rimandi?*

## Collegare due schede

Dall'editor della scheda, nel blocco dei collegamenti: scegli la scheda di destinazione e il
tipo di rimando (copia di, originale di, allegato a, citato in…).

Il collegamento si scrive **su una sola scheda**: l'altra lo mostra automaticamente come rimando
in entrata. Non devi registrarlo due volte, e non c'è modo che le due metà divergano.

### Dove si vedono i collegamenti

| Dove | Cosa mostra |
| --- | --- |
| Badge sulla scheda nell'elenco | Quanti rimandi ha, nei due versi; ci si clicca |
| Menu del tasto destro → «Collegate» | Il pannello dei collegamenti |
| Pannello «Schede collegate» | *Rimanda a* e *è richiamata da*, separati, con un clic per aprire |
| Filtri avanzati | Solo le schede collegate (o solo quelle isolate) |

I due versi restano **distinti** di proposito: «rimanda a» e «è richiamata da» sono affermazioni
diverse, e fonderle confonderebbe l'originale con la sua copia.

![Il pannello delle schede collegate, con i rimandi in uscita e in entrata](/img/collegamenti.png){.light-only}
![Il pannello delle schede collegate, con i rimandi in uscita e in entrata](/img/collegamenti-scuro.png){.dark-only}

I rimandi in entrata si vedono ma non si modificano dalla scheda che li riceve: si tolgono dalla
scheda che li ha scritti.

## Anagrafica di persone e luoghi

L'app ricava da sola l'elenco delle **persone** (dai campi attori e famiglia) e dei **luoghi**
(dal campo di data topica) presenti nell'archivio, con il numero di schede per ciascuno.

L'operazione per cui esiste è una sola: **rinominare una voce riscrive il nome in tutte le
schede**. Unificare «Rossi Giovanni», «Giovanni Rossi» e «Io. de Rubeis» diventa un'operazione da
un minuto invece che da quaranta schede aperte a mano.

Da ogni voce si arriva alle schede che la citano, e si possono conservare la grafia scelta e una
nota.

![L'anagrafica delle persone, con il numero di schede per ciascuna voce](/img/anagrafica.png){.light-only}
![L'anagrafica delle persone, con il numero di schede per ciascuna voce](/img/anagrafica-scuro.png){.dark-only}

::: tip
L'anagrafica non è la fonte del dato: si ricalcola dalle schede a ogni apertura. Se una persona
sparisce dall'elenco è perché non compare più in nessuna scheda.
:::

## La vista a grafo

Il pannello dei collegamenti dice *con che cosa è collegata questa scheda*. Il grafo risponde a
una domanda che quello non può porre: **che forma ha la rete**.

Serve a vedere quali documenti formano un grappolo, quali restano isolati, quale scheda fa da
perno. Su un fondo notarile è spesso il modo più rapido per accorgersi che tre carte
apparentemente scollegate appartengono allo stesso affare.

![Il grafo dei collegamenti: nodi per scheda, frecce per il verso del rimando](/img/grafo.png){.light-only}
![Il grafo dei collegamenti: nodi per scheda, frecce per il verso del rimando](/img/grafo-scuro.png){.dark-only}

Comandi:

- **clic singolo** su un nodo: lo seleziona e attenua i non-collegati (senza nasconderli: il
  contesto attorno deve restare leggibile);
- **doppio clic**: apre la scheda;
- trascinamento, zoom e spostamento della vista con il mouse.

Due comportamenti voluti: le schede **isolate** sono nascoste per impostazione predefinita (su
trecento schede con dieci rimandi sarebbero duecentonovanta puntini fermi; c'è la casella per
mostrarle), e su reti molto grandi vengono disegnate le schede **più collegate**, con un avviso
che dice quante sono rimaste fuori.
