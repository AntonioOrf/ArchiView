# Vocabolari controllati

Un **vocabolario** è un elenco di valori ammessi per un campo: tipologie di supporto, stati di
conservazione, tipologie documentarie. Il campo diventa una tendina invece che un testo libero.

Serve a una cosa sola, ma decisiva: **impedire che lo stesso concetto venga scritto in cinque
modi diversi**, con il risultato che nessun filtro darà mai il conto giusto.

## Creare e modificare un vocabolario

Dalla finestra dei vocabolari (raggiungibile dalla palette dei comandi con `Ctrl+K`): elenco a
sinistra, valori a destra, rinomina sul posto.

Per **legare** un vocabolario a un campo si usa l'editor del campo, dentro la gestione dei
modelli: il campo diventa di tipo elenco e attinge da quel vocabolario.

## Aggiungere un valore mentre si scheda

Non serve interrompere la compilazione: dalla tendina si può aggiungere un valore nuovo al volo,
e da quel momento è disponibile per tutte le schede.

È il compromesso che rende i vocabolari usabili: un elenco che va chiuso in anticipo, prima di
sapere che cosa contiene il fondo, verrebbe aggirato entro la seconda settimana.

## Regole da conoscere

- **Un valore fuori elenco non blocca il salvataggio.** Capita quando qualcuno accorcia il
  vocabolario dopo che hai già schedato: la scheda deve restare salvabile.
- **Togliere un valore dall'elenco non lo cancella dalle schede** che lo usavano.
- **Eliminare un vocabolario libera i campi**: i valori vengono copiati dentro il campo, che
  torna a essere un elenco autonomo. Senza, resterebbero tendine vuote — cioè campi non
  compilabili.
- In un archivio condiviso i valori aggiunti da due persone **si sommano**: nessuno perde il
  proprio.

## Segnature ripetute

Nella stessa area c'è il controllo dei **doppioni di segnatura**: l'elenco delle schede che
portano la stessa segnatura, raggruppate.

::: warning La segnatura ripetuta si segnala, non si vieta
Un fondo reale contiene segnature ripetute per inventariazioni antecedenti alla schedatura.
Rifiutarle costringerebbe l'archivista a falsificare il dato pur di poter salvare. L'app avvisa
**dopo** il salvataggio e ti lascia decidere.
:::

Un campo si può comunque marcare come **unico** nel modello: in quel caso il duplicato viene
segnalato ogni volta, restando salvabile. È diverso da **obbligatorio**, che invece blocca.
