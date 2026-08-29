// ══════════════════════════════════════════════════════
//  DATI PERSONAGGI — per il tooltip con anteprima immagine
// ══════════════════════════════════════════════════════
//
// Come funziona:
// ogni volta che uno dei nomi qui sotto compare (scritto esattamente
// così) nel testo di un articolo, wiki-script.js lo trasforma
// automaticamente in un elemento su cui passare il mouse (o toccare,
// da smartphone) per vedere l'immagine collegata. Non serve creare
// una pagina apposta solo per mostrare una faccia.
//
// Per aggiungere un personaggio:
//   1. aggiungi una riga qui sotto: "Nome esatto": "percorso/immagine.jpg",
//   2. metti l'immagine nel percorso indicato (relativo a questo file).
//
// Attenzione:
// - il nome deve comparire nel testo esattamente come scritto qui
//   (maiuscole/minuscole comprese);
// - se un nome è contenuto in un altro (es. "Mario" dentro "Mario Rossi"),
//   non serve fare nulla: viene riconosciuto sempre il nome più lungo.

const PERSONAGGI_IMG = {
  "Nestola": "img/personaggi/nestola.jpg",
  "Morello": "img/personaggi/morello.jpg",
  "Filippo": "img/personaggi/filippo.jpg",
  "Alessio": "img/personaggi/alessio.jpg",
  "Ludovico": "img/personaggi/ludovico.jpg",

  // Aggiungi qui i prossimi personaggi:
  // "Nome Cognome": "img/personaggi/nome-cognome.jpg",
};
