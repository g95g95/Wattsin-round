# Wattsin-round

Interfaccia web single-page in **React 18** (servita da HTML/CSS/JS senza build) per stimare watt/kg su una scalata ciclistica con confronto grafico e spiegazione teorica.

## Come usarla
1. Apri `index.html` in un browser moderno (non richiede build né dipendenze esterne oltre ai CDN inclusi per React/htm). Su GitHub Pages o altre pubblicazioni in sottocartella, i percorsi sono relativi (`./src/...`) quindi funzionano senza configurazioni extra.
2. Segui il flusso a step:
   - **Presentazione**: inserisci età e sesso biologico.
   - **Inserimento dati**: tab "Peso & bici" (peso atleta, bici o selezione da catalogo con peso precompilato, tipologia) e tab "Dati salita" (dislivello, distanza, tempo hh:mm:ss, vento opzionale, nome/data scalata).
   - **Risultati**: VAM, watt totali, watt/kg, fascia prestazionale e accesso agli insights.
3. Nel tab **Confronto** puoi esportare il grafico con nome della salita e data (o data odierna se mancante).
4. Nel tab **Teoria** trovi le formule fisiche e il bonus di dilatazione temporale.

Non è richiesta alcuna build: basta aprire il file HTML oppure servirlo con un semplice `npx serve` o `python -m http.server` per test locale.
