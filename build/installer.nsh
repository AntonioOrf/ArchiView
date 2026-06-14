!macro customInit
  ; Se l'installer è eseguito in modalità silenziosa (es. dall'auto-updater), salta la conferma
  IfSilent skipCheck

  ; Controlla se l'eseguibile di ArchiView esiste già nella directory di destinazione
  IfFileExists "$INSTDIR\ArchiView.exe" 0 skipCheck
    MessageBox MB_YESNO|MB_ICONQUESTION "ArchiView risulta già installato nel tuo sistema.$\r$\nVuoi procedere con l'aggiornamento o la reinstallazione?" IDYES skipCheck
    Quit

skipCheck:
!macroend
